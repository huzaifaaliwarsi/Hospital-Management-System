import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';

export interface BatchBalance {
  stockItemId: string;
  batchNo: string;
  expiryDate: Date;
  balance: Decimal;
}

/**
 * Per-batch remaining quantity — `SUM(quantity_delta)` grouped by
 * (stock_item_id, batch_no), same reasoning as `StockLedger`'s own schema
 * comment (inventory.md §7.2/§9 step 1): no separate mutable balance table,
 * computed at query time. Only rows with a batch/expiry are relevant here
 * (plain non-batched stock has nothing to expire).
 *
 * Shared by `inventoryReports.service.ts` (Inventory portal's own Near
 * Expiry/Stock Status reports) and `dashboard.service.ts` (Super Admin
 * dashboard's Inventory Alert Summary) so both surfaces agree on the exact
 * same near-expiry/expired figures — inventory.md's own integration note.
 */
export async function getPositiveBatchBalances(expiryBeforeInclusive?: Date): Promise<BatchBalance[]> {
  const rows = await prisma.stockLedger.findMany({
    where: { batchNo: { not: null }, expiryDate: { not: null } },
    select: { stockItemId: true, batchNo: true, expiryDate: true, quantityDelta: true },
  });

  const byBatch = new Map<string, BatchBalance>();
  for (const r of rows) {
    const key = `${r.stockItemId}::${r.batchNo}`;
    const existing = byBatch.get(key);
    if (existing) {
      existing.balance = existing.balance.plus(r.quantityDelta);
    } else {
      byBatch.set(key, { stockItemId: r.stockItemId, batchNo: r.batchNo!, expiryDate: r.expiryDate!, balance: new Decimal(r.quantityDelta) });
    }
  }

  return Array.from(byBatch.values()).filter(
    (b) => b.balance.greaterThan(0) && (!expiryBeforeInclusive || b.expiryDate <= expiryBeforeInclusive),
  );
}
