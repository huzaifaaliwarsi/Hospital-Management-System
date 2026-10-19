import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ValidationError } from '@/shared/errors/AppError';
import { resolveCashModuleScope } from './moduleScope.util';

/** The caller's payroll/commission route authorization establishes permission.
 * Custody always belongs to the actual payer, never the employee or a cashier
 * chosen by the client. Existing module scope and settlement rules stay intact. */
export async function postStaffPaymentCash(tx: Prisma.TransactionClient, actorId: string,
  amount: Decimal, method: string, category: 'SALARY_PAYMENT' | 'COMMISSION_PAYMENT', note: string,
  originalCashEntryId?: string | null) {
  if (method !== 'CASH') return null; // No canonical hospital bank account ledger exists.
  const original = originalCashEntryId ? await tx.userCashBalance.findUniqueOrThrow({ where: { id: originalCashEntryId } }) : null;
  if (amount.lt(0) && !original) return null; // Historical unlinked payouts never debited custody: do not invent a credit.
  const payerId = original?.portalUserId ?? actorId;
  await tx.$queryRaw`SELECT id FROM portal_users WHERE id = ${payerId} FOR UPDATE`;
  const payer = await tx.portalUser.findUniqueOrThrow({ where: { id: payerId }, select: { role: true } });
  if (!amount.isFinite() || amount.isZero()) throw new ValidationError('Payment amount must be nonzero.');
  const entry = await tx.userCashBalance.create({ data: {
    portalUserId: payerId, moduleScope: original?.moduleScope ?? resolveCashModuleScope(payer.role),
    amount: amount.abs(), direction: amount.gt(0) ? 'OUT' : 'IN', category,
    isPhysicalCash: true, issuedById: actorId, note,
  } });
  return entry.id;
}
