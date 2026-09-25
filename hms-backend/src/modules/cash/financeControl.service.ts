import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError, BusinessRuleError } from '@/shared/errors/AppError';
import { resolveDateRange } from '@/modules/reports/dashboard.service';
import type {
  ListBalanceSheetsQuery,
  ListSettlementsQuery,
  FinanceKpisQuery,
  ReviewSettlementBody,
  ReverseSettlementBody,
} from './financeControl.schemas';

const userSummarySelect = { id: true, displayName: true, username: true, role: true } as const;

const REVIEW_ACTION_TO_STATUS = {
  ACCEPT: 'ACCEPTED',
  PARTIALLY_ACCEPT: 'PARTIALLY_ACCEPTED',
  RETURN: 'RETURNED',
  REJECT: 'REJECTED',
} as const;

/**
 * Every cash-handling user's CURRENT outstanding liability — their most
 * recent non-REVERSED settlement's `carryForwardAmount` (same lookup
 * `settlementService.submitSettlement` and `cashService.getCashierBalanceSheet`
 * use). Not date-range scoped: a shortfall from last week still shows up
 * today until it's actually settled, same as guide §5.1's "carried as
 * unsettled" semantics.
 */
async function getLatestCarryForwardsByUser(portalUserId?: string) {
  const rows = await prisma.accountSettlement.findMany({
    where: {
      moduleScope: 'BILLING',
      status: { not: 'REVERSED' },
      ...(portalUserId ? { portalUserId } : {}),
    },
    distinct: ['portalUserId'],
    orderBy: [{ portalUserId: 'asc' }, { createdAt: 'desc' }],
    select: { portalUserId: true, carryForwardAmount: true, submittedByUser: { select: userSummarySelect } },
  });

  const map = new Map<string, { amount: Decimal; user: { id: string; displayName: string | null; username: string; role: string } }>();
  for (const r of rows) {
    map.set(r.portalUserId, { amount: r.carryForwardAmount, user: r.submittedByUser });
  }
  return map;
}

/**
 * Admin / Super Admin "Finance Control" oversight (Balance Sheet & Account
 * Settlement Guide §6) — sits alongside `cash.service.ts` (a user's own
 * balance sheet) and `settlement.service.ts` (a user's own settlement
 * submission), but reads *across every cash-handling user* instead of the
 * one attached to the request. Scoped to `moduleScope: 'BILLING'` only —
 * Inventory's own petty-cash sheet is out of scope for this phase (see
 * `Balance_sheet&Account_settlement.md`).
 */
