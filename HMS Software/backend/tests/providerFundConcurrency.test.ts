import { beforeEach, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
const db = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock('@/db/client', () => ({ prisma: db }));
import { setupService } from '@/modules/setup/setup.service';
import { mainFundService } from '@/modules/cash/mainFund.service';

let balance: Decimal;
let vouchers: Map<string, any>;
let tail: Promise<void>;
let failDebit: boolean;
const body = {
  requestKey: '11111111-1111-4111-8111-111111111111', outsourcedProviderId: 'provider',
  departmentId: 'lab', settlementAmount: 600, paymentMethod: 'CASH' as const, status: 'FULL' as const,
};
beforeEach(() => {
  balance = new Decimal(1000); vouchers = new Map(); tail = Promise.resolve(); failDebit = false;
  db.$transaction.mockImplementation(async callback => {
    let unlock: (() => void) | undefined;
    const writes: Array<() => void> = [];
    const tx = {
      $executeRaw: async (sql: TemplateStringsArray) => {
        expect(sql.join('')).toContain('hms-main-cash-fund');
        const previous = tail;
        tail = new Promise<void>(resolve => { unlock = resolve; });
        await previous;
      },
      department: { findUnique: async () => ({
        id: 'lab', name: 'LAB', fulfillmentOwnership: 'OUTSOURCED', outsourcedProviderId: 'provider',
        outsourcedProvider: { isActive: true, allowedPaymentMethods: ['CASH'] },
      }) },
      providerSettlement: {
        findUnique: async ({ where }: any) => vouchers.get(where.id) ?? null,
        count: async () => 0,
        aggregate: async () => ({ _sum: { settlementAmount: [...vouchers.values()].reduce((s, v) => s.plus(v.settlementAmount), new Decimal(0)) } }),
        create: async ({ data }: any) => { writes.push(() => vouchers.set(data.id, data)); return data; },
      },
      paymentReceipt: { findMany: async () => [{
        amount: new Decimal(1000), collectedAt: new Date(),
        hospitalInvoice: { departmentId: 'lab', department: { id: 'lab', name: 'LAB' }, lines: [] },
      }] },
      panelRemittanceAllocation: { findMany: async () => [] },
      mainCashFundEntry: {
        findMany: async () => [{ direction: 'IN', amount: balance }],
        create: async ({ data }: any) => {
          if (failDebit) throw new Error('Fund write failed');
          writes.push(() => { balance = balance.minus(data.amount); });
          return data;
        },
      },
    };
    try {
      const result = await callback(tx);
      writes.forEach(write => write());
      return result;
    } finally { unlock?.(); }
  });
});
it('a provider payment and manual withdrawal cannot both spend the same Main Fund cash', async () => {
  const results = await Promise.allSettled([
    setupService.createProviderSettlement(body, 'actor'),
    mainFundService.withdraw({ amount: 600, note: 'Cash to bank' }, 'actor'),
  ]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(balance.toNumber()).toBe(400);
});
it('does not commit a provider voucher if the linked fund debit fails', async () => {
  failDebit = true;
  await expect(setupService.createProviderSettlement(body, 'actor')).rejects.toThrow('Fund write failed');
  expect(vouchers.size).toBe(0);
  expect(balance.toNumber()).toBe(1000);
});
