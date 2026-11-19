import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const db = vi.hoisted(() => ({
  portalUser: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  userCashBalance: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  accountSettlement: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  settlementTransaction: {
    findMany: vi.fn(),
  },
  mainCashFundEntry: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/db/client', () => ({ prisma: db }));
vi.mock('@/shared/mainFundLock', () => ({ lockMainFund: vi.fn().mockResolvedValue(undefined) }));

import { financeControlService } from '@/modules/cash/financeControl.service';
import { cashService } from '@/modules/cash/cash.service';

describe('HMS Cash Settlement Acceptance & Admin Balance Sheet Cash IN', () => {
  const cashierId = 'user-cashier-1';
  const adminId = 'user-admin-1';
  const reviewerUser = { id: adminId, username: 'admin1', displayName: 'Administrator', role: 'ADMIN' };
  const cashierUser = { id: cashierId, username: 'cashier1', displayName: 'Front Desk Cashier', role: 'FRONT_DESK_BILLING' };

  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (callback: any) => callback(db));
  });

  describe('Check 1 & 2: Approver/Receiver Verification & Exactly-Once Posting', () => {
    it('verifies reviewer and receiver identities separately and rejects unknown reviewer', async () => {
      db.portalUser.findUnique.mockResolvedValueOnce(null); // Reviewer not found

      await expect(
        financeControlService.reviewSettlement('set-1', { action: 'ACCEPT' }, 'unknown-user'),
      ).rejects.toThrow('Reviewer portal user not found');
    });

    it('rejects unknown explicit receiver', async () => {
      db.portalUser.findUnique
        .mockResolvedValueOnce(reviewerUser) // Reviewer found
        .mockResolvedValueOnce(null); // Explicit receiver not found

      await expect(
        financeControlService.reviewSettlement(
          'set-1',
          { action: 'ACCEPT', receiverPortalUserId: '00000000-0000-0000-0000-000000000000' },
          adminId,
        ),
      ).rejects.toThrow('Receiver portal user not found');
    });

    it('on settlement acceptance, posts sender Cash OUT and actual receiver Cash IN exactly once', async () => {
      db.portalUser.findUnique.mockResolvedValue(reviewerUser);
      const mockSettlement = {
        id: 'set-80',
        portalUserId: cashierId,
        moduleScope: 'BILLING',
        status: 'SUBMITTED',
        physicalCash: new Decimal(80),
        handoverAmount: new Decimal(80),
        submittedByUser: cashierUser,
      };
      db.accountSettlement.findUnique.mockResolvedValue(mockSettlement);
      db.accountSettlement.update.mockResolvedValue({
        ...mockSettlement,
        status: 'ACCEPTED',
        reviewedById: adminId,
        reviewedAt: new Date('2026-11-19T10:00:00Z'),
      });

      await financeControlService.reviewSettlement('set-80', { action: 'ACCEPT' }, adminId);

      // Central hospital fund received the 80
      expect(db.mainCashFundEntry.create).toHaveBeenCalledTimes(1);
      expect(db.mainCashFundEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'IN',
          amount: new Decimal(80),
          type: 'SETTLEMENT_RETURN',
          performedById: adminId,
          relatedAccountSettlementId: 'set-80',
        }),
      });

      // Exactly 2 UserCashBalance entries posted: 1 OUT for Sender, 1 IN for Receiver
      expect(db.userCashBalance.create).toHaveBeenCalledTimes(2);

      // 1. Sender Cash OUT
      expect(db.userCashBalance.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          portalUserId: cashierId,
          moduleScope: 'BILLING',
          direction: 'OUT',
          amount: new Decimal(80),
          category: 'RECOVERY',
          isPhysicalCash: true,
          isSettled: true,
          issuedById: adminId,
          note: expect.stringContaining('Settlement handover to Administrator'),
        }),
      });

      // 2. Receiver Cash IN (unsettled in Admin drawer)
      expect(db.userCashBalance.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          portalUserId: adminId,
          moduleScope: 'BILLING',
          direction: 'IN',
          amount: new Decimal(80),
          category: 'RECOVERY',
          isPhysicalCash: true,
          isSettled: false,
          issuedById: cashierId,
          note: expect.stringContaining('Settlement received from Front Desk Cashier (Approved by Administrator)'),
        }),
      });
    });
  });

  describe('Check 4: Pending / Rejected settlements do not alter balances', () => {
    it('restores cashier transactions to unsettled on REJECT or RETURN without posting cash entries', async () => {
      db.portalUser.findUnique.mockResolvedValue(reviewerUser);
      const mockSettlement = {
        id: 'set-80',
        portalUserId: cashierId,
        moduleScope: 'BILLING',
        status: 'SUBMITTED',
        physicalCash: new Decimal(80),
        handoverAmount: new Decimal(80),
        submittedByUser: cashierUser,
      };
      db.accountSettlement.findUnique.mockResolvedValue(mockSettlement);
      db.accountSettlement.update.mockResolvedValue({
        ...mockSettlement,
        status: 'REJECTED',
        reviewedById: adminId,
        reviewedAt: new Date(),
      });
      db.settlementTransaction.findMany.mockResolvedValue([
        { userCashBalanceId: 'tx-1' },
        { userCashBalanceId: 'tx-2' },
      ]);

      await financeControlService.reviewSettlement('set-80', { action: 'REJECT', remarks: 'Recount needed' }, adminId);

      // Cashier transactions restored to isSettled: false
      expect(db.userCashBalance.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['tx-1', 'tx-2'] } },
        data: { isSettled: false },
      });

      // Zero cash created for Admin or Fund
      expect(db.userCashBalance.create).not.toHaveBeenCalled();
      expect(db.mainCashFundEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('Check 3 & 5: Admin Balance Sheet Ledger, Totals & Income/Expense Isolation', () => {
    it('shows received Rs. 80 in expectedPhysicalCash and physicalCashIn, without inflating collections/expenses', async () => {
      db.portalUser.findUniqueOrThrow.mockResolvedValue(reviewerUser);
      db.accountSettlement.findFirst.mockResolvedValue(null);

      // Admin has received Rs. 80 settlement cash
      const adminTransactions = [
        {
          id: 'admin-tx-1',
          portalUserId: adminId,
          moduleScope: 'BILLING',
          direction: 'IN',
          amount: new Decimal(80),
          category: 'RECOVERY',
          isPhysicalCash: true,
          isSettled: false,
          occurredAt: new Date('2026-11-19T10:00:00Z'),
          note: 'Settlement received from Front Desk Cashier (Approved by Administrator) [settlement:set-80]',
          paymentReceipt: null,
        },
      ];
      db.userCashBalance.findMany.mockResolvedValue(adminTransactions);

      // 1. Shift View (Live drawer)
      const shiftResult = await cashService.getCashierBalanceSheet(adminId);

      expect(shiftResult.summary.expectedPhysicalCash.toNumber()).toBe(80);
      expect(shiftResult.summary.physicalCashIn.toNumber()).toBe(80);
      expect(shiftResult.summary.physicalCashOut.toNumber()).toBe(0);
      expect(shiftResult.summary.remainingAmount.toNumber()).toBe(80);
      expect(shiftResult.summary.unsettledCount).toBe(1);

      // Crucial Check 5: Pure balance sheet custody transfer — never counted as revenue, collection or petty cash
      expect(shiftResult.summary.totalCollections.toNumber()).toBe(0);
      expect(shiftResult.summary.cashCollections.toNumber()).toBe(0);
      expect(shiftResult.summary.pettyCash.toNumber()).toBe(0);
      expect(shiftResult.summary.cashExpenses.toNumber()).toBe(0);

      // Transactions array includes the settlement row with proper UI labels
      expect(shiftResult.transactions).toHaveLength(1);
      expect(shiftResult.transactions[0]).toEqual(
        expect.objectContaining({
          direction: 'IN',
          amount: new Decimal(80),
          category: 'RECOVERY',
          isPhysicalCash: true,
          isSettled: false,
          receiptNumber: 'SETTLEMENT',
          paymentMethod: 'CASH',
        }),
      );

      // 2. Date Filter View (Historical Today)
      db.accountSettlement.findMany.mockResolvedValue([]);
      const periodResult = await cashService.getCashierBalanceSheet(adminId, { preset: 'today' });

      expect(periodResult.summary.expectedPhysicalCash.toNumber()).toBe(80);
      expect(periodResult.summary.physicalCashIn.toNumber()).toBe(80);
      expect(periodResult.transactions[0].receiptNumber).toBe('SETTLEMENT');
    });
  });

  describe('Reversal Handling: reverseSettlement cleans up custody entries cleanly', () => {
    it('deletes settlement-linked UserCashBalance entries and restores original cashier rows', async () => {
      const mockSettlement = {
        id: 'set-80',
        portalUserId: cashierId,
        moduleScope: 'BILLING',
        status: 'ACCEPTED',
        physicalCash: new Decimal(80),
        handoverAmount: new Decimal(80),
      };
      db.accountSettlement.findUnique.mockResolvedValue(mockSettlement);
      db.accountSettlement.update.mockResolvedValue({ ...mockSettlement, status: 'REVERSED' });
      db.settlementTransaction.findMany.mockResolvedValue([{ userCashBalanceId: 'cashier-orig-1' }]);
      db.mainCashFundEntry.findMany.mockResolvedValue([{ amount: new Decimal(80) }]);

      await financeControlService.reverseSettlement('set-80', { reason: 'Wrong cashier selected' }, adminId);

      // Deletes the RECOVERY entries created by this settlement
      expect(db.userCashBalance.deleteMany).toHaveBeenCalledWith({
        where: {
          category: 'RECOVERY',
          note: { contains: '[settlement:set-80]' },
        },
      });

      // Restores cashier original transactions
      expect(db.userCashBalance.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['cashier-orig-1'] } },
        data: { isSettled: false },
      });

      // Offsets Main Cash Fund
      expect(db.mainCashFundEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'OUT',
          amount: new Decimal(80),
          type: 'SETTLEMENT_RETURN',
          relatedAccountSettlementId: 'set-80',
        }),
      });
    });
  });
});
