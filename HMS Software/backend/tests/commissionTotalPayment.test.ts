import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
const h = vi.hoisted(() => ({ tx: {} as any, cash: vi.fn() }));
vi.mock('@/db/client', () => ({ prisma: { $transaction: (fn: any) => fn(h.tx) } }));
vi.mock('@/modules/cash/staffPaymentCash', () => ({ postStaffPaymentCash: h.cash }));
import { commissionService } from '@/modules/commission/commission.service';
const d = (n: number) => new Decimal(n);
const body = { staffId: 'doctor', accrualIds: ['a', 'b'], amount: 137.35, requestKey: 'request', method: 'BANK' as const };
let rows: any[];
let previous: any[];
beforeEach(() => {
  vi.clearAllMocks(); previous = [];
  rows = [
    { id: 'a', staffId: 'doctor', status: 'PARTIALLY_PAID', commissionAmount: d(100), ruleSnapshot: { commissionTaxAmount: 10 }, reversals: [], adjustments: [{ amount: d(5) }], payouts: [{ amount: d(20) }] },
    { id: 'b', staffId: 'doctor', status: 'APPROVED', commissionAmount: d(80.5), ruleSnapshot: { commissionTaxAmount: 8.05 }, reversals: [{ reversalAmount: d(10.1), taxAmount: d(0) }], adjustments: [], payouts: [] },
  ];
  h.tx = { $executeRaw: vi.fn(), $queryRaw: vi.fn(), doctorCommissionAccrual: { findMany: vi.fn(async () => rows), update: vi.fn() }, commissionPayout: { findMany: vi.fn(async () => previous), create: vi.fn(async ({ data }: any) => { previous.push(data); return data; }) } };
});
describe('combined doctor commission payment', () => {
  it('pays exact net balances after tax, refund, adjustment and prior payments', async () => {
    const result = await commissionService.payDoctorTotal(body, 'actor');
    expect(result.amount.toString()).toBe('137.35');
    expect(h.tx.commissionPayout.create.mock.calls.map(([arg]: any) => arg.data.amount.toString())).toEqual(['75', '62.35']);
    expect(h.tx.doctorCommissionAccrual.update).toHaveBeenCalledTimes(2);
    expect(h.cash).toHaveBeenCalledTimes(2);
  });
  it('retries successfully without paying twice, including after status changes', async () => {
    await commissionService.payDoctorTotal(body, 'actor');
    rows.forEach(r => r.status = 'PAID');
    await commissionService.payDoctorTotal(body, 'actor');
    expect(h.tx.commissionPayout.create).toHaveBeenCalledTimes(2);
    await expect(commissionService.payDoctorTotal({ ...body, amount: 1 }, 'actor')).rejects.toThrow('different payment details');
  });
  it.each(['stale', 'unapproved', 'wrong-doctor', 'missing'])('rejects %s entries before writing payments', async kind => {
    if (kind === 'stale') rows[0].payouts.push({ amount: d(1) });
    if (kind === 'unapproved') rows[1].status = 'ACCRUED';
    if (kind === 'wrong-doctor') rows[1].staffId = 'other';
    if (kind === 'missing') rows.pop();
    await expect(commissionService.payDoctorTotal(body, 'actor')).rejects.toThrow();
    expect(h.tx.commissionPayout.create).not.toHaveBeenCalled();
    expect(h.cash).not.toHaveBeenCalled();
  });
});
