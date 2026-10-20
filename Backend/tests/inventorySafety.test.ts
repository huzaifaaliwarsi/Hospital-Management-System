import { beforeEach, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  department: { findUnique: vi.fn() },
  stockItem: { findUnique: vi.fn() },
  departmentRequisition: { create: vi.fn() },
  stockLedger: { create: vi.fn() },
  stockAdjustment: { create: vi.fn() },
}));
vi.mock('@/db/client', () => ({ prisma: db }));
import { inventoryService } from '@/modules/inventory/inventory.service';
let stock: Decimal;
let tail: Promise<void>;
let locks: number;
beforeEach(() => {
  vi.clearAllMocks();
  stock = new Decimal(10);
  tail = Promise.resolve();
  locks = 0;
  // Model transaction-scoped lock ownership: every concurrent operation has its own tx.
  db.$transaction.mockImplementation(async callback => {
    let release: (() => void) | undefined;
    let held = false;
    const tx = { ...db, $executeRaw: vi.fn(async () => {
      const previous = tail;
      tail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      held = true;
      locks++;
    }) };
    try { return await callback(tx); } finally { if (held) release?.(); }
  });
  db.department.findUnique.mockResolvedValue({ id: 'dept' });
  db.stockItem.findUnique.mockImplementation(async () => ({
    id: 'item', name: 'Gloves', unit: 'PCS', isActive: true,
    stockLedgerEntries: [{ quantityDelta: stock }],
  }));
  db.departmentRequisition.create.mockImplementation(async ({ data }) => {
    await new Promise(resolve => setTimeout(resolve, 5));
    return { id: 'issue', lines: data.lines.create };
  });
  db.stockLedger.create.mockImplementation(async ({ data }) => {
    stock = stock.plus(data.quantityDelta);
    return data;
  });
  db.stockAdjustment.create.mockResolvedValue({ id: 'adjustment' });
});
it('rejects duplicate issue rows before any stock is changed', async () => {
  await expect(inventoryService.issueToDepartment({
    departmentId: 'dept', lines: [{ stockItemId: 'item', quantity: 7 }, { stockItemId: 'item', quantity: 7 }],
  }, 'actor')).rejects.toThrow('only once');
  expect(stock.toNumber()).toBe(10);
  expect(db.$transaction).not.toHaveBeenCalled();
});
it('issues exactly the available balance and rejects a later issue', async () => {
  const body = { departmentId: 'dept', lines: [{ stockItemId: 'item', quantity: 10 }] };
  await inventoryService.issueToDepartment(body, 'actor');
  expect(stock.toNumber()).toBe(0);
  await expect(inventoryService.issueToDepartment(body, 'actor')).rejects.toThrow('Insufficient stock');
});
it('serializes two competing issues so only one can consume the same balance', async () => {
  const body = { departmentId: 'dept', lines: [{ stockItemId: 'item', quantity: 7 }] };
  const results = await Promise.allSettled([
    inventoryService.issueToDepartment(body, 'one'),
    inventoryService.issueToDepartment(body, 'two'),
  ]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(stock.toNumber()).toBe(3);
  expect(locks).toBe(2);
});
it('uses the same lock for stock adjustments and department issues', async () => {
  const results = await Promise.allSettled([
    inventoryService.issueToDepartment({ departmentId: 'dept', lines: [{ stockItemId: 'item', quantity: 7 }] }, 'actor'),
    inventoryService.createAdjustment({
      stockItemId: 'item', type: 'DAMAGE', direction: 'DECREASE', quantity: 7,
      reason: 'Damaged stock', requiresApproval: false,
    }, 'actor'),
  ]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(stock.toNumber()).toBe(3);
  expect(locks).toBe(2);
});
it('rejects duplicate supplier and department return rows', async () => {
  await expect(inventoryService.returnToSupplier({
    supplierId: 'supplier', purchaseOrderId: 'purchase', refundMethod: 'ADJUST_PAYABLE',
    lines: [{ stockItemId: 'item', quantity: 7, rate: 10 }, { stockItemId: 'item', quantity: 7, rate: 10 }],
  } as any, 'actor')).rejects.toThrow('only once');
  await expect(inventoryService.receiveDepartmentReturn({
    departmentRequisitionId: 'issue',
    lines: [
      { departmentRequisitionLineId: 'line', quantity: 7, condition: 'USABLE' },
      { departmentRequisitionLineId: 'line', quantity: 7, condition: 'USABLE' },
    ],
  }, 'actor')).rejects.toThrow('only once');
  expect(db.$transaction).not.toHaveBeenCalled();
});
