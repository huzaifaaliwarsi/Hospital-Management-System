import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const db = vi.hoisted(() => ({
  portalUser: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn() },
  stockItem: { findMany: vi.fn(), findUnique: vi.fn() },
  stockLedger: { findMany: vi.fn() },
  purchaseOrder: { findMany: vi.fn(), aggregate: vi.fn() },
  supplier: { findMany: vi.fn(), findUnique: vi.fn() },
  supplierLedger: { findMany: vi.fn() },
  departmentRequisition: { findMany: vi.fn() },
  department: { findMany: vi.fn(), findUnique: vi.fn() },
  userCashBalance: { findMany: vi.fn(), create: vi.fn() },
  accountSettlement: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  hospitalInvoice: { findMany: vi.fn() },
  paymentReceipt: { findMany: vi.fn() },
  inventoryExpense: { findMany: vi.fn(), aggregate: vi.fn() },
  admissionRecord: { groupBy: vi.fn() },
  bed: { count: vi.fn() },
  salarySlip: { findMany: vi.fn() },
  doctorCommissionAccrual: { findMany: vi.fn() },
  expense: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@/db/client', () => ({ prisma: db }));
vi.mock('@/shared/inventoryBatchBalances', () => ({
  getPositiveBatchBalances: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/modules/expenses/expenses.service', () => ({
  expensesService: {
    totalBetween: vi.fn().mockResolvedValue(new Decimal(0)),
  },
}));
vi.mock('@/modules/reports/staffFinanceSummary', () => ({
  staffFinanceSummary: vi.fn().mockResolvedValue({
    salaryGenerated: new Decimal(0),
    salaryPaid: new Decimal(0),
    salaryPayable: new Decimal(0),
    commissionGenerated: new Decimal(0),
    commissionPaid: new Decimal(0),
    commissionPayable: new Decimal(0),
    payrollCost: new Decimal(0),
    doctorCommissionCost: new Decimal(0),
  }),
}));
vi.mock('@/shared/departmentCollections', () => ({
  allocateCollection: vi.fn().mockReturnValue([]),
  allocateInvoiceAmount: vi.fn().mockReturnValue([]),
  collectionSelect: {},
  collectionInvoiceSelect: { lines: {} },
  invoiceBalance: vi.fn().mockReturnValue({ patientDue: new Decimal(0), panelDue: new Decimal(0) }),
  panelCollectionLedger: vi.fn().mockResolvedValue([]),
  signedReceiptWhere: {},
}));
vi.mock('@/modules/reports/dashboard.service', () => ({
  resolveDateRange: vi.fn().mockReturnValue({
    start: new Date('2026-11-01T00:00:00.000Z'),
    end: new Date('2026-11-30T23:59:59.999Z'),
    label: 'This Month',
  }),
}));

import { inventoryReportsService } from '@/modules/reports/inventoryReports.service';
import { managementReportsService } from '@/modules/reports/managementReports.service';
import { cashService } from '@/modules/cash/cash.service';

describe('HMS Batch 2 Financial Reporting Corrections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Inventory Summary (I1) — Actual historical lot/batch cost valuation', () => {
    it('values stock across positive batches using historical lot purchase rates instead of latest purchase rate', async () => {
      // Item 1 has 2 batches: BN-01 (10 units @ 50) and BN-02 (20 units @ 60).
      // Total units = 30.
      // Latest purchase rate = 60.
      // If using latest rate: 30 * 60 = 1800 (INCORRECT).
      // Actual lot-wise valuation: (10 * 50) + (20 * 60) = 500 + 1200 = 1700 (CORRECT).
      db.stockItem.findMany.mockResolvedValueOnce([
        {
          id: 'item-1',
          name: 'Syringe 5ml',
          category: 'Consumables',
          reorderLevel: new Decimal(5),
          isActive: true,
          stockLedgerEntries: [
            { quantityDelta: new Decimal(10), batchNo: 'BN-01', expiryDate: new Date('2027-01-01'), createdAt: new Date() },
            { quantityDelta: new Decimal(20), batchNo: 'BN-02', expiryDate: new Date('2027-06-01'), createdAt: new Date() },
          ],
          purchaseOrderLines: [
            { batchNo: 'BN-02', rate: new Decimal(60) }, // latest
            { batchNo: 'BN-01', rate: new Decimal(50) }, // earlier
          ],
        },
      ]);
      db.purchaseOrder.findMany.mockResolvedValueOnce([]);
      db.stockLedger.findMany.mockResolvedValueOnce([]);
      db.supplierLedger.findMany.mockResolvedValueOnce([]);

      const res = await inventoryReportsService.getInventorySummary({ preset: 'this_month', nearExpiryDays: 30 });

      expect(res.totalItems).toBe(1);
      expect(res.totalStockValue.toNumber()).toBe(1700); // Exactly 1700, not 1800!
    });
  });

  describe('2. Purchase / Stock In (I3) — Supplier due accounting for payments, partial payments & returns', () => {
    it('correctly reduces due by returns and actual payments against credit purchases', async () => {
      // PO 1: CREDIT, Total = 5,000.
      // Supplier return against PO 1 = 1,000.
      // Net payable = 4,000.
      // Partial payment against PO 1 = 1,500.
      // Expected Due = 2,500. Expected Paid = 1,500.
      const mockPo = {
        id: 'po-1',
        totalAmount: new Decimal(5000),
        paymentMethod: 'CREDIT',
        createdAt: new Date('2026-11-10T10:00:00Z'),
        supplier: { id: 'supp-1', name: 'MedSupply Co' },
        createdByUser: { id: 'user-1', displayName: 'Staff 1', username: 'staff1' },
        lines: [],
      };
      db.purchaseOrder.findMany.mockResolvedValueOnce([mockPo]);
      db.supplierLedger.findMany.mockResolvedValueOnce([
        { referenceId: 'po-1', entryType: 'RETURN', amount: new Decimal(1000) },
        { referenceId: 'po-1', entryType: 'PAYMENT', amount: new Decimal(1500) },
      ]);

      const res = await inventoryReportsService.getPurchaseReport({ preset: 'this_month' });

      expect(res.totalPurchases).toBe(1);
      expect(res.totalAmount.toNumber()).toBe(5000);
      expect(res.totalReturned.toNumber()).toBe(1000);
      expect(res.totalPaid.toNumber()).toBe(1500);
      expect(res.totalDue.toNumber()).toBe(2500);

      const row = res.rows[0];
      expect(row.paidAmount.toNumber()).toBe(1500);
      expect(row.dueAmount.toNumber()).toBe(2500);
      expect(row.returnedAmount.toNumber()).toBe(1000);
    });
  });

  describe('3. Supplier Ledger (I5) — Accurate Opening Balance, Purchases, Payments, Returns & Running Balance', () => {
    it('computes opening balance from prior entries and chronological running balance for in-range entries', async () => {
      // Prior entries (before 2026-11-01):
      // Opening: Purchase Credit 2,000 - Payment 500 = 1,500 opening payable.
      db.supplierLedger.findMany
        .mockResolvedValueOnce([
          { entryType: 'PURCHASE_CREDIT', amount: new Decimal(2000) },
          { entryType: 'PAYMENT', amount: new Decimal(500) },
        ])
        // In-range entries (2026-11-01 to 2026-11-30):
        .mockResolvedValueOnce([
          // 1. Purchase Credit 3,000 -> Running = 1,500 + 3,000 = 4,500
          { id: 'e-1', supplierId: 'supp-1', entryType: 'PURCHASE_CREDIT', amount: new Decimal(3000), createdAt: new Date('2026-11-05'), supplier: { id: 'supp-1', name: 'MedSupply Co' }, actor: null },
          // 2. Return 500 -> Running = 4,500 - 500 = 4,000
          { id: 'e-2', supplierId: 'supp-1', entryType: 'RETURN', amount: new Decimal(500), createdAt: new Date('2026-11-10'), supplier: { id: 'supp-1', name: 'MedSupply Co' }, actor: null },
          // 3. Payment 2,000 -> Running = 4,000 - 2,000 = 2,000
          { id: 'e-3', supplierId: 'supp-1', entryType: 'PAYMENT', amount: new Decimal(2000), createdAt: new Date('2026-11-20'), supplier: { id: 'supp-1', name: 'MedSupply Co' }, actor: null },
        ]);

      const res = await inventoryReportsService.getSupplierReport({ preset: 'this_month', supplierId: 'supp-1' });

      expect(res.openingBalance.toNumber()).toBe(1500);
      expect(res.totalPurchases.toNumber()).toBe(3000);
      expect(res.totalReturns.toNumber()).toBe(500);
      expect(res.totalPayments.toNumber()).toBe(2000);
      expect(res.closingPayable.toNumber()).toBe(2000);
      expect(res.netMovement.toNumber()).toBe(500); // 3000 - 2000 - 500 = 500

      // Rows are returned reverse-chronological (most recent first)
      expect(res.rows[0].id).toBe('e-3');
      expect(res.rows[0].runningBalance.toNumber()).toBe(2000);

      expect(res.rows[1].id).toBe('e-2');
      expect(res.rows[1].runningBalance.toNumber()).toBe(4000);

      expect(res.rows[2].id).toBe('e-1');
      expect(res.rows[2].runningBalance.toNumber()).toBe(4500);
    });
  });

  describe('4. Income & Expense / Operating Profit Cost Calculations', () => {
    it('flags incomplete costs when historical cost rate is missing and enforces clinical consumption rule', async () => {
      db.hospitalInvoice.findMany.mockResolvedValue([]);
      db.paymentReceipt.findMany.mockResolvedValue([]);
      db.inventoryExpense.aggregate.mockResolvedValue({ _sum: { amount: new Decimal(0) } });
      db.admissionRecord.groupBy.mockResolvedValue([]);
      db.bed.count.mockResolvedValue(0);
      db.accountSettlement.count.mockResolvedValue(0);

      // Requisitions:
      // Req 1: Clinical department (SURGICAL) - 5 units with missing costRate -> should flag incomplete cost!
      // Req 2: Administrative department (ADMINISTRATIVE) - 10 units @ 100 -> should NOT count as direct service costs!
      db.departmentRequisition.findMany.mockResolvedValueOnce([
        {
          id: 'req-1',
          department: { id: 'dept-surg', name: 'Surgical Ward', departmentType: 'SURGICAL' },
          lines: [
            { quantity: new Decimal(5), returnedQuantity: new Decimal(0), costRate: null }, // Missing costRate!
          ],
        },
        {
          id: 'req-2',
          department: { id: 'dept-admin', name: 'Admin Office', departmentType: 'ADMINISTRATIVE' },
          lines: [
            { quantity: new Decimal(10), returnedQuantity: new Decimal(0), costRate: new Decimal(100) },
          ],
        },
      ]);

      const res = await managementReportsService.getOperatingProfit({ preset: 'this_month' });

      // Admin issue is excluded from direct clinical service cost
      expect(res.summary.directCost.toNumber()).toBe(0);
      // Missing cost rate on surgical consumable is flagged as incomplete
      expect(res.summary.hasIncompleteCost).toBe(true);
      expect(res.summary.missingCostCount).toBe(1);
    });
  });

  describe('5. Admin Balance Sheet Reporting — Accepted Settlement Cash IN', () => {
    it('shows accepted cashier settlement in Admin expectedPhysicalCash and settlementCashIn', async () => {
      const adminId = 'admin-user-1';
      db.portalUser.findUniqueOrThrow.mockResolvedValueOnce({ role: 'ADMIN' });
      db.accountSettlement.findFirst.mockResolvedValueOnce(null);

      // Admin has received Rs. 80 settlement handover
      db.userCashBalance.findMany.mockResolvedValueOnce([
        {
          id: 'admin-tx-1',
          portalUserId: adminId,
          moduleScope: 'BILLING',
          direction: 'IN',
          amount: new Decimal(80),
          category: 'RECOVERY',
          isPhysicalCash: true,
          isSettled: false,
          occurredAt: new Date('2026-11-20T10:00:00Z'),
          paymentReceipt: null,
          note: 'Settlement accepted from Cashier 1',
        },
      ]);

      const sheet = await cashService.getCashierBalanceSheet(adminId);

      expect(sheet.summary.expectedPhysicalCash.toNumber()).toBe(80);
      expect(sheet.summary.physicalCashIn.toNumber()).toBe(80);
      expect(sheet.summary.settlementCashIn.toNumber()).toBe(80);
      // Does not falsely inflate customer patient collections
      expect(sheet.summary.cashCollections.toNumber()).toBe(0);
      expect(sheet.summary.totalCollections.toNumber()).toBe(0);
    });
  });
});
