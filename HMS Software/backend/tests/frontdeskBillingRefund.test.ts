import { expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const db = vi.hoisted(() => ({
  paymentReceipt: { findMany: vi.fn() },
  hospitalInvoice: { findMany: vi.fn() },
}));
vi.mock('@/db/client', () => ({ prisma: db }));
import { frontdeskBillingReportService } from '@/modules/reports/frontdeskBilling.service';

it.each(['CASH', 'CARD', 'BANK', 'ONLINE'])('reports net collections after refund and recollection via %s', async (method) => {
  const row = (amount: number) => ({ amount: new Decimal(amount), method, hospitalInvoice: null, admissionRecord: null, appointment: null });
  db.hospitalInvoice.findMany.mockResolvedValue([]);
  for (const [amounts, expected] of [[[2200, 1000], 2200], [[2200, 1000, 1000], 3200]] as const) {
    db.paymentReceipt.findMany.mockImplementation(async ({ where }) =>
      [...amounts.map(row), row(-1000)]);
    const result = await frontdeskBillingReportService.getReport({ preset: 'today' });
    expect(result.collections.total.toNumber()).toBe(expected);
    expect(result.collections.byMethod[method].toNumber()).toBe(expected);
    expect(Object.values(result.collections.byMethod).reduce((sum, amount) => sum + amount.toNumber(), 0)).toBe(expected);
    expect(result.refunds.total.toNumber()).toBe(1000);
  }
});

it('keeps a refund-only period negative instead of hiding the outgoing cash', async () => {
  db.hospitalInvoice.findMany.mockResolvedValue([]);
  db.paymentReceipt.findMany.mockImplementation(async ({ where }) =>
    [{ amount: new Decimal(-1000), method: 'CASH', hospitalInvoice: null, admissionRecord: null, appointment: null }]);
  const result = await frontdeskBillingReportService.getReport({ preset: 'today' });
  expect(result.collections.total.toNumber()).toBe(-1000);
  expect(result.collections.byMethod.CASH.toNumber()).toBe(-1000);
});
