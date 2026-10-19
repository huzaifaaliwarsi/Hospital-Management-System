import { expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const db = vi.hoisted(() => ({
  salarySlip: { findMany: vi.fn().mockResolvedValue([]) },
  salaryPayment: { findMany: vi.fn().mockResolvedValue([]) },
  doctorCommissionAccrual: { findMany: vi.fn().mockResolvedValue([]) },
  commissionPayout: { findMany: vi.fn().mockResolvedValue([]) },
  paymentReceipt: { findMany: vi.fn() },
  userCashBalance: { findMany: vi.fn(), aggregate: vi.fn() },
  hospitalInvoice: { findMany: vi.fn() },
  admissionRecord: { groupBy: vi.fn() },
  bed: { count: vi.fn() },
  accountSettlement: { findMany: vi.fn(), count: vi.fn() },
}));
vi.mock('@/db/client', () => ({ prisma: db }));
vi.mock('@/modules/expenses/expenses.service', () => ({ expensesService: { totalBetween: async () => new Decimal(0) } }));
import { financeControlService } from '@/modules/cash/financeControl.service';
import { managementReportsService } from '@/modules/reports/managementReports.service';

it.each([true, false])('nets the user-wise balance settlement report, physical = %s', async (isPhysicalCash) => {
  db.accountSettlement.findMany.mockResolvedValue([]);
  db.userCashBalance.findMany.mockResolvedValue([2200, 1000, -1000, 1000].map(amount => ({
    portalUserId: 'frontdesk', moduleScope: 'BILLING', portalUser: { displayName: 'frontdesk', username: 'frontdesk' },
    amount: new Decimal(Math.abs(amount)), direction: amount < 0 ? 'OUT' : 'IN',
    category: amount < 0 ? 'REFUND' : 'COLLECTION', isPhysicalCash,
  })));
  const report = await managementReportsService.getBalanceSettlements({ preset: 'today' });
  expect(report.rows[0].cashCollections.toNumber()).toBe(isPhysicalCash ? 3200 : 0);
  expect(report.rows[0].expectedCash.toNumber()).toBe(isPhysicalCash ? 3200 : 0);
  expect(report.rows[0].remaining.toNumber()).toBe(isPhysicalCash ? 3200 : 0);
  expect(report.rows[0].nonCash.toNumber()).toBe(isPhysicalCash ? 0 : 3200);
});

it.each([true, false])('nets Super Admin finance collections, physical = %s', async (isPhysicalCash) => {
  const row = (amount: number) => ({ amount: new Decimal(amount), isPhysicalCash, paymentReceipt: { method: isPhysicalCash ? 'CASH' : 'CARD' } });
  db.accountSettlement.findMany.mockResolvedValue([]);
  db.userCashBalance.findMany.mockImplementation(async ({ where }) =>
    where.category === 'COLLECTION' ? [row(2200), row(1000), row(1000)] : where.category === 'REFUND' ? [row(1000)] : []);
  const report = await financeControlService.getFinanceKpis({ preset: 'today' });
  expect(report.totalCashCollectedToday.toNumber()).toBe(isPhysicalCash ? 3200 : 0);
  expect(report.totalNonCashCollectedToday.toNumber()).toBe(isPhysicalCash ? 0 : 3200);
  expect(report.totalRefundsToday.toNumber()).toBe(1000);
});

it('includes negative refunds in department-filtered management collections', async () => {
  db.hospitalInvoice.findMany.mockResolvedValue([]);
  db.admissionRecord.groupBy.mockResolvedValue([]);
  db.bed.count.mockResolvedValue(0);
  db.accountSettlement.count.mockResolvedValue(0);
  db.userCashBalance.aggregate.mockResolvedValue({ _sum: { amount: null } });
  db.paymentReceipt.findMany.mockImplementation(async ({ where }) => {
    expect(where.AND).toEqual([{ OR: [{ isReversed: false }, { amount: { lt: 0 } }] }]);
    expect(where.OR[0]).toEqual({ hospitalInvoice: { departmentId: 'department' } });
    return [2200, 1000, -1000, 1000].map(amount => ({ amount: new Decimal(amount), hospitalInvoice: { department: { name: 'OPD' } } }));
  });
  const report = await managementReportsService.getSummary({ preset: 'today', departmentId: 'department' });
  expect(report.summary.collections.toNumber()).toBe(3200);
  expect(report.rows[0].collected.toNumber()).toBe(3200);
});
