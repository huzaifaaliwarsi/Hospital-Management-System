import { prisma } from '@/db/client';
import { ConflictError, NotFoundError } from '@/shared/errors/AppError';
import { postStaffPaymentCash } from './staffPaymentCash';
import { salaryBalance } from '@/modules/payroll/payroll.balance';
import { commissionBalance } from '@/modules/commission/commission.calc';

export async function reverseStaffPayment(kind: 'SALARY' | 'COMMISSION', paymentId: string, reason: string, actorId: string) {
  return prisma.$transaction(async tx => {
    if (kind === 'SALARY') {
      const payment = await tx.salaryPayment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundError('Salary payment not found');
      await tx.$queryRaw`SELECT id FROM salary_slips WHERE id = ${payment.salarySlipId} FOR UPDATE`;
      if (payment.amount.lte(0) || payment.reversalOfId) throw new ConflictError('Only an original positive payment can be reversed.');
      const previous = await tx.salaryPayment.findUnique({ where: { reversalOfId: paymentId } });
      if (previous) return previous;
      const cashEntryId = await postStaffPaymentCash(tx, actorId, payment.amount.negated(), payment.method, 'SALARY_PAYMENT', `Salary payment reversal ${paymentId}: ${reason}`, payment.cashEntryId);
      const reversal = await tx.salaryPayment.create({ data: {
        salarySlipId: payment.salarySlipId, amount: payment.amount.negated(), method: payment.method,
        reference: payment.reference, reversalOfId: paymentId, reversalReason: reason, paidById: actorId, cashEntryId,
      } });
      const slip = await tx.salarySlip.findUniqueOrThrow({ where: { id: payment.salarySlipId }, include: { payments: true, correctionEntries: true } });
      const balance = salaryBalance(slip);
      await tx.salarySlip.update({ where: { id: slip.id }, data: { status: balance.paid.gte(balance.payable) ? 'PAID' : balance.paid.gt(0) ? 'PARTIALLY_PAID' : 'APPROVED' } });
      return reversal;
    }
    const payment = await tx.commissionPayout.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError('Commission payout not found');
    await tx.$queryRaw`SELECT id FROM doctor_commission_accruals WHERE id = ${payment.doctorCommissionAccrualId} FOR UPDATE`;
    if (payment.amount.lte(0) || payment.reversalOfId) throw new ConflictError('Only an original positive payment can be reversed.');
    const previous = await tx.commissionPayout.findUnique({ where: { reversalOfId: paymentId } });
    if (previous) return previous;
    const cashEntryId = await postStaffPaymentCash(tx, actorId, payment.amount.negated(), payment.method, 'COMMISSION_PAYMENT', `Commission payout reversal ${paymentId}: ${reason}`, payment.cashEntryId);
    const reversal = await tx.commissionPayout.create({ data: {
      doctorCommissionAccrualId: payment.doctorCommissionAccrualId, amount: payment.amount.negated(), method: payment.method,
      reference: payment.reference, reversalOfId: paymentId, reversalReason: reason, paidById: actorId, cashEntryId,
    } });
    const accrual = await tx.doctorCommissionAccrual.findUniqueOrThrow({ where: { id: payment.doctorCommissionAccrualId }, include: { payouts: true, reversals: true, adjustments: true } });
    const balance = commissionBalance(accrual);
    await tx.doctorCommissionAccrual.update({ where: { id: accrual.id }, data: { status: balance.paid.gte(balance.payable) ? 'PAID' : balance.paid.gt(0) ? 'PARTIALLY_PAID' : 'APPROVED' } });
    return reversal;
  });
}
