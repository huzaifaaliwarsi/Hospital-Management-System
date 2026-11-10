import { expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const db = vi.hoisted(() => ({ paymentReceipt: { findMany: vi.fn() } }));
vi.mock('@/db/client', () => ({ prisma: db }));
import { frontdeskReportsService } from '@/modules/reports/frontdeskReports.service';

it.each([
  [undefined, 3200, 4],
  ['ACTIVE', 4200, 3],
  ['REVERSED', -1000, 1],
] as const)('nets refund receipts by default and respects explicit status %s', async (receiptStatus, total, count) => {
  const receipts = [1000, 2200, -1000, 1000].map((amount, i) => ({
    amount: new Decimal(amount), isReversed: amount < 0, method: 'CASH',
    receiptNumber: `REC-${i}`, collectedAt: new Date(),
    collectedBy: { displayName: 'Cashier', username: 'cashier' },
    hospitalInvoice: null, admissionRecord: null,
  }));
  db.paymentReceipt.findMany.mockImplementation(async ({ where }) => {
    if (where.isReversed !== undefined) return receipts.filter(r => r.isReversed === where.isReversed);
    expect(where.OR).toEqual([{ isReversed: false }, { amount: { lt: 0 } }]);
    return receipts;
  });
  const report = await frontdeskReportsService.getCollectionReport({ preset: 'today', receiptStatus });
  expect(report.summary.total.toNumber()).toBe(total);
  expect(report.summary.byMethod.CASH.toNumber()).toBe(total);
  expect(report.rows).toHaveLength(count);
  expect(report.rows.reduce((sum, row) => sum + row.amount.toNumber(), 0)).toBe(total);
});
