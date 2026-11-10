/** Read-only audit. Does not create invoices, receipts or settlements. */
import { prisma } from '../src/db/client';
import { Decimal } from '@prisma/client/runtime/library';
import { setupService } from '../src/modules/setup/setup.service';
import { managementReportsService } from '../src/modules/reports/managementReports.service';
import { resolveDateRange } from '../src/modules/reports/dashboard.service';
import { signedReceiptWhere } from '../src/shared/departmentCollections';

async function main() {
  const period = { preset: 'this_month' as const };
  const { start, end } = resolveDateRange(period);
  const payables = await setupService.getDepartmentPayablesSummary(period);
  const summary = await managementReportsService.getSummary(period);
  const receipts = await prisma.paymentReceipt.aggregate({
    where: { ...signedReceiptWhere, collectedAt: { gte: start, lte: end } },
    _sum: { amount: true },
  });
  const companyPayments = await prisma.panelRemittanceAllocation.aggregate({
    where: { panelRemittance: { receivedAt: { gte: start, lte: end } } },
    _sum: { allocatedAmount: true },
  });
  const lab = payables.departments.filter(d => /lab/i.test(d.departmentName));
  const filtered = await Promise.all(lab.map(d => managementReportsService.getSummary({ ...period, departmentId: d.departmentId })));
  console.log(JSON.stringify({
    period: payables.period,
    receiptTotal: String(receipts._sum.amount ?? 0),
    companyPaymentTotal: String(companyPayments._sum.allocatedAmount ?? 0),
    managementCollections: String(summary.summary.collections),
    reconciles: summary.summary.collections.eq((receipts._sum.amount ?? new Decimal(0)).plus(companyPayments._sum.allocatedAmount ?? 0)),
    lab: lab.map((d, index) => ({
      name: d.departmentName, invoices: d.invoicesCount, services: d.servicesCount,
      periodBilled: d.periodBilled, periodCollected: d.periodRealized,
      openingBalance: d.openingBalance, periodSettled: d.periodSettled,
      closingBalance: d.closingBalance, needsReconciliation: d.requiresSettlementReconciliation,
      managementCollections: String(filtered[index].summary.collections),
    })),
  }, null, 2));
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Audit failed');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
