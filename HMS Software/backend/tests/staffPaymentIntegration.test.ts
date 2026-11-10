import 'dotenv/config';
import { expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
const holder = vi.hoisted(() => ({ tx: null as any }));
vi.mock('@/db/client', () => ({ prisma: new Proxy({}, { get: (_, key) => key === '$transaction' ? (fn: any) => fn(holder.tx) : holder.tx[key] }) }));
import { payrollService } from '@/modules/payroll/payroll.service';
import { commissionService } from '@/modules/commission/commission.service';
import { reverseStaffPayment } from '@/modules/cash/staffPaymentReversal';
import { staffFinanceSummary } from '@/modules/reports/staffFinanceSummary';

it.runIf(process.env.HMS_PAYROLL_DB_TEST === '1')('real cash postings, retries, reversals and summary reconcile without saved test records', async () => {
  const db = new PrismaClient(), marker = `STAFF-FIN-${randomUUID()}`, rollback = new Error('ROLLBACK');
  try {
    await db.$transaction(async tx => {
      holder.tx = tx;
      const actor = await tx.portalUser.findFirstOrThrow({ where: { role: 'SUPER_ADMIN' } });
      const dept = await tx.department.create({ data: { code: marker, name: marker, departmentType: 'CLINICAL' } });
      const now = new Date(), start = new Date(now.getTime() - 60000);
      const staff = await tx.staff.create({ data: { employeeId: marker, fullName: marker, category: 'Doctor', phone: '03000000000', joiningDate: now, staffDepartments: { create: { departmentId: dept.id } } } });
      const slip = await tx.salarySlip.create({ data: { staffId: staff.id, periodType: 'MONTHLY', periodStart: now, periodEnd: now, baseAmount: 2000, generatedAmount: 2000, status: 'APPROVED', approvedAt: now, approvedById: actor.id, componentBreakdown: {}, calculationSnapshot: {} } });
      const body = { amount: 900, method: 'CASH' as const, requestKey: randomUUID() };
      await payrollService.paySlip(slip.id, body, actor.id);
      await payrollService.paySlip(slip.id, body, actor.id);
      expect(await tx.salaryPayment.count({ where: { salarySlipId: slip.id } })).toBe(1);
      const payment = await tx.salaryPayment.findFirstOrThrow({ where: { salarySlipId: slip.id }, include: { cashEntry: true } });
      expect(payment.cashEntry).toMatchObject({ portalUserId: actor.id, category: 'SALARY_PAYMENT', direction: 'OUT', isPhysicalCash: true });
      expect(payment.cashEntry!.amount.toNumber()).toBe(900);
      await expect(payrollService.paySlip(slip.id, { ...body, amount: 800 }, actor.id)).rejects.toThrow('different payment');
      await expect(payrollService.paySlip(slip.id, { ...body, requestKey: randomUUID(), amount: 2000 }, actor.id)).rejects.toThrow('exceeds');
      const bank = await payrollService.paySlip(slip.id, { amount: 200, method: 'BANK', requestKey: randomUUID() }, actor.id);
      expect(bank.balance.remaining.toNumber()).toBe(900);
      const cashCount = await tx.userCashBalance.count({ where: { salaryPayment: { salarySlipId: slip.id } } });
      expect(cashCount).toBe(1);
      await reverseStaffPayment('SALARY', payment.id, 'Test returned salary', actor.id);
      await reverseStaffPayment('SALARY', payment.id, 'Test returned salary', actor.id);
      expect(await tx.salaryPayment.count({ where: { salarySlipId: slip.id } })).toBe(3);
      const cashEntries = await tx.userCashBalance.findMany({ where: { salaryPayment: { salarySlipId: slip.id } } });
      expect(cashEntries.reduce((s, r) => s + (r.direction === 'IN' ? 1 : -1) * r.amount.toNumber(), 0)).toBe(0);

      const invoice = await tx.hospitalInvoice.create({ data: { invoiceNumber: marker, sourceType: 'WALK_IN', departmentId: dept.id, createdById: actor.id } });
      const line = await tx.invoiceLineItem.create({ data: { hospitalInvoiceId: invoice.id, descriptionSnapshot: marker, quantity: 1, rateSnapshot: 1000, lineGross: 1000, lineNet: 1000, isCompleted: true, performedByStaffId: staff.id } });
      const accrual = await tx.doctorCommissionAccrual.create({ data: { staffId: staff.id, invoiceLineItemId: line.id, periodType: 'DAILY', periodStart: now, periodEnd: now, commissionAmount: 500, ruleSnapshot: {}, status: 'APPROVED', approvedAt: now, approvedById: actor.id } });
      const payoutBody = { amount: 500, method: 'CASH' as const, requestKey: randomUUID() };
      await commissionService.payAccrual(accrual.id, payoutBody, actor.id);
      await commissionService.payAccrual(accrual.id, payoutBody, actor.id); // Retry succeeds even after PAID.
      expect(await tx.commissionPayout.count({ where: { doctorCommissionAccrualId: accrual.id } })).toBe(1);
      const payout = await tx.commissionPayout.findFirstOrThrow({ where: { doctorCommissionAccrualId: accrual.id }, include: { cashEntry: true } });
      expect(payout.cashEntry).toMatchObject({ portalUserId: actor.id, category: 'COMMISSION_PAYMENT', direction: 'OUT' });
      let summary = await staffFinanceSummary(start, new Date(), dept.id);
      expect(summary.salaryGenerated.toNumber()).toBe(2000);
      expect(summary.salaryPaid.toNumber()).toBe(200);
      expect(summary.salaryOutstanding.toNumber()).toBe(1800);
      expect(summary.commissionGenerated.toNumber()).toBe(500);
      expect(summary.commissionPaid.toNumber()).toBe(500);
      expect(summary.commissionOutstanding.toNumber()).toBe(0);
      await reverseStaffPayment('COMMISSION', payout.id, 'Test returned payout', actor.id);
      summary = await staffFinanceSummary(start, new Date(), dept.id);
      expect(summary.commissionPaid.toNumber()).toBe(0);
      expect(summary.commissionOutstanding.toNumber()).toBe(500);
      // Historical payment stays reportable, but its reversal must not invent a cash credit.
      const legacy = await tx.salaryPayment.create({ data: { salarySlipId: slip.id, amount: 50, method: 'CASH', paidById: actor.id } });
      const legacyReversal = await reverseStaffPayment('SALARY', legacy.id, 'Historical correction', actor.id);
      expect(legacyReversal.cashEntryId).toBeNull();
      throw rollback;
    }, { timeout: 30000 });
  } catch (err) { if (err !== rollback) throw err; }
  finally { holder.tx = null; await db.$disconnect(); }
  const check = new PrismaClient();
  try { expect(await check.staff.count({ where: { employeeId: marker } })).toBe(0); }
  finally { await check.$disconnect(); }
}, 40000);
