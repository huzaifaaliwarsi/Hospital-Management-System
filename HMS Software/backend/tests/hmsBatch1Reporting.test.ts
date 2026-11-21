import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const db = vi.hoisted(() => ({
  hospitalInvoice: { findMany: vi.fn() },
  paymentReceipt: { findMany: vi.fn() },
  inventoryExpense: { aggregate: vi.fn(), findMany: vi.fn() },
  admissionRecord: { groupBy: vi.fn() },
  bed: { count: vi.fn() },
  accountSettlement: { count: vi.fn() },
  department: { findMany: vi.fn() },
  departmentRequisition: { findMany: vi.fn() },
  salarySlip: { findMany: vi.fn() },
  doctorCommissionAccrual: { findMany: vi.fn() },
  expense: { findMany: vi.fn() },
}));

vi.mock('@/db/client', () => ({ prisma: db }));
vi.mock('@/modules/expenses/expenses.service', () => ({
  expensesService: { totalBetween: vi.fn() },
}));
vi.mock('@/modules/reports/staffFinanceSummary', () => ({
  staffFinanceSummary: vi.fn(),
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

import { managementReportsService } from '@/modules/reports/managementReports.service';
import { expensesService } from '@/modules/expenses/expenses.service';
import { staffFinanceSummary } from '@/modules/reports/staffFinanceSummary';

describe('HMS Batch 1: Revenue, Income & Expense, Operating Profit (P&L)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.admissionRecord.groupBy.mockResolvedValue([]);
    db.bed.count.mockResolvedValue(10);
    db.accountSettlement.count.mockResolvedValue(0);
    db.department.findMany.mockResolvedValue([]);
    db.inventoryExpense.aggregate.mockResolvedValue({ _sum: { amount: new Decimal(0) } });
    db.inventoryExpense.findMany.mockResolvedValue([]);
  });

  describe('Task 1: Accrual Revenue Recognition & Operating Profit', () => {
    it('recognizes OPD service Rs. 1,000 revenue upon service completion, independent of partial collection Rs. 500', async () => {
      const start = new Date('2026-11-01T00:00:00.000Z');
      const end = new Date('2026-11-01T23:59:59.999Z');

      // 1 OPD invoice: Gross 1,000, Discount 0, Net 1,000. Paid 500, Due 500.
      db.hospitalInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          createdAt: new Date('2026-11-01T10:00:00.000Z'),
          subtotal: new Decimal(1000),
          discountTotal: new Decimal(0),
          total: new Decimal(1000),
          paidTotal: new Decimal(500),
          panelReceivable: new Decimal(0),
          paymentReceipts: [{ amount: new Decimal(500) }],
          panelRemittanceAllocations: [],
          departmentId: null,
          department: null,
          lines: [
            {
              lineGross: new Decimal(1000),
              discountAmount: new Decimal(0),
              lineNet: new Decimal(1000),
              patientShare: new Decimal(1000),
              panelReceivable: new Decimal(0),
              serviceRate: null,
            },
          ],
        },
      ]);

      // Direct consumable issued for this procedure: Rs. 150
      db.departmentRequisition.findMany.mockResolvedValue([
        {
          id: 'req-1',
          issuedAt: new Date('2026-11-01T10:15:00.000Z'),
          status: 'ISSUED',
          lines: [
            {
              quantity: new Decimal(1),
              returnedQuantity: new Decimal(0),
              costRate: new Decimal(150),
            },
          ],
        },
      ]);

      // Receipt in period: Rs. 500
      db.paymentReceipt.findMany.mockResolvedValue([
        {
          id: 'rcpt-1',
          amount: new Decimal(500),
          collectedAt: new Date('2026-11-01T10:05:00.000Z'),
          method: 'CASH',
        },
      ]);

      // Staff finance: Salary 200, Commission 100
      vi.mocked(staffFinanceSummary).mockResolvedValue({
        salaryGenerated: new Decimal(200),
        salaryPaid: new Decimal(200),
        salaryOutstanding: new Decimal(0),
        commissionGenerated: new Decimal(100),
        commissionPaid: new Decimal(100),
        commissionOutstanding: new Decimal(0),
      });

      // Hospital Opex: Rs. 150
      vi.mocked(expensesService.totalBetween).mockResolvedValue(new Decimal(150));

      const report = await managementReportsService.getSummary({
        preset: 'custom',
        fromDate: '2026-11-01',
        toDate: '2026-11-01',
      });

      // Assertions
      expect(report.summary.grossBilling.toNumber()).toBe(1000);
      expect(report.summary.discounts.toNumber()).toBe(0);
      expect(report.summary.netEarnedRevenue.toNumber()).toBe(1000); // REVENUE = 1,000, NOT 500!
      expect(report.summary.totalBilling.toNumber()).toBe(1000);
      expect(report.summary.directServiceCosts.toNumber()).toBe(150);
      expect(report.summary.grossProfit.toNumber()).toBe(850); // 1,000 - 150 = 850

      // Operating Costs: Direct (150) + Salary (200) + Commission (100) + Opex (150) = 600
      expect(report.summary.totalOperatingCosts.toNumber()).toBe(600);

      // Accrual Operating Profit: Gross Profit 850 - (200 + 100 + 150) = 400 (or Revenue 1,000 - Costs 600 = 400)
      // NOT (500 - 600 = -100)!
      expect(report.summary.operatingProfit.toNumber()).toBe(400);
      expect(report.summary.operatingResult.toNumber()).toBe(400);
    });
  });

  describe('Task 2: M04 Operating Profit (P&L) Dedicated Report', () => {
    it('calculates Revenue 100,000 - Direct Cost 15,000 - Payroll 30,000 - Commission 10,000 - Opex 20,000 = Operating Profit 25,000', async () => {
      // Net Revenue 100,000 (Gross 105,000 - Discount 5,000)
      db.hospitalInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-100k',
          createdAt: new Date('2026-11-15T12:00:00.000Z'),
          subtotal: new Decimal(105000),
          discountTotal: new Decimal(5000),
          total: new Decimal(100000),
          paidTotal: new Decimal(80000),
          panelReceivable: new Decimal(0),
          paymentReceipts: [],
          panelRemittanceAllocations: [],
          departmentId: null,
          department: null,
          lines: [
            {
              lineGross: new Decimal(105000),
              discountAmount: new Decimal(5000),
              lineNet: new Decimal(100000),
              patientShare: new Decimal(100000),
              panelReceivable: new Decimal(0),
              serviceRate: null,
            },
          ],
        },
      ]);

      // Direct consumable cost = 15,000
      db.departmentRequisition.findMany.mockResolvedValue([
        {
          id: 'req-cons',
          issuedAt: new Date('2026-11-15T10:00:00.000Z'),
          status: 'ISSUED',
          lines: [
            {
              quantity: new Decimal(150),
              returnedQuantity: new Decimal(0),
              costRate: new Decimal(100),
            },
          ],
        },
      ]);

      // Payroll = 30,000, Commission = 10,000
      vi.mocked(staffFinanceSummary).mockResolvedValue({
        salaryGenerated: new Decimal(30000),
        salaryPaid: new Decimal(30000),
        salaryOutstanding: new Decimal(0),
        commissionGenerated: new Decimal(10000),
        commissionPaid: new Decimal(10000),
        commissionOutstanding: new Decimal(0),
      });

      // Other Opex = 20,000
      vi.mocked(expensesService.totalBetween).mockResolvedValue(new Decimal(20000));
      db.paymentReceipt.findMany.mockResolvedValue([]);

      const pnl = await managementReportsService.getOperatingProfit({
        preset: 'this_month',
      });

      expect(pnl.summary.revenue.toNumber()).toBe(100000);
      expect(pnl.summary.grossBilling.toNumber()).toBe(105000);
      expect(pnl.summary.discounts.toNumber()).toBe(5000);
      expect(pnl.summary.directCost.toNumber()).toBe(15000);
      expect(pnl.summary.grossProfit.toNumber()).toBe(85000);
      expect(pnl.summary.payroll.toNumber()).toBe(30000);
      expect(pnl.summary.doctorCommission.toNumber()).toBe(10000);
      expect(pnl.summary.otherOperatingExpenses.toNumber()).toBe(20000);
      expect(pnl.summary.totalCosts.toNumber()).toBe(75000); // 15,000 + 30,000 + 10,000 + 20,000 = 75,000
      expect(pnl.summary.operatingProfit.toNumber()).toBe(25000); // 100,000 - 75,000 = 25,000
      expect(pnl.summary.marginPercentage.toNumber()).toBe(25); // 25% margin
    });
  });

  describe('Task 3: M03 Detailed Expense Consolidated Reconciliation', () => {
    it('reconciles itemized expenses with M01/M04 total operating costs without double counting', async () => {
      // Hospital vouchers: 5,000
      db.expense.findMany.mockResolvedValue([
        {
          id: 'exp-1',
          expenseNumber: 'EXP-001',
          expenseDate: new Date('2026-11-10'),
          category: 'UTILITIES',
          amount: new Decimal(3000),
          paidTo: 'Electric Co',
          description: 'Electricity bill',
          department: null,
          createdByUser: { id: 'u1', displayName: 'Admin', username: 'admin', role: 'ADMIN' },
        },
        {
          id: 'exp-2',
          expenseNumber: 'EXP-002',
          expenseDate: new Date('2026-11-12'),
          category: 'MAINTENANCE',
          amount: new Decimal(2000),
          paidTo: 'HVAC repair',
          description: 'AC servicing',
          department: null,
          createdByUser: { id: 'u1', displayName: 'Admin', username: 'admin', role: 'ADMIN' },
        },
      ]);

      // Direct Consumables: 2,500
      db.departmentRequisition.findMany.mockResolvedValue([
        {
          id: 'req-1',
          issuedAt: new Date('2026-11-10T09:00:00Z'),
          status: 'ISSUED',
          department: { id: 'd1', name: 'ICU' },
          issuedBy: { id: 'u1', displayName: 'Store Keeper', username: 'store', role: 'INVENTORY_MANAGEMENT' },
          lines: [
            {
              id: 'l1',
              quantity: new Decimal(25),
              returnedQuantity: new Decimal(0),
              costRate: new Decimal(100),
              stockItem: { id: 's1', name: 'Syringes', code: 'SYR-1', unit: 'pcs' },
            },
          ],
        },
      ]);

      // Staff Salary: 8,000
      db.salarySlip.findMany.mockResolvedValue([
        {
          id: 'sal-1',
          approvedAt: new Date('2026-11-15T00:00:00Z'),
          createdAt: new Date('2026-11-15T00:00:00Z'),
          status: 'APPROVED',
          staff: { id: 'st1', fullName: 'Nurse Sarah', employeeId: 'EMP-10' },
          payrollRun: { department: { id: 'd1', name: 'Nursing' } },
          payments: [],
          correctionEntries: [],
          generatedAmount: new Decimal(8000),
        },
      ]);

      // Doctor Commission: 1,500
      db.doctorCommissionAccrual.findMany.mockResolvedValue([
        {
          id: 'comm-1',
          collectionEventId: 'ce-1',
          collectionEvent: { occurredAt: new Date('2026-11-15T14:00:00Z') },
          commissionAmount: new Decimal(1500),
          ruleSnapshot: { collectionBased: true },
          doctor: { id: 'doc1', fullName: 'Dr. Ali', employeeId: 'DOC-01' },
          payouts: [],
          reversals: [],
          adjustments: [],
        },
      ]);

      db.inventoryExpense.findMany.mockResolvedValue([]);

      const detailed = await managementReportsService.getDetailedExpenses({
        preset: 'this_month',
      });

      expect(detailed.summary.totalHospitalExpenses.toNumber()).toBe(5000);
      expect(detailed.summary.totalDirectConsumables.toNumber()).toBe(2500);
      expect(detailed.summary.totalOperatingCosts.toNumber()).toBe(5000 + 2500 + 8000 + 1500); // 17,000
      expect(detailed.rows).toHaveLength(5); // 2 hospital + 1 consumable + 1 salary + 1 commission
    });

    it('Detailed Expense: Commission Earned, Paid, Outstanding, dynamic department and user attribution', async () => {
      db.expense.findMany.mockResolvedValue([]);
      db.departmentRequisition.findMany.mockResolvedValue([]);
      db.salarySlip.findMany.mockResolvedValue([]);
      db.inventoryExpense.findMany.mockResolvedValue([]);

      db.doctorCommissionAccrual.findMany.mockResolvedValue([
        {
          id: 'comm-1',
          collectionEventId: 'ce-1',
          collectionEvent: { occurredAt: new Date('2026-11-15T14:00:00Z') },
          commissionAmount: new Decimal(100),
          ruleSnapshot: { collectionBased: true },
          doctor: { id: 'doc1', fullName: 'Dr. Ahmad', employeeId: 'DOC-01', staffDepartments: [{ department: { id: 'd-doc', name: 'General Medicine' } }] },
          payouts: [{ amount: new Decimal(40) }],
          reversals: [],
          adjustments: [],
          invoiceLineItem: {
            serviceRate: { department: { id: 'd-cardio', name: 'Cardiology' } },
            hospitalInvoice: {
              department: { id: 'd-opd', name: 'OPD General' },
              paymentReceipts: [{ collectedBy: { id: 'u-cashier', displayName: 'Cashier Bilal', username: 'bilal' } }],
            },
          },
        },
        {
          id: 'comm-2',
          collectionEventId: 'ce-2',
          collectionEvent: { occurredAt: new Date('2026-11-16T10:00:00Z') },
          commissionAmount: new Decimal(200),
          ruleSnapshot: { collectionBased: true },
          doctor: { id: 'doc2', fullName: 'Dr. Fatima', employeeId: 'DOC-02', staffDepartments: [] },
          payouts: [],
          reversals: [],
          adjustments: [],
          approvedByUser: { id: 'u-admin', displayName: 'Admin Tariq', username: 'admin' },
          invoiceLineItem: {
            serviceRate: null,
            hospitalInvoice: {
              department: { id: 'd-ent', name: 'ENT' },
              paymentReceipts: [],
            },
          },
        },
        {
          id: 'comm-3',
          collectionEventId: 'ce-3',
          collectionEvent: { occurredAt: new Date('2026-11-17T11:00:00Z') },
          commissionAmount: new Decimal(300),
          ruleSnapshot: { collectionBased: true },
          doctor: { id: 'doc3', fullName: 'Dr. Usman', employeeId: 'DOC-03', staffDepartments: [{ department: { id: 'd-ortho', name: 'Orthopedics' } }] },
          payouts: [],
          reversals: [],
          adjustments: [],
          approvedByUser: { id: 'u-fin', displayName: 'Finance Officer', username: 'finance', role: 'ACCOUNTANT' },
          invoiceLineItem: null,
        },
        {
          id: 'comm-4',
          collectionEventId: 'ce-4',
          collectionEvent: { occurredAt: new Date('2026-11-18T12:00:00Z') },
          commissionAmount: new Decimal(50),
          ruleSnapshot: { collectionBased: true },
          doctor: { id: 'doc4', fullName: 'Dr. Sara', employeeId: 'DOC-04', staffDepartments: [] },
          payouts: [],
          reversals: [],
          adjustments: [],
          invoiceLineItem: null,
        },
      ]);

      const detailed = await managementReportsService.getDetailedExpenses({
        preset: 'this_month',
      });

      expect(detailed.summary.totalCommission.toNumber()).toBe(650); // 100 + 200 + 300 + 50
      expect(detailed.summary.totalCommissionPaid.toNumber()).toBe(40);
      expect(detailed.summary.totalCommissionOutstanding.toNumber()).toBe(610); // 60 + 200 + 300 + 50
      expect(detailed.rows).toHaveLength(4);

      // Row 1: Earned 100, Paid 40, Outstanding 60, Department Cardiology, EnteredBy Cashier Bilal
      const r1 = detailed.rows.find((r) => r.id === 'comm-comm-1')!;
      expect(r1.amount.toNumber()).toBe(100);
      expect(r1.paidAmount.toNumber()).toBe(40);
      expect(r1.outstandingAmount.toNumber()).toBe(60);
      expect(r1.department).toBe('Cardiology');
      expect(r1.enteredBy).toBe('Cashier Bilal');

      // Row 2: Earned 200, Paid 0, Outstanding 200, Department ENT (from hospitalInvoice), EnteredBy Admin Tariq
      const r2 = detailed.rows.find((r) => r.id === 'comm-comm-2')!;
      expect(r2.amount.toNumber()).toBe(200);
      expect(r2.paidAmount.toNumber()).toBe(0);
      expect(r2.outstandingAmount.toNumber()).toBe(200);
      expect(r2.department).toBe('ENT');
      expect(r2.enteredBy).toBe('Admin Tariq');

      // Row 3: Earned 300, Paid 0, Outstanding 300, Department Orthopedics (from doctor staffDepartment), EnteredBy Finance Officer
      const r3 = detailed.rows.find((r) => r.id === 'comm-comm-3')!;
      expect(r3.amount.toNumber()).toBe(300);
      expect(r3.paidAmount.toNumber()).toBe(0);
      expect(r3.outstandingAmount.toNumber()).toBe(300);
      expect(r3.department).toBe('Orthopedics');
      expect(r3.enteredBy).toBe('Finance Officer');

      // Row 4: Earned 50, Paid 0, Outstanding 50, Department Unassigned, EnteredBy System (Generated)
      const r4 = detailed.rows.find((r) => r.id === 'comm-comm-4')!;
      expect(r4.amount.toNumber()).toBe(50);
      expect(r4.paidAmount.toNumber()).toBe(0);
      expect(r4.outstandingAmount.toNumber()).toBe(50);
      expect(r4.department).toBe('Unassigned');
      expect(r4.enteredBy).toBe('System (Generated)');
    });
  });
});
