import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { BusinessRuleError } from '@/shared/errors/AppError';
import { resolveDateRange } from '@/modules/reports/dashboard.service';
import type { ListMainFundEntriesQuery, MainFundTransactionBody } from './mainFund.schemas';

const userSummarySelect = { id: true, displayName: true, username: true, role: true } as const;

/** Signed sum of every ledger row — the fund's current balance, always computed at query time (never cached). */
export async function getMainFundBalance(client: Pick<typeof prisma, 'mainCashFundEntry'> = prisma): Promise<Decimal> {
  const rows = await client.mainCashFundEntry.findMany({ select: { direction: true, amount: true } });
  return rows.reduce((sum, r) => (r.direction === 'IN' ? sum.plus(r.amount) : sum.minus(r.amount)), new Decimal(0));
}

/**
 * Hospital's central physical cash reserve ("Main Fund") — the source
 * `financeControl.service.ts`'s `issuePettyCash` debits from. Super Admin
 * deposits into it (money brought in from the bank) and can withdraw from it
 * (money banked back); every petty-cash issuance posts a matching debit here
 * automatically, so the two ledgers (`MainCashFundEntry` and
 * `UserCashBalance`) always move together.
 */
export const mainFundService = {
  async getSummary() {
    const entries = await prisma.mainCashFundEntry.findMany({ select: { direction: true, amount: true, type: true } });

    let currentBalance = new Decimal(0);
    let totalDeposited = new Decimal(0);
    let totalIssued = new Decimal(0);
    let totalWithdrawn = new Decimal(0);
    let totalSettlementReturns = new Decimal(0);

    for (const e of entries) {
      currentBalance = e.direction === 'IN' ? currentBalance.plus(e.amount) : currentBalance.minus(e.amount);

      if (e.type === 'DEPOSIT') totalDeposited = totalDeposited.plus(e.amount);
      else if (e.type === 'PETTY_CASH_ISSUE') totalIssued = totalIssued.plus(e.amount);
      else if (e.type === 'WITHDRAWAL') totalWithdrawn = totalWithdrawn.plus(e.amount);
      else if (e.type === 'SETTLEMENT_RETURN' && e.direction === 'IN') totalSettlementReturns = totalSettlementReturns.plus(e.amount);
    }

    return { currentBalance, totalDeposited, totalIssued, totalWithdrawn, totalSettlementReturns, entryCount: entries.length };
  },

  async listEntries(query: ListMainFundEntriesQuery) {
    const range =
      query.preset === 'all'
        ? null
        : resolveDateRange({ preset: query.preset, fromDate: query.fromDate, toDate: query.toDate });
    const period = range
      ? { label: range.label, start: range.start.toISOString(), end: range.end.toISOString() }
      : { label: 'All Time', start: null, end: null };

    const entries = await prisma.mainCashFundEntry.findMany({
      where: {
        ...(range ? { occurredAt: { gte: range.start, lte: range.end } } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      include: { performedByUser: { select: userSummarySelect } },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });

    return { period, entries };
  },

  async deposit(body: MainFundTransactionBody, actorPortalUserId: string) {
    return prisma.mainCashFundEntry.create({
      data: {
        direction: 'IN',
        amount: body.amount,
        type: 'DEPOSIT',
        note: body.note,
        performedById: actorPortalUserId,
      },
      include: { performedByUser: { select: userSummarySelect } },
    });
  },

  async withdraw(body: MainFundTransactionBody, actorPortalUserId: string) {
    const balance = await getMainFundBalance();
    if (balance.lessThan(body.amount)) {
      throw new BusinessRuleError(`Insufficient Main Fund balance — PKR ${balance.toFixed(2)} available.`);
    }
    return prisma.mainCashFundEntry.create({
      data: {
        direction: 'OUT',
        amount: body.amount,
        type: 'WITHDRAWAL',
        note: body.note,
        performedById: actorPortalUserId,
      },
      include: { performedByUser: { select: userSummarySelect } },
    });
  },
};
