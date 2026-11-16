import 'dotenv/config';
import { describe, it, expect, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'node:crypto';
const holder = vi.hoisted(() => ({ tx: null as any, db: null as any }));
vi.mock('@/db/client', () => ({ prisma: new Proxy({}, { get: (_, key) => key === '$transaction'
  ? (fn: any, options: any) => holder.tx ? (typeof fn === 'function' ? fn(holder.tx) : Promise.all(fn)) : holder.db.$transaction(fn, options) : (holder.tx ?? holder.db)[key] }) }));
import { invoicesService } from '@/modules/frontdesk/invoices.service';
import { frontdeskReportsService } from '@/modules/reports/frontdeskReports.service';
import { frontdeskBillingReportService } from '@/modules/reports/frontdeskBilling.service';
import { managementReportsService } from '@/modules/reports/managementReports.service';
import { dashboardService } from '@/modules/reports/dashboard.service';
import { commissionService, commissionInclude } from '@/modules/commission/commission.service';
import { commissionBalance } from '@/modules/commission/commission.calc';
import { departmentCollectionLedger } from '@/shared/departmentCollections';
import { cashService } from '@/modules/cash/cash.service';
import { setupService } from '@/modules/setup/setup.service';
import { admissionReportsService } from '@/modules/reports/admissionReports.service';
const range = (day: string) => ({ preset: 'custom' as const, fromDate: day, toDate: day });
const sum = (rows: any[], key: string) => rows.reduce((s, r) => s + Number(r[key]), 0);

describe.runIf(process.env.HMS_HISTORICAL_DB_TEST === '1')('historical HMS installments (real database, rollback only)', () => {
  it('A-F: original invoice, installment periods, historical debt, departments, commission, digital/cash, refunds and retry safety', async () => {
    const db = new PrismaClient();
    const rollback = new Error('ROLLBACK_HISTORICAL_FIXTURES');
    const marker = `HIST-${randomUUID()}`;
    try {
      await db.$transaction(async tx => {
        holder.tx = tx;
        // Test the additive migration inside the rollback boundary as well.
        await tx.$executeRawUnsafe('ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS collection_request_key TEXT');
        await tx.$executeRawUnsafe('ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS payment_account TEXT');
        await tx.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_collection_request_key_key ON payment_receipts(collection_request_key)');
        const actor = await tx.portalUser.create({ data: { username: marker, passwordHash: 'TEST-NO-LOGIN', role: 'FRONT_DESK_BILLING' } });
        const actor2 = await tx.portalUser.create({ data: { username: marker + '-2', passwordHash: 'TEST-NO-LOGIN', role: 'FRONT_DESK_BILLING' } });
        const dept = await tx.department.create({ data: { code: marker, name: marker, departmentType: 'CLINICAL' } });
        const dept2 = await tx.department.create({ data: { code: marker + '-2', name: marker + '-2', departmentType: 'CLINICAL' } });
        const service = await tx.serviceRate.create({ data: { code: marker, name: marker, standardRate: 1000, billingUnit: 'SERVICE', departmentId: dept.id } });
        const service2 = await tx.serviceRate.create({ data: { code: marker + '-2', name: marker + '-2', standardRate: 1000, billingUnit: 'SERVICE', departmentId: dept2.id } });
        const at = new Date('2026-11-01T10:00:00Z');
        const doctor = await tx.staff.create({ data: { employeeId: marker, fullName: marker, category: 'Doctor', phone: '03000000000', joiningDate: at, staffServices: { create: { serviceRateId: service.id } } } });
        await tx.staffSalaryProfile.create({ data: { staffId: doctor.id, salaryBasis: 'MONTHLY_COMMISSION', baseAmount: 0, effectiveFrom: at } });
        await tx.doctorCommissionRule.create({ data: { staffId: doctor.id, serviceRateId: service.id, ruleType: 'PERCENTAGE', rate: 20, basis: 'NET', effectiveFrom: at } });
        let seq = 0;
        const make = async (amount: number, mixed = false, encounterType: 'OPD' | 'EMERGENCY' | 'OBSERVATION' = 'OPD') => tx.hospitalInvoice.create({ data: {
          invoiceNumber: `${marker}-${++seq}`, sourceType: 'WALK_IN', encounterType, departmentId: dept.id, createdById: actor.id, createdAt: at,
          total: amount, subtotal: amount, patientShare: amount,
          lines: { create: [{ serviceRateId: service.id, performedByStaffId: doctor.id, rateSnapshot: mixed ? amount * .6 : amount, lineGross: mixed ? amount * .6 : amount, lineNet: mixed ? amount * .6 : amount, patientShare: mixed ? amount * .6 : amount, isCompleted: true, createdAt: at },
            ...(mixed ? [{ serviceRateId: service2.id, rateSnapshot: amount * .4, lineGross: amount * .4, lineNet: amount * .4, patientShare: amount * .4, isCompleted: true, createdAt: at }] : [])] },
        }, include: { lines: true } });
        const post = async (id: string, amount: number, day: string, method: 'CASH' | 'BANK' | 'ONLINE' = 'CASH', user = actor.id, requestKey = randomUUID()) => {
          vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(`${day}T12:00:00Z`));
          try { return await invoicesService.collectPayment(id, { amount, paymentMethod: method, paymentAccount: method === 'CASH' ? undefined : 'HMS Bank Test Account', requestKey }, user); }
          finally { vi.useRealTimers(); }
        };
        const beforeDashboard1 = await dashboardService.getSuperAdminDashboard(range('2026-11-01'));
        const beforeDashboard16 = await dashboardService.getSuperAdminDashboard(range('2026-11-16'));
        const inv = await make(1000);
        const first = await post(inv.id, 500, '2026-11-01');
        expect(first.invoice.status).toBe('PARTIALLY_PAID');
        const key = randomUUID();
        const second = await post(inv.id, 500, '2026-11-16', 'BANK', actor2.id, key);
        await post(inv.id, 500, '2026-11-16', 'BANK', actor2.id, key);
        expect(second.invoice.paidTotal.toNumber()).toBe(1000); expect(second.invoice.status).toBe('PAID');
        expect(await tx.hospitalInvoice.count({ where: { invoiceNumber: inv.invoiceNumber } })).toBe(1);
        const saved = await tx.hospitalInvoice.findUniqueOrThrow({ where: { id: inv.id }, include: { paymentReceipts: true, lines: true } });
        expect(saved.createdAt).toEqual(at); expect(saved.lines).toEqual(inv.lines); expect(saved.paymentReceipts).toHaveLength(2);
        expect(saved.paymentReceipts.find(p => p.id === first.receipt.id)).toEqual(first.receipt);
        const transactions = await invoicesService.listInvoices({ transactions: 'true', search: inv.invoiceNumber });
        expect(transactions).toHaveLength(2);
        expect(transactions).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: inv.id, transactionId: 'invoice:' + inv.id, transactionType: 'Original Invoice', billingAmount: 1000, collectedAmount: 500, balanceDue: 0, transactionAt: at }),
          expect.objectContaining({ id: inv.id, transactionId: 'receipt:' + second.receipt.id, transactionType: 'Remaining Collection', billingAmount: 0, collectedAmount: 500, balanceDue: 0, transactionReceipt: expect.objectContaining({ paymentAccount: 'HMS Bank Test Account', collectedBy: { username: actor2.username } }) }),
        ]));
        const nov16Rows = await invoicesService.listInvoices({ transactions: 'true', search: inv.invoiceNumber, date: '2026-11-16' });
        expect(nov16Rows).toHaveLength(1);
        expect(nov16Rows[0]).toMatchObject({ billingAmount: 0, collectedAmount: 500 });

        for (const day of ['2026-11-01', '2026-11-16']) {
          const q = { ...range(day), departmentId: dept.id };
          const summary = await managementReportsService.getSummary(q);
          const billing = await frontdeskBillingReportService.getReport(q);
          const debt = await frontdeskReportsService.getOutstandingInvoices(q);
          const expectedDue = day.endsWith('01') ? 500 : 0;
          expect(Number(summary.summary.collectedIncome)).toBe(500);
          expect(Number(billing.collections.total)).toBe(500);
          expect(Number(summary.summary.totalBilling)).toBe(day.endsWith('01') ? 1000 : 0);
          expect(Number(billing.billing.totalNet)).toBe(day.endsWith('01') ? 1000 : 0);
          expect(Number(summary.summary.outstanding)).toBe(expectedDue);
          expect(Number(debt.summary.totalOutstanding)).toBe(expectedDue);
          expect(Number(billing.billing.totalOutstanding)).toBe(expectedDue);
          expect(Number(summary.summary.operatingResult)).toBe(Number(summary.summary.collectedIncome) - Number(summary.summary.totalOperatingCosts));
          expect(Number(summary.summary.totalOperatingCosts)).toBe(100);
          expect(Number(summary.summary.operatingResult)).toBe(400);
        }
        const dash1 = await dashboardService.getSuperAdminDashboard(range('2026-11-01'));
        const dash16 = await dashboardService.getSuperAdminDashboard(range('2026-11-16'));
        expect(dash1.billingSummary.outstandingAmount - beforeDashboard1.billingSummary.outstandingAmount).toBe(500);
        expect(dash16.billingSummary.netBilling - beforeDashboard16.billingSummary.netBilling).toBe(0);
        expect(dash16.billingSummary.paidAmount - beforeDashboard16.billingSummary.paidAmount).toBe(500);
        const payables = await setupService.getDepartmentPayablesSummary(range('2026-11-16'));
        expect(payables.departments.find(r => r.departmentId === dept.id)!.periodRealized).toBe(500);
        const settlement = await managementReportsService.getBalanceSettlements({ ...range('2026-11-16'), portalUserId: actor2.id });
        expect(Number(settlement.rows[0]!.nonCash)).toBe(500);
        const custody = await managementReportsService.getBalanceSettlements({ ...range('2026-11-16'), portalUserId: actor.id });
        expect(Number(custody.rows[0]!.opening)).toBe(500);
        expect(Number(custody.rows[0]!.remaining)).toBe(500);
        const invoiceCollections = await managementReportsService.getBillingCollection({ ...range('2026-11-16'), departmentId: dept.id });
        expect(invoiceCollections.rows).toHaveLength(1);
        expect(Number(invoiceCollections.rows[0]!.periodBilled)).toBe(0);
        expect(Number(invoiceCollections.rows[0]!.collected)).toBe(500);
        const oldRegister = await frontdeskReportsService.getInvoiceRegister({ ...range('2026-11-01'), departmentId: dept.id });
        expect(Number(oldRegister.rows[0]!.paid)).toBe(500); expect(oldRegister.rows[0]!.status).toBe('PARTIALLY_PAID');
        const oldDebt = await managementReportsService.getOutstandingPanel({ ...range('2026-11-01'), departmentId: dept.id, status: 'PARTIALLY_PAID' });
        expect(Number(oldDebt.rows[0]!.due)).toBe(500);
        const byCashier = await frontdeskReportsService.getCollectionReport({ ...range('2026-11-16'), collectedById: actor2.id });
        expect(Number(byCashier.summary.total)).toBe(500);
        const bankSheet = await cashService.getCashierBalanceSheet(actor2.id, range('2026-11-16'));
        expect(Number(bankSheet.summary.nonPhysicalTotal)).toBe(500); expect(Number(bankSheet.summary.expectedPhysicalCash)).toBe(0);
        const cashSheet = await cashService.getCashierBalanceSheet(actor.id, range('2026-11-01'));
        expect(Number(cashSheet.summary.expectedPhysicalCash)).toBe(500);
        expect((await tx.userCashBalance.findUniqueOrThrow({ where: { paymentReceiptId: second.receipt.id } })).occurredAt).toEqual(second.receipt.collectedAt);
        const bankReport = await frontdeskBillingReportService.getReport({ ...range('2026-11-16'), cashierId: actor2.id });
        expect(Number(bankReport.collections.byAccount['HMS Bank Test Account'])).toBe(500);
        const commission = await tx.doctorCommissionAccrual.findMany({ where: { invoiceLineItem: { hospitalInvoiceId: inv.id } }, include: commissionInclude });
        expect(commission).toHaveLength(2); expect(commission.reduce((s, r) => s + Number(commissionBalance(r).payable), 0)).toBe(200);
        await commissionService.syncInvoiceCollections(tx, inv.id, actor.id);
        expect(await tx.doctorCommissionAccrual.count({ where: { invoiceLineItem: { hospitalInvoiceId: inv.id } } })).toBe(2);
        await expect(post(inv.id, 1, '2026-11-16')).rejects.toThrow('fully paid');
        await expect(post(inv.id, 499, '2026-11-16', 'BANK', actor2.id, key)).rejects.toThrow('different payment');
        const installments = await make(10000, false, 'EMERGENCY');
        await post(installments.id, 4000, '2026-11-02'); await post(installments.id, 3000, '2026-11-03'); await post(installments.id, 3000, '2026-11-04');
        expect(await tx.paymentReceipt.count({ where: { hospitalInvoiceId: installments.id } })).toBe(3);
        expect((await tx.hospitalInvoice.findUniqueOrThrow({ where: { id: installments.id } })).status).toBe('PAID');
        const mixed = await make(1000, true, 'OBSERVATION');
        await post(mixed.id, 500, '2026-11-05', 'ONLINE'); await post(mixed.id, 500, '2026-11-06');
        const ledger = await departmentCollectionLedger(tx, new Date('2026-11-05T23:59:59Z'));
        expect(sum(ledger.filter(r => r.departmentId === dept2.id), 'amount')).toBe(200);
        expect(Number((await managementReportsService.getSummary({ ...range('2026-11-05'), departmentId: dept.id })).summary.collectedIncome)).toBe(300);
        // A later refund is a separate negative receipt. Earlier periods are unchanged.
        vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
        const refundKey = randomUUID();
        try {
          const args = { amount: 100, refundMethod: 'BANK' as const, paymentReceiptId: second.receipt.id, requestKey: refundKey, reason: 'Historical regression refund' };
          await invoicesService.refundPayment(inv.id, args, actor2.id); await invoicesService.refundPayment(inv.id, args, actor2.id);
        } finally { vi.useRealTimers(); }
        expect(await tx.paymentReceipt.count({ where: { hospitalInvoiceId: inv.id } })).toBe(3);
        expect(Number((await frontdeskReportsService.getInvoiceLedger(inv.id))!.entries.at(-1)!.runningBalance)).toBe(100);
        expect(Number((await frontdeskBillingReportService.getReport({ ...range('2026-11-17'), cashierId: actor2.id })).collections.total)).toBe(-100);
        expect(Number((await managementReportsService.getOutstandingPanel({ ...range('2026-11-01'), departmentId: dept.id })).rows.find(r => r.id === inv.id)!.due)).toBe(500);
        const admission = await tx.admissionRecord.create({ data: { admissionNumber: marker, departmentId: dept.id, status: 'ACTIVE', admittedAt: at } });
        const ipd = await make(800);
        await tx.hospitalInvoice.update({ where: { id: ipd.id }, data: { sourceType: 'ADMISSION', admissionRecordId: admission.id, encounterType: null } });
        await post(ipd.id, 200, '2026-11-01'); await post(ipd.id, 600, '2026-11-16');
        const ipdHistory = await admissionReportsService.getInpatientOutstandingBalance({ ...range('2026-11-01'), departmentId: dept.id });
        expect(Number(ipdHistory.rows.find(r => r.admissionNumber === marker)!.hospitalOutstanding)).toBe(600);
        const clearedIpd = await tx.hospitalInvoice.findUniqueOrThrow({ where: { id: ipd.id } });
        expect(clearedIpd.createdAt).toEqual(at); expect(clearedIpd.admissionRecordId).toBe(admission.id); expect(clearedIpd.status).toBe('PAID');
        const voided = await make(200);
        await tx.hospitalInvoice.update({ where: { id: voided.id }, data: { status: 'VOID' } });
        await expect(post(voided.id, 50, '2026-11-16')).rejects.toThrow('void');
        await tx.hospitalInvoice.createMany({ data: Array.from({ length: 205 }, (_, index) => ({ invoiceNumber: `${marker}-OPEN-${index}`, sourceType: 'WALK_IN' as const, total: 10, patientShare: 10, createdAt: new Date('2026-11-15T12:00:00Z'), createdById: actor.id })) });
        const oldReceivables = await invoicesService.listInvoices({ search: marker, hasOutstandingBalance: 'true' });
        expect(oldReceivables.some(r => r.id === inv.id)).toBe(true);
        expect(oldReceivables.length).toBeGreaterThan(200);
        console.log('HISTORICAL VERIFIED: A 1 invoice / 2 receipts / 500 + 500; B 4000 + 3000 + 3000; C 300/200 per 500; D cash 500 / bank 500; E refund -100 once; all fixtures rolled back');
        throw rollback;
      }, { timeout: 120000, maxWait: 10000 });
    } catch (error) { if (error !== rollback) throw error; }
    finally { vi.useRealTimers(); holder.tx = null; await db.$disconnect(); }
  }, 150000);
  it('serializes independent database collectors and concurrent retries', async () => {
    const db = new PrismaClient(); holder.db = db; holder.tx = null;
    const marker = 'HIST-CONCURRENCY-' + randomUUID();
    const actor = await db.portalUser.create({ data: { username: marker, passwordHash: 'TEST-NO-LOGIN', role: 'FRONT_DESK_BILLING' } });
    let invoiceId: string | undefined;
    try {
      const inv = await db.hospitalInvoice.create({ data: { invoiceNumber: marker, sourceType: 'WALK_IN', encounterType: 'OPD', total: 1000, subtotal: 1000, patientShare: 1000, createdById: actor.id } });
      invoiceId = inv.id;
      const pay = (amount: number, requestKey: string) => invoicesService.collectPayment(inv.id, { amount, paymentMethod: 'CASH', requestKey }, actor.id);
      const competing = await Promise.allSettled([pay(700, randomUUID()), pay(700, randomUUID())]);
      expect(competing.filter(r => r.status === 'fulfilled')).toHaveLength(1);
      expect(competing.filter(r => r.status === 'rejected')).toHaveLength(1);
      expect(await db.paymentReceipt.count({ where: { hospitalInvoiceId: inv.id } })).toBe(1);
      const requestKey = randomUUID();
      const retries = await Promise.all([pay(300, requestKey), pay(300, requestKey)]);
      expect(retries[0]!.receipt.id).toBe(retries[1]!.receipt.id);
      expect(await db.paymentReceipt.count({ where: { hospitalInvoiceId: inv.id } })).toBe(2);
      const final = await db.hospitalInvoice.findUniqueOrThrow({ where: { id: inv.id } });
      expect(Number(final.paidTotal)).toBe(1000); expect(final.status).toBe('PAID');
      expect(await db.userCashBalance.count({ where: { portalUserId: actor.id } })).toBe(2);
    } finally {
      // Independent connections need committed fixtures; remove only this test's rows.
      await db.$transaction(async tx => {
        await tx.userCashBalance.deleteMany({ where: { portalUserId: actor.id } });
        if (invoiceId) { await tx.paymentReceipt.deleteMany({ where: { hospitalInvoiceId: invoiceId } }); await tx.hospitalInvoice.delete({ where: { id: invoiceId } }); }
        await tx.portalUser.delete({ where: { id: actor.id } });
      });
      holder.db = null; await db.$disconnect();
    }
  }, 30000);
});
