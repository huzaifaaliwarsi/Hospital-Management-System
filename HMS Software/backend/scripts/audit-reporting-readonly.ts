import { prisma } from '../src/db/client';
import { payrollService } from '../src/modules/payroll/payroll.service';
import { managementReportsService } from '../src/modules/reports/managementReports.service';
import { frontdeskReportsService as fd } from '../src/modules/reports/frontdeskReports.service';
import { frontdeskBillingReportService } from '../src/modules/reports/frontdeskBilling.service';
import { admissionReportsService as adm } from '../src/modules/reports/admissionReports.service';
import { admissionSimpleReportsService as simple } from '../src/modules/reports/admissionSimpleReports.service';

// Diagnostic only: no patient details, no writes, no payroll generation.
async function main() {
  await prisma.$queryRaw`SELECT 1`;
  const counts = await Promise.all([
    prisma.payrollRun.count(), prisma.salarySlip.count(),
    prisma.doctorCommissionAccrual.count(), prisma.doctorCommissionRule.count(),
    prisma.staffSalaryProfile.count(), prisma.attendanceRecord.count({ where: { isApproved: true } }),
  ]);
  console.log(JSON.stringify({ counts: Object.fromEntries(['payrollRuns', 'salarySlips', 'commissionAccruals', 'commissionRules', 'salaryProfiles', 'approvedAttendance'].map((k, i) => [k, counts[i]])) }));
  console.log(JSON.stringify({ dataCoverage: await Promise.all([
    prisma.hospitalInvoice.aggregate({ _count: true, _min: { createdAt: true }, _max: { createdAt: true } }),
    prisma.admissionRecord.aggregate({ _count: true, _min: { createdAt: true }, _max: { createdAt: true } }),
    prisma.payrollRun.aggregate({ _sum: { totalAmount: true } }),
  ]) }));
  const q = { preset: 'custom' as const, fromDate: '2020-01-01', toDate: '2100-01-01' };
  const checks: [string, () => Promise<any>][] = [
    ['payroll-preview', () => payrollService.preview({ periodType: 'MONTHLY', periodStart: new Date('2026-09-01'), periodEnd: new Date('2026-09-30T23:59:59.999Z') })],
    ['management-payroll-commission', () => managementReportsService.getStaffPayrollCommission({ period: '2026-09' })],
    ['frontdesk-summary', () => frontdeskBillingReportService.getReport(q)],
    ['frontdesk-encounters', () => fd.getEncounterRegister(q)],
    ['frontdesk-invoices', () => fd.getInvoiceRegister(q)],
    ['frontdesk-collections', () => fd.getCollectionReport(q)],
    ['frontdesk-outstanding', () => fd.getOutstandingInvoices(q)],
    ['frontdesk-admission-collections', () => fd.getAdmissionPaymentCollectionReport(q)],
    ['frontdesk-exceptions', () => fd.getFinancialExceptions(q)],
    ['admission-summary', () => simple.getAdmissionSummary(q)],
    ['admission-register', () => adm.getAdmissionRegister(q)],
    ['admission-census', () => simple.getCensusBedReport({})],
    ['admission-transfer-los', () => simple.getTransferLosReport(q)],
    ['admission-bill-status', () => simple.getHospitalBillStatus(q)],
    ['admission-pharmacy', () => simple.getPharmacyRequestFulfillment(q)],
    ['admission-clearance', () => adm.getDischargeClearanceReport(q)],
  ];
  for (const [name, check] of checks) {
    try {
      const result = await check();
      if (name === 'management-payroll-commission') console.log(JSON.stringify({ managementTotals: { payroll: result.rows.reduce((s: number, r: any) => s + Number(r.payrollAmount), 0), commission: result.rows.reduce((s: number, r: any) => s + Number(r.commissionAmount), 0) } }));
      console.log(JSON.stringify({ name, ok: true, rows: result.rows?.length, staffCount: result.staffCount, skipped: result.skipped?.length, totalAmount: result.totalAmount, keys: Object.keys(result) }));
    } catch (error: any) {
      console.log(JSON.stringify({ name, ok: false, code: error.code, error: error.message }));
    }
  }
}
main().catch((e) => { console.error({ code: e.code, error: e.message }); process.exitCode = 1; }).finally(() => prisma.$disconnect());
