import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const db = vi.hoisted(() => ({
  portalUser: { findUniqueOrThrow: vi.fn() },
  userCashBalance: { findMany: vi.fn() },
  accountSettlement: { findFirst: vi.fn(), findMany: vi.fn() },
}));
vi.mock('@/db/client', () => ({ prisma: db }));
import { cashService } from '@/modules/cash/cash.service';

beforeEach(() => {
  vi.clearAllMocks();
  db.portalUser.findUniqueOrThrow.mockResolvedValue({ role: 'FRONT_DESK_BILLING' });
  db.accountSettlement.findFirst.mockResolvedValue(null);
});

describe('refund and recollection cash position', () => {
  it.each([true, false])('nets refunds for physical cash = %s', async (isPhysicalCash) => {
    const entries = [
      { amount: 2200, direction: 'IN', category: 'COLLECTION' },
      { amount: 1000, direction: 'IN', category: 'COLLECTION' },
      { amount: 1000, direction: 'OUT', category: 'REFUND' },
      { amount: 1000, direction: 'IN', category: 'COLLECTION' },
    ].map((row, index) => ({ ...row, id: String(index), amount: new Decimal(row.amount), isPhysicalCash, isSettled: false, occurredAt: new Date(), paymentReceipt: null }));

    for (const [count, expected] of [[2, 3200], [3, 2200], [4, 3200]]) {
      db.userCashBalance.findMany.mockResolvedValue(entries.slice(0, count));
      const { summary } = await cashService.getCashierBalanceSheet('cashier');
      expect(summary.totalCollections.minus(summary.totalRefunds).toNumber()).toBe(expected);
      expect(summary.expectedPhysicalCash.toNumber()).toBe(isPhysicalCash ? expected : 0);
      expect(summary.nonPhysicalTotal.toNumber()).toBe(isPhysicalCash ? 0 : expected);
      expect(summary.cashCollections.minus(summary.cashRefunds).toNumber()).toBe(isPhysicalCash ? expected : 0);
      expect(summary.unsettledCount).toBe(count);
    }
  });
});
