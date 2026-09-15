import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { ValidationError } from '@/shared/errors/AppError';
import type { SubmitSettlementBody } from './settlement.schemas';

/**
 * My Account Settlement (HMS_V7.2_NEW_REQUIREMENTS.md §3.3) — closes out a
 * cashier's shift: every currently-unsettled `UserCashBalance` row (the same
 * ledger `cashService.getCashierBalanceSheet` reads) is bundled into one
 * `AccountSettlement`, variance is computed against the cashier's own
 * physical count, and those rows flip `isSettled = true` so they never
 * appear on a future balance sheet or settlement again.
 *
 * Scoped to `moduleScope: 'BILLING'` — the only scope a Front Desk cashier
 * ever writes to. Review/approval of a submitted settlement (Admin/Super
 * Admin side) is a separate, not-yet-built screen; this only covers the
 * cashier's own submit + history.
 */
export const settlementService = {
  async submitSettlement(portalUserId: string, body: SubmitSettlementBody) {
    return prisma.$transaction(async (tx) => {
      const unsettled = await tx.userCashBalance.findMany({
        where: { portalUserId, isSettled: false },
        orderBy: { occurredAt: 'asc' },
      });
      if (unsettled.length === 0) {
        throw new ValidationError('No unsettled transactions to settle.');
      }

      let physicalCashIn = new Decimal(0);
      let physicalCashOut = new Decimal(0);
      for (const t of unsettled) {
        if (t.isPhysicalCash) {
          if (t.direction === 'IN') physicalCashIn = physicalCashIn.plus(t.amount);
          else physicalCashOut = physicalCashOut.plus(t.amount);
        }
      }
      const expectedCash = physicalCashIn.minus(physicalCashOut);
      const physicalCash = new Decimal(body.physicalCash);
      const variance = physicalCash.minus(expectedCash);

      if (!variance.isZero() && !body.varianceReason?.trim()) {
        throw new ValidationError(
          `Physical cash (${physicalCash.toString()}) does not match expected cash (${expectedCash.toString()}) — a variance reason is required.`,
        );
      }

      const occurredDates = unsettled.map((t) => t.occurredAt.getTime());
      const periodStart = new Date(Math.min(...occurredDates));
      const periodEnd = new Date(Math.max(...occurredDates));

      const settlement = await tx.accountSettlement.create({
        data: {
          portalUserId,
          moduleScope: 'BILLING',
          periodStart,
          periodEnd,
          expectedCash,
          physicalCash,
          variance,
          varianceReason: body.varianceReason?.trim() || null,
          handoverAmount: body.handoverAmount != null ? new Decimal(body.handoverAmount) : null,
          carryForwardAmount: new Decimal(0),
          status: 'SUBMITTED',
          submittedAt: new Date(),
          remarks: body.remarks?.trim() || null,
        },
      });

      await tx.settlementTransaction.createMany({
        data: unsettled.map((t) => ({ accountSettlementId: settlement.id, userCashBalanceId: t.id })),
      });

      await tx.userCashBalance.updateMany({
        where: { id: { in: unsettled.map((t) => t.id) } },
        data: { isSettled: true },
      });

      return settlement;
    });
  },

  async listMySettlements(portalUserId: string) {
    return prisma.accountSettlement.findMany({
      where: { portalUserId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },
};
