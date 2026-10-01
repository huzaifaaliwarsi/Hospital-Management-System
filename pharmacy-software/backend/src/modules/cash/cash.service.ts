import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ConflictError, ValidationError } from '@/shared/errors/AppError';
import { nextCode, SEQUENCE } from '@/shared/sequence';
import type { IssuePettyCashBody, BalanceSheetQuery, SubmitSettlementBody, ReviewSettlementBody, ListSettlementsQuery } from './cash.schemas';

/**
 * pharmacy.md §11.2 Expected Cash formula, restated as a running signed
 * ledger (every CashLedgerEntry already carries direction + isPhysicalCash,
 * so "Opening + Received + Collections − Refunds − Previous Settlements ±
 * Adjustments" collapses to: sum of physical-cash entries not yet folded
 * into an accepted settlement). Simpler and structurally can't drift the
 * way hms-backend's scattered formula can (pharmacy.md §19.3).
 */
async function expectedCash(portalUserId: string): Promise<Decimal> {
  const entries = await prisma.cashLedgerEntry.findMany({
    where: { portalUserId, isPhysicalCash: true, isSettled: false },
    select: { direction: true, amount: true },
  });
  return entries.reduce((sum, e) => sum.plus(e.direction === 'IN' ? e.amount : e.amount.negated()), new Decimal(0));
}

export const cashService = {
  expectedCash,

  async issuePettyCash(body: IssuePettyCashBody, issuerId: string) {
    const receiver = await prisma.portalUser.findUnique({ where: { id: body.toUserId } });
    if (!receiver) throw new NotFoundError('Recipient user not found');
    const amount = new Decimal(body.amount);

    return prisma.$transaction(async (tx) => {
      const referenceNo = await nextCode(tx, SEQUENCE.PETTY_CASH);
      const issued = await tx.cashLedgerEntry.create({
        data: { portalUserId: issuerId, direction: 'OUT', amount, category: 'PETTY_CASH_ISSUED', referenceNo, isPhysicalCash: true, note: body.note },
      });
      const received = await tx.cashLedgerEntry.create({
        data: { portalUserId: body.toUserId, direction: 'IN', amount, category: 'PETTY_CASH_RECEIVED', isPhysicalCash: true, issuedById: issuerId, note: body.note },
      });
      return { referenceNo, issued, received };
    });
  },

  async getBalanceSheet(userId: string, query: BalanceSheetQuery) {
    const entries = await prisma.cashLedgerEntry.findMany({
      where: { portalUserId: userId, occurredAt: { gte: query.from, lte: query.to } },
      orderBy: { occurredAt: 'asc' },
    });

    const byCategory = new Map<string, Decimal>();
    for (const e of entries) {
      const signed = e.direction === 'IN' ? e.amount : e.amount.negated();
      byCategory.set(e.category, (byCategory.get(e.category) ?? new Decimal(0)).plus(signed));
    }

    return {
      expectedCash: await expectedCash(userId),
      breakdown: Object.fromEntries(byCategory),
      entries,
    };
  },

  /** pharmacy.md §11.2 — Expected Cash is read-only/system-calculated; user only supplies Physical Cash. */
  async submitSettlement(userId: string, body: SubmitSettlementBody) {
    const expected = await expectedCash(userId);
    const physical = new Decimal(body.physicalCash);
    const variance = physical.minus(expected);
    if (!variance.equals(0) && !body.varianceReason) {
      throw new ValidationError('A non-zero variance requires a reason');
    }

    return prisma.$transaction(async (tx) => {
      const settlementNumber = await nextCode(tx, SEQUENCE.SETTLEMENT);
      return tx.accountSettlement.create({
        data: {
          settlementNumber,
          portalUserId: userId,
          periodFrom: body.periodFrom,
          periodTo: body.periodTo,
          expectedCash: expected,
          physicalCash: physical,
          variance,
          varianceReason: body.varianceReason,
          status: 'SUBMITTED',
        },
      });
    });
  },

  async reviewSettlement(id: string, body: ReviewSettlementBody, reviewerId: string) {
    const settlement = await prisma.accountSettlement.findUnique({ where: { id } });
    if (!settlement) throw new NotFoundError('Settlement not found');
    if (settlement.status !== 'SUBMITTED') throw new ConflictError('This settlement has already been reviewed');

    return prisma.$transaction(async (tx) => {
      if (body.decision === 'ACCEPTED') {
        // Fold every physical-cash entry up to this settlement's period into it — Expected Cash resets to 0 going forward.
        await tx.cashLedgerEntry.updateMany({
          where: { portalUserId: settlement.portalUserId, isPhysicalCash: true, isSettled: false, occurredAt: { lte: settlement.periodTo } },
          data: { isSettled: true },
        });
        await tx.cashLedgerEntry.create({
          data: { portalUserId: settlement.portalUserId, direction: 'OUT', amount: settlement.physicalCash, category: 'SETTLEMENT_HANDOVER', isPhysicalCash: true, isSettled: true, note: body.note },
        });
      }
      return tx.accountSettlement.update({
        where: { id },
        data: { status: body.decision, reviewedById: reviewerId, reviewedAt: new Date(), settlementAmount: body.decision === 'ACCEPTED' ? settlement.physicalCash : 0 },
      });
    });
  },

  async listSettlements(query: ListSettlementsQuery) {
    return prisma.accountSettlement.findMany({
      where: { portalUserId: query.userId, status: query.status },
      include: { submittedByUser: { select: { id: true, fullName: true, username: true } }, reviewedByUser: { select: { id: true, fullName: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 200,
    });
  },
};
