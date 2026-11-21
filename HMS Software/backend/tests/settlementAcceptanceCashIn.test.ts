import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const db = vi.hoisted(() => ({
  portalUser: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  userCashBalance: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  accountSettlement: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  settlementTransaction: {
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
  mainCashFundEntry: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));

vi.mock('@/db/client', () => ({ prisma: db }));
vi.mock('@/shared/mainFundLock', () => ({ lockMainFund: vi.fn().mockResolvedValue(undefined) }));

import { financeControlService } from '@/modules/cash/financeControl.service';
import { cashService } from '@/modules/cash/cash.service';
import { settlementService } from '@/modules/cash/settlement.service';
import { managementReportsService } from '@/modules/reports/managementReports.service';

describe('HMS Cash Settlement Acceptance & Multi-Level Custody Transfers', () => {
  const cashierId = 'user-cashier-1';
  const adminId = 'user-admin-1';
  const superAdminId = 'user-super-admin-1';

  const cashierUser = { id: cashierId, username: 'cashier1', displayName: 'Front Desk Cashier', role: 'FRONT_DESK_BILLING', status: 'ACTIVE' };
  const adminUser = { id: adminId, username: 'admin1', displayName: 'Hospital Admin', role: 'ADMIN', status: 'ACTIVE' };
  const superAdminUser = { id: superAdminId, username: 'superadmin1', displayName: 'Super Administrator', role: 'SUPER_ADMIN', status: 'ACTIVE' };

  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation(async (callback: any) => callback(db));
    db.$executeRaw.mockResolvedValue(1);

    db.portalUser.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === cashierId) return cashierUser;
      if (where.id === adminId) return adminUser;
      if (where.id === superAdminId) return superAdminUser;
      return null;
    });

    db.portalUser.findUniqueOrThrow.mockImplementation(async ({ where }: any) => {
      if (where.id === cashierId) return cashierUser;
      if (where.id === adminId) return adminUser;
      if (where.id === superAdminId) return superAdminUser;
      throw new Error(`User not found: ${where.id}`);
    });

    db.portalUser.findFirst.mockImplementation(async ({ where }: any) => {
      if (where?.role === 'SUPER_ADMIN') return superAdminUser;
      if (where?.role === 'ADMIN') return adminUser;
      return null;
    });

    db.accountSettlement.findFirst.mockResolvedValue(null);
    db.accountSettlement.findMany.mockResolvedValue([]);
    db.userCashBalance.findMany.mockResolvedValue([]);
    db.settlementTransaction.findMany.mockResolvedValue([]);
    db.mainCashFundEntry.findMany.mockResolvedValue([]);
  });

  describe('Multi-Level Settlement Hierarchy & Eligible Receivers', () => {
    it('Front Desk can query eligible receivers (Admin and Super Admin)', async () => {
      db.portalUser.findMany.mockResolvedValueOnce([adminUser, superAdminUser]);

      const receivers = await settlementService.getEligibleReceivers(cashierId);
      expect(db.portalUser.findMany).toHaveBeenCalledWith({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
        select: expect.any(Object),
        orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
      });
      expect(receivers).toHaveLength(2);
    });

    it('Admin can query eligible receivers (Super Admin only)', async () => {
      db.portalUser.findMany.mockResolvedValueOnce([superAdminUser]);

      const receivers = await settlementService.getEligibleReceivers(adminId);
      expect(db.portalUser.findMany).toHaveBeenCalledWith({
        where: { role: { in: ['SUPER_ADMIN'] }, status: 'ACTIVE' },
        select: expect.any(Object),
        orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
      });
      expect(receivers).toEqual([superAdminUser]);
    });

    it('Admin cannot submit settlement to a non-Super Admin receiver', async () => {
      db.portalUser.findUnique.mockResolvedValueOnce({ id: 'other-admin', role: 'ADMIN', status: 'ACTIVE' });

      await expect(
        settlementService.submitSettlement(adminId, {
          physicalCash: 1000,
          receiverUserId: 'other-admin',
        }),
      ).rejects.toThrow('Admin can only settle cash onward to a Super Admin.');
    });
  });

  describe('Scenario A: Direct Front Desk -> Super Admin Settlement', () => {
    it('FD Opening 2,000 + Collections 1,000 -> settles 3,000 directly to SA; SA balance is 3,000 and FD is 0', async () => {
      // 1. FD submits settlement of 3,000 with receiver = superAdminId
      db.userCashBalance.findMany.mockResolvedValueOnce([
        { id: 'tx-1', amount: new Decimal(2000), direction: 'IN', isPhysicalCash: true, occurredAt: new Date() },
        { id: 'tx-2', amount: new Decimal(1000), direction: 'IN', isPhysicalCash: true, occurredAt: new Date() },
      ]);
      const mockCreatedSettlement = {
        id: 'set-fd-sa-3000',
        portalUserId: cashierId,
        receiverUserId: superAdminId,
        moduleScope: 'BILLING',
        status: 'SUBMITTED',
        physicalCash: new Decimal(3000),
        handoverAmount: new Decimal(3000),
      };
      db.accountSettlement.create.mockResolvedValueOnce(mockCreatedSettlement);

      const submitted = await settlementService.submitSettlement(cashierId, {
        physicalCash: 3000,
        receiverUserId: superAdminId,
      });

      expect(db.accountSettlement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          portalUserId: cashierId,
          receiverUserId: superAdminId,
          physicalCash: new Decimal(3000),
          status: 'SUBMITTED',
        }),
      });
      expect(submitted.id).toBe('set-fd-sa-3000');

      // 2. Super Admin accepts the settlement
      db.accountSettlement.findUnique.mockResolvedValue({
        ...mockCreatedSettlement,
        submittedByUser: cashierUser,
      });
      db.accountSettlement.update.mockResolvedValue({
        ...mockCreatedSettlement,
        status: 'ACCEPTED',
        reviewedById: superAdminId,
        reviewedAt: new Date(),
      });

      await financeControlService.reviewSettlement('set-fd-sa-3000', { action: 'ACCEPT' }, superAdminId);

      // Verify exactly 1 OUT for Cashier and 1 IN for Super Admin
      expect(db.userCashBalance.create).toHaveBeenCalledTimes(2);
      expect(db.userCashBalance.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          portalUserId: cashierId,
          direction: 'OUT',
          amount: new Decimal(3000),
          category: 'RECOVERY',
          isSettled: true,
        }),
      });
      expect(db.userCashBalance.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          portalUserId: superAdminId,
          direction: 'IN',
          amount: new Decimal(3000),
          category: 'RECOVERY',
          isSettled: false,
        }),
      });

      // 3. Super Admin Balance Sheet reflects the received cash
      db.userCashBalance.findMany.mockResolvedValueOnce([
        {
          id: 'sa-in-1',
          portalUserId: superAdminId,
          moduleScope: 'BILLING',
          direction: 'IN',
          amount: new Decimal(3000),
          category: 'RECOVERY',
          isPhysicalCash: true,
          isSettled: false,
          occurredAt: new Date(),
          paymentReceipt: null,
        },
      ]);

      const saSheet = await cashService.getCashierBalanceSheet(superAdminId);
      expect(saSheet.summary.settlementCashIn.toNumber()).toBe(3000);
      expect(saSheet.summary.expectedPhysicalCash.toNumber()).toBe(3000);
      expect(saSheet.summary.remainingAmount.toNumber()).toBe(3000);
      expect(saSheet.summary.unsettledCount).toBe(1);

      // 4. Front Desk Cashier's Balance Sheet is settled (remaining 0)
      db.userCashBalance.findMany.mockResolvedValueOnce([]); // No unsettled rows

      const fdSheet = await cashService.getCashierBalanceSheet(cashierId);
      expect(fdSheet.summary.expectedPhysicalCash.toNumber()).toBe(0);
      expect(fdSheet.summary.remainingAmount.toNumber()).toBe(0);
      expect(fdSheet.summary.unsettledCount).toBe(0);
    });
  });

  describe('Scenario B: Front Desk -> Admin Settlement & Receiver Authorization', () => {
    it('rejects review/accept attempt if actor is not the designated receiving Admin', async () => {
      const mockSettlement = {
        id: 'set-fd-admin-3000',
        portalUserId: cashierId,
        receiverUserId: adminId,
        moduleScope: 'BILLING',
        status: 'SUBMITTED',
        physicalCash: new Decimal(3000),
        handoverAmount: new Decimal(3000),
        submittedByUser: cashierUser,
      };
      db.accountSettlement.findUnique.mockResolvedValue(mockSettlement);

      // Super Admin attempts to accept a settlement designated to Admin -> Forbidden!
      await expect(
        financeControlService.reviewSettlement('set-fd-admin-3000', { action: 'ACCEPT' }, superAdminId),
      ).rejects.toThrow('Only the designated settlement receiver is authorized to review, accept, or reject this settlement.');

      // Another admin attempts to accept -> Forbidden!
      await expect(
        financeControlService.reviewSettlement('set-fd-admin-3000', { action: 'ACCEPT' }, 'other-admin-id'),
      ).rejects.toThrow('Reviewer portal user not found');
    });

    it('FD settles 3,000 to Admin -> only designated Admin can accept; Admin receives Cash IN 3,000', async () => {
      const mockSettlement = {
        id: 'set-fd-admin-3000',
        portalUserId: cashierId,
        receiverUserId: adminId,
        moduleScope: 'BILLING',
        status: 'SUBMITTED',
        physicalCash: new Decimal(3000),
        handoverAmount: new Decimal(3000),
        submittedByUser: cashierUser,
      };
      db.accountSettlement.findUnique.mockResolvedValue(mockSettlement);
      db.accountSettlement.update.mockResolvedValue({
        ...mockSettlement,
        status: 'ACCEPTED',
        reviewedById: adminId,
        reviewedAt: new Date(),
      });

      // Designated Admin reviews and accepts
      await financeControlService.reviewSettlement('set-fd-admin-3000', { action: 'ACCEPT' }, adminId);

      // Exactly 1 OUT for Cashier and 1 IN for Admin
      expect(db.userCashBalance.create).toHaveBeenCalledTimes(2);
      expect(db.userCashBalance.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          portalUserId: cashierId,
          direction: 'OUT',
          amount: new Decimal(3000),
          category: 'RECOVERY',
        }),
      });
      expect(db.userCashBalance.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          portalUserId: adminId,
          direction: 'IN',
          amount: new Decimal(3000),
          category: 'RECOVERY',
          isSettled: false,
        }),
      });

      // Admin Balance Sheet now holds the 3,000
      db.userCashBalance.findMany.mockResolvedValueOnce([
        {
          id: 'admin-rec-1',
          portalUserId: adminId,
          moduleScope: 'BILLING',
          direction: 'IN',
          amount: new Decimal(3000),
          category: 'RECOVERY',
          isPhysicalCash: true,
          isSettled: false,
          occurredAt: new Date(),
          paymentReceipt: null,
        },
      ]);

      const adminSheet = await cashService.getCashierBalanceSheet(adminId);
      expect(adminSheet.summary.settlementCashIn.toNumber()).toBe(3000);
      expect(adminSheet.summary.expectedPhysicalCash.toNumber()).toBe(3000);
      expect(adminSheet.summary.remainingAmount.toNumber()).toBe(3000);
    });
  });

  describe('Scenario C: Admin -> Super Admin Onward Settlement', () => {
    it('rejects review/accept attempt if non-designated admin/super-admin tries to accept onward settlement', async () => {
      const mockAdminSettlement = {
        id: 'set-admin-sa-2000',
        portalUserId: adminId,
        receiverUserId: superAdminId,
        moduleScope: 'BILLING',
        status: 'SUBMITTED',
        physicalCash: new Decimal(2000),
        handoverAmount: new Decimal(2000),
        submittedByUser: adminUser,
      };
      db.accountSettlement.findUnique.mockResolvedValue(mockAdminSettlement);

      // Admin or another non-designated user attempts to review -> Forbidden!
      await expect(
        financeControlService.reviewSettlement('set-admin-sa-2000', { action: 'ACCEPT' }, adminId),
      ).rejects.toThrow('Only the designated settlement receiver is authorized to review, accept, or reject this settlement.');
    });
    it('Admin holding 3,000 settles 2,000 to SA -> Admin remaining 1,000, SA receives 2,000, total combined custody = 3,000', async () => {
      // 1. Admin submits settlement of 2,000 onward to Super Admin
      db.userCashBalance.findMany.mockResolvedValueOnce([
        { id: 'admin-orig-1', amount: new Decimal(3000), direction: 'IN', isPhysicalCash: true, occurredAt: new Date() },
      ]);
      const mockAdminSettlement = {
        id: 'set-admin-sa-2000',
        portalUserId: adminId,
        receiverUserId: superAdminId,
        moduleScope: 'BILLING',
        status: 'SUBMITTED',
        physicalCash: new Decimal(2000),
        handoverAmount: new Decimal(2000),
      };
      db.accountSettlement.create.mockResolvedValueOnce(mockAdminSettlement);

      const adminSub = await settlementService.submitSettlement(adminId, {
        physicalCash: 2000,
        receiverUserId: superAdminId,
        varianceReason: 'Retaining 1,000 petty float in drawer',
      });
      expect(adminSub.id).toBe('set-admin-sa-2000');

      // 2. Super Admin accepts the 2,000 onward settlement
      db.accountSettlement.findUnique.mockResolvedValue({
        ...mockAdminSettlement,
        submittedByUser: adminUser,
      });
      db.accountSettlement.update.mockResolvedValue({
        ...mockAdminSettlement,
        status: 'ACCEPTED',
        reviewedById: superAdminId,
        reviewedAt: new Date(),
      });

      await financeControlService.reviewSettlement('set-admin-sa-2000', { action: 'ACCEPT' }, superAdminId);

      // Verify Admin gets Cash OUT of 2,000 and SA gets Cash IN of 2,000
      expect(db.userCashBalance.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          portalUserId: adminId,
          direction: 'OUT',
          amount: new Decimal(2000),
          category: 'RECOVERY',
          isSettled: true,
        }),
      });
      expect(db.userCashBalance.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          portalUserId: superAdminId,
          direction: 'IN',
          amount: new Decimal(2000),
          category: 'RECOVERY',
          isSettled: false,
        }),
      });

      // 3. Admin Balance Sheet: had 3,000 IN, handed over 2,000 OUT -> Remaining 1,000
      db.userCashBalance.findMany.mockResolvedValueOnce([
        {
          id: 'admin-in-3000',
          portalUserId: adminId,
          moduleScope: 'BILLING',
          direction: 'IN',
          amount: new Decimal(3000),
          category: 'RECOVERY',
          isPhysicalCash: true,
          isSettled: false,
          occurredAt: new Date(),
          paymentReceipt: null,
        },
        {
          id: 'admin-out-2000',
          portalUserId: adminId,
          moduleScope: 'BILLING',
          direction: 'OUT',
          amount: new Decimal(2000),
          category: 'RECOVERY',
          isPhysicalCash: true,
          isSettled: false,
          occurredAt: new Date(),
          paymentReceipt: null,
        },
      ]);

      const adminSheet = await cashService.getCashierBalanceSheet(adminId);
      expect(adminSheet.summary.settlementCashIn.toNumber()).toBe(3000);
      expect(adminSheet.summary.settlementCashOut.toNumber()).toBe(2000);
      expect(adminSheet.summary.expectedPhysicalCash.toNumber()).toBe(1000);
      expect(adminSheet.summary.remainingAmount.toNumber()).toBe(1000);

      // 4. Super Admin Balance Sheet: has 2,000 IN
      db.userCashBalance.findMany.mockResolvedValueOnce([
        {
          id: 'sa-in-2000',
          portalUserId: superAdminId,
          moduleScope: 'BILLING',
          direction: 'IN',
          amount: new Decimal(2000),
          category: 'RECOVERY',
          isPhysicalCash: true,
          isSettled: false,
          occurredAt: new Date(),
          paymentReceipt: null,
        },
      ]);

      const saSheet = await cashService.getCashierBalanceSheet(superAdminId);
      expect(saSheet.summary.settlementCashIn.toNumber()).toBe(2000);
      expect(saSheet.summary.expectedPhysicalCash.toNumber()).toBe(2000);

      // Total combined custody across Admin (1,000) and Super Admin (2,000) = 3,000
      const totalCustody = adminSheet.summary.expectedPhysicalCash.plus(saSheet.summary.expectedPhysicalCash).toNumber();
      expect(totalCustody).toBe(3000);
    });
  });

  describe('Scenario D: Rejected or Pending Settlement does not transfer custody', () => {
    it('does not transfer cash custody while status is SUBMITTED, and restores transactions on REJECT', async () => {
      // 1. Pending: submission does not touch receiver cash balance
      db.userCashBalance.findMany.mockResolvedValueOnce([
        { id: 'tx-1', amount: new Decimal(500), direction: 'IN', isPhysicalCash: true, occurredAt: new Date() },
      ]);
      db.accountSettlement.create.mockResolvedValueOnce({
        id: 'set-pending',
        portalUserId: cashierId,
        receiverUserId: superAdminId,
        status: 'SUBMITTED',
        physicalCash: new Decimal(500),
      });

      await settlementService.submitSettlement(cashierId, { physicalCash: 500 });
      expect(db.userCashBalance.create).not.toHaveBeenCalled();

      // 2. Reject: restores transactions to unsettled without creating custody entries
      db.accountSettlement.findUnique.mockResolvedValue({
        id: 'set-pending',
        portalUserId: cashierId,
        receiverUserId: superAdminId,
        status: 'SUBMITTED',
        physicalCash: new Decimal(500),
        handoverAmount: new Decimal(500),
        submittedByUser: cashierUser,
      });
      db.accountSettlement.update.mockResolvedValue({
        id: 'set-pending',
        status: 'REJECTED',
      });
      db.settlementTransaction.findMany.mockResolvedValue([{ userCashBalanceId: 'tx-1' }]);

      await financeControlService.reviewSettlement('set-pending', { action: 'REJECT', remarks: 'Recount required' }, superAdminId);

      expect(db.userCashBalance.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['tx-1'] } },
        data: { isSettled: false },
      });
      expect(db.userCashBalance.create).not.toHaveBeenCalled();
    });
  });

  describe('Scenario E: Duplicate Acceptance Prevention', () => {
    it('rejects duplicate review if settlement has already been reviewed/accepted', async () => {
      db.accountSettlement.findUnique.mockResolvedValue({
        id: 'set-already-accepted',
        status: 'ACCEPTED',
        physicalCash: new Decimal(1000),
        submittedByUser: cashierUser,
      });

      await expect(
        financeControlService.reviewSettlement('set-already-accepted', { action: 'ACCEPT' }, superAdminId),
      ).rejects.toThrow(/Only a SUBMITTED settlement can be reviewed/);

      expect(db.userCashBalance.create).not.toHaveBeenCalled();
      expect(db.mainCashFundEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('Management Balance Sheet & Account Settlements Report Reconciliation', () => {
    it('ensures Front Desk Remaining is Rs. 0 and Super Admin Remaining is Rs. 3,000 without negative remaining cash', async () => {
      const cashier = { id: cashierId, displayName: 'Front Desk Cashier', username: 'cashier1', role: 'FRONT_DESK_BILLING' };
      const admin = { id: adminId, displayName: 'Super Admin', username: 'admin1', role: 'SUPER_ADMIN' };

      db.userCashBalance.findMany.mockResolvedValueOnce([
        {
          portalUserId: cashierId,
          moduleScope: 'BILLING',
          occurredAt: new Date('2026-11-16T12:00:00.000Z'),
          direction: 'IN',
          category: 'COLLECTION',
          amount: new Decimal(2000),
          isPhysicalCash: true,
          portalUser: cashier,
        },
        {
          portalUserId: cashierId,
          moduleScope: 'BILLING',
          occurredAt: new Date('2026-11-21T10:00:00.000Z'),
          direction: 'IN',
          category: 'COLLECTION',
          amount: new Decimal(1000),
          isPhysicalCash: true,
          portalUser: cashier,
        },
        {
          portalUserId: cashierId,
          moduleScope: 'BILLING',
          occurredAt: new Date('2026-11-21T11:00:00.000Z'),
          direction: 'OUT',
          category: 'RECOVERY',
          amount: new Decimal(3000),
          isPhysicalCash: true,
          portalUser: cashier,
        },
        {
          portalUserId: adminId,
          moduleScope: 'BILLING',
          occurredAt: new Date('2026-11-21T11:00:00.000Z'),
          direction: 'IN',
          category: 'RECOVERY',
          amount: new Decimal(3000),
          isPhysicalCash: true,
          portalUser: admin,
        },
      ]);

      db.accountSettlement.findMany.mockResolvedValueOnce([
        {
          portalUserId: cashierId,
          moduleScope: 'BILLING',
          physicalCash: new Decimal(3000),
          handoverAmount: new Decimal(3000),
          variance: new Decimal(0),
          status: 'ACCEPTED',
          submittedAt: new Date('2026-11-21T10:30:00.000Z'),
          reviewedAt: new Date('2026-11-21T11:00:00.000Z'),
          reversedAt: null,
          submittedByUser: cashier,
        },
      ]);

      const report = await managementReportsService.getBalanceSettlements({
        preset: 'custom',
        fromDate: '2026-11-21',
        toDate: '2026-11-21',
      });

      expect(report.rows).toHaveLength(2);

      const cashierRow = report.rows.find((r) => r.user === 'Front Desk Cashier')!;
      expect(cashierRow.opening.toNumber()).toBe(2000);
      expect(cashierRow.cashCollections.toNumber()).toBe(1000);
      expect(cashierRow.expenses.toNumber()).toBe(0);
      expect(cashierRow.refunds.toNumber()).toBe(0);
      expect(cashierRow.settlementOut.toNumber()).toBe(3000);
      expect(cashierRow.expectedCash.toNumber()).toBe(3000);
      expect(cashierRow.submitted.toNumber()).toBe(3000);
      expect(cashierRow.accepted.toNumber()).toBe(3000);
      expect(cashierRow.remaining.toNumber()).toBe(0);

      const adminRow = report.rows.find((r) => r.user === 'Super Admin')!;
      expect(adminRow.opening.toNumber()).toBe(0);
      expect(adminRow.settlementIn.toNumber()).toBe(3000);
      expect(adminRow.expectedCash.toNumber()).toBe(3000);
      expect(adminRow.remaining.toNumber()).toBe(3000);
    });
  });
});