export const financeControlService = {
  async listBalanceSheets(query: ListBalanceSheetsQuery) {
    const { start, end, label } = resolveDateRange(query);

    const [rows, carryForwards] = await Promise.all([
      prisma.userCashBalance.findMany({
        where: {
          moduleScope: 'BILLING',
          occurredAt: { gte: start, lte: end },
          ...(query.portalUserId ? { portalUserId: query.portalUserId } : {}),
        },
        include: { portalUser: { select: userSummarySelect } },
        orderBy: { occurredAt: 'desc' },
      }),
      getLatestCarryForwardsByUser(query.portalUserId),
    ]);

    type Bucket = {
      portalUserId: string;
      user: { id: string; displayName: string | null; username: string; role: string };
      physicalCashIn: Decimal;
      physicalCashOut: Decimal;
      nonPhysicalTotal: Decimal;
      totalCollections: Decimal;
      totalRefunds: Decimal;
      settledCount: number;
      unsettledCount: number;
    };
    const byUser = new Map<string, Bucket>();

    for (const row of rows) {
      let bucket = byUser.get(row.portalUserId);
      if (!bucket) {
        bucket = {
          portalUserId: row.portalUserId,
          user: row.portalUser,
          physicalCashIn: new Decimal(0),
          physicalCashOut: new Decimal(0),
          nonPhysicalTotal: new Decimal(0),
          totalCollections: new Decimal(0),
          totalRefunds: new Decimal(0),
          settledCount: 0,
          unsettledCount: 0,
        };
        byUser.set(row.portalUserId, bucket);
      }

      if (row.isPhysicalCash) {
        if (row.direction === 'IN') {
          bucket.physicalCashIn = bucket.physicalCashIn.plus(row.amount);
          if (row.category === 'COLLECTION') bucket.totalCollections = bucket.totalCollections.plus(row.amount);
        } else {
          bucket.physicalCashOut = bucket.physicalCashOut.plus(row.amount);
          if (row.category === 'REFUND') bucket.totalRefunds = bucket.totalRefunds.plus(row.amount);
        }
      } else {
        bucket.nonPhysicalTotal = bucket.nonPhysicalTotal.plus(row.amount);
        if (row.category === 'COLLECTION') bucket.totalCollections = bucket.totalCollections.plus(row.amount);
        else if (row.category === 'REFUND') bucket.totalRefunds = bucket.totalRefunds.plus(row.amount);
      }
      if (row.isSettled) bucket.settledCount += 1;
      else bucket.unsettledCount += 1;
    }

    // A user can owe a carry-forward liability with zero NEW activity in
    // this period — they still need a row, or their debt goes invisible.
    for (const [portalUserId, cf] of carryForwards) {
      if (!byUser.has(portalUserId) && !cf.amount.isZero()) {
        byUser.set(portalUserId, {
          portalUserId,
          user: cf.user,
          physicalCashIn: new Decimal(0),
          physicalCashOut: new Decimal(0),
          nonPhysicalTotal: new Decimal(0),
          totalCollections: new Decimal(0),
          totalRefunds: new Decimal(0),
          settledCount: 0,
          unsettledCount: 0,
        });
      }
    }

    const sheets = Array.from(byUser.values())
      .map((b) => {
        const carriedForwardAmount = carryForwards.get(b.portalUserId)?.amount ?? new Decimal(0);
        return {
          portalUserId: b.portalUserId,
          user: b.user,
          carriedForwardAmount,
          expectedPhysicalCash: b.physicalCashIn.minus(b.physicalCashOut).plus(carriedForwardAmount),
          nonPhysicalTotal: b.nonPhysicalTotal,
          totalCollections: b.totalCollections,
          totalRefunds: b.totalRefunds,
          settledCount: b.settledCount,
          unsettledCount: b.unsettledCount,
        };
      })
      .filter((b) => !query.onlyUnsettled || b.unsettledCount > 0 || !b.carriedForwardAmount.isZero())
      .sort((a, b) => b.expectedPhysicalCash.comparedTo(a.expectedPhysicalCash));

    return { period: { label, start: start.toISOString(), end: end.toISOString() }, sheets };
  },

  async listSettlements(query: ListSettlementsQuery) {
    const { start, end, label } = resolveDateRange(query);

    const rows = await prisma.accountSettlement.findMany({
      where: {
        moduleScope: 'BILLING',
        submittedAt: { gte: start, lte: end },
        ...(query.status ? { status: query.status } : {}),
        ...(query.portalUserId ? { portalUserId: query.portalUserId } : {}),
      },
      include: {
        submittedByUser: { select: userSummarySelect },
        reviewedByUser: { select: userSummarySelect },
        reversedByUser: { select: userSummarySelect },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return { period: { label, start: start.toISOString(), end: end.toISOString() }, settlements: rows };
  },

  async reviewSettlement(id: string, body: ReviewSettlementBody, reviewerPortalUserId: string) {
    const settlement = await prisma.accountSettlement.findUnique({ where: { id } });
    if (!settlement) throw new NotFoundError('Settlement not found');
    if (settlement.status !== 'SUBMITTED') {
      throw new BusinessRuleError(`Only a SUBMITTED settlement can be reviewed (current status: ${settlement.status}).`);
    }

    return prisma.accountSettlement.update({
      where: { id },
      data: {
        status: REVIEW_ACTION_TO_STATUS[body.action],
        reviewedById: reviewerPortalUserId,
        reviewedAt: new Date(),
        ...(body.remarks?.trim() ? { remarks: body.remarks.trim() } : {}),
      },
    });
  },

  /**
   * Reverses a posted settlement — never edits or deletes the original
   * amounts (Guide §4.2, §12 rule 3). The underlying `UserCashBalance` rows
   * that were locked into this settlement go back to `isSettled: false` so
   * the money reappears on the owning cashier's balance sheet and can be
   * re-settled — a reversal must never make custody disappear.
   */
  async reverseSettlement(id: string, body: ReverseSettlementBody, actorPortalUserId: string) {
    const settlement = await prisma.accountSettlement.findUnique({ where: { id } });
    if (!settlement) throw new NotFoundError('Settlement not found');
    if (settlement.status !== 'ACCEPTED' && settlement.status !== 'PARTIALLY_ACCEPTED') {
      throw new BusinessRuleError('Only an ACCEPTED or PARTIALLY_ACCEPTED settlement can be reversed.');
    }
    if (!body.reason.trim()) throw new ValidationError('A reversal reason is required.');

    return prisma.$transaction(async (tx) => {
      const reversed = await tx.accountSettlement.update({
        where: { id },
        data: {
          status: 'REVERSED',
          reversalReason: body.reason.trim(),
          reversedById: actorPortalUserId,
          reversedAt: new Date(),
        },
      });

      const links = await tx.settlementTransaction.findMany({
        where: { accountSettlementId: id },
        select: { userCashBalanceId: true },
      });
      if (links.length > 0) {
        await tx.userCashBalance.updateMany({
          where: { id: { in: links.map((l) => l.userCashBalanceId) } },
          data: { isSettled: false },
        });
      }

      return reversed;
    });
  },

  /** Guide §6.3 KPI set — hospital-wide, scoped to `moduleScope: 'BILLING'`. */
  async getFinanceKpis(query: FinanceKpisQuery) {
    const { start, end, label } = resolveDateRange(query);
    const dateFilter = { gte: start, lte: end };

    const [collectionRows, refundRows, allTimeUnsettled, settlementsInRange, carryForwards] = await Promise.all([
      prisma.userCashBalance.findMany({
        where: { moduleScope: 'BILLING', category: 'COLLECTION', direction: 'IN', occurredAt: dateFilter },
        select: { amount: true, isPhysicalCash: true, paymentReceipt: { select: { method: true } } },
      }),
      prisma.userCashBalance.findMany({
        where: { moduleScope: 'BILLING', category: 'REFUND', direction: 'OUT', occurredAt: dateFilter },
        select: { amount: true },
      }),
      prisma.userCashBalance.findMany({
        where: { moduleScope: 'BILLING', isSettled: false },
        select: { amount: true, direction: true, isPhysicalCash: true, portalUserId: true },
      }),
      prisma.accountSettlement.findMany({
        where: { moduleScope: 'BILLING', submittedAt: dateFilter },
        select: { status: true, variance: true, expectedCash: true, physicalCash: true },
      }),
      getLatestCarryForwardsByUser(),
    ]);

    let totalCashCollectedToday = new Decimal(0);
    const byMethod: Record<string, Decimal> = { CARD: new Decimal(0), BANK: new Decimal(0), ONLINE: new Decimal(0) };
    for (const c of collectionRows) {
      if (c.isPhysicalCash) {
        totalCashCollectedToday = totalCashCollectedToday.plus(c.amount);
      } else {
        const method = c.paymentReceipt?.method ?? 'CARD';
        if (!byMethod[method]) byMethod[method] = new Decimal(0);
        byMethod[method] = byMethod[method].plus(c.amount);
      }
    }
    const totalNonCashCollectedToday = Object.values(byMethod).reduce((s, v) => s.plus(v), new Decimal(0));
    const totalRefundsToday = refundRows.reduce((s, r) => s.plus(r.amount), new Decimal(0));

    let totalUnsettledCash = new Decimal(0);
    const usersPendingSettlement = new Set<string>();
    for (const u of allTimeUnsettled) {
      if (u.isPhysicalCash) {
        totalUnsettledCash = u.direction === 'IN' ? totalUnsettledCash.plus(u.amount) : totalUnsettledCash.minus(u.amount);
      }
      usersPendingSettlement.add(u.portalUserId);
    }
    // Carry-forward liabilities (Guide §5.1) — money already accounted for
    // in a past settlement's shortfall, still outstanding today even if the
    // user has zero raw unsettled transactions right now.
    for (const [portalUserId, cf] of carryForwards) {
      if (cf.amount.isZero()) continue;
      totalUnsettledCash = totalUnsettledCash.plus(cf.amount);
      usersPendingSettlement.add(portalUserId);
    }

    let totalExpectedCash = new Decimal(0);
    let totalSettledCash = new Decimal(0);
    let settlementsCompletedToday = 0;
    let settlementDifferences = 0;
    for (const s of settlementsInRange) {
      totalExpectedCash = totalExpectedCash.plus(s.expectedCash);
      if (s.status === 'ACCEPTED' || s.status === 'PARTIALLY_ACCEPTED') {
        totalSettledCash = totalSettledCash.plus(s.physicalCash);
        settlementsCompletedToday += 1;
      }
      if (!s.variance.isZero()) settlementDifferences += 1;
    }

    return {
      period: { label, start: start.toISOString(), end: end.toISOString() },
      totalCashCollectedToday,
      totalNonCashCollectedToday,
      collectionsByMethod: byMethod,
      totalRefundsToday,
      totalExpectedCash,
      totalSettledCash,
      totalUnsettledCash,
      usersPendingSettlementCount: usersPendingSettlement.size,
      settlementDifferencesCount: settlementDifferences,
      settlementsCompletedTodayCount: settlementsCompletedToday,
    };
  },
};
