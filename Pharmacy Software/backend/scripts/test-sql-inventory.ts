import 'dotenv/config';
import assert from 'node:assert/strict';
import { prisma } from '../src/db/client';
import { dashboardService } from '../src/modules/dashboard/dashboard.service';
import { Decimal } from '@prisma/client/runtime/library';

async function main() {
  const admin = await prisma.portalUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) throw new Error('No admin user');

  const now = new Date();
  const nearExpiryWindowDays = 90;
  const nearExpiryCutoff = new Date(now.getTime() + nearExpiryWindowDays * 86_400_000);

  const [activeMedicines, positiveBatches] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string;
      code: string;
      name: string;
      categoryLabel: string;
      reorderLevel: number;
      rate: number;
      unitCode: string;
      currentStock: number;
    }>>`
      SELECT 
        m.id,
        m.code,
        m.name,
        COALESCE(NULLIF(TRIM(m.category), ''), 'General') AS "categoryLabel",
        m.reorder_level::numeric AS "reorderLevel",
        COALESCE(m.purchase_rate, m.sale_rate, 0)::numeric AS "rate",
        COALESCE(u.short_code, u.name, m.unit, 'units') AS "unitCode",
        COALESCE(s.stock, 0)::numeric AS "currentStock"
      FROM medicine_masters m
      LEFT JOIN units u ON m.base_unit_id = u.id
      LEFT JOIN (
        SELECT medicine_id, SUM(quantity_delta) AS stock
        FROM stock_ledger_entries
        GROUP BY medicine_id
      ) s ON s.medicine_id = m.id
      WHERE m.is_active = true
      ORDER BY m.name ASC
    `,
    prisma.$queryRaw<Array<{
      id: string;
      medicineId: string;
      name: string;
      batchNumber: string;
      expiryDate: Date;
      batchStock: number;
    }>>`
      SELECT 
        b.id,
        b.medicine_id AS "medicineId",
        m.name,
        b.batch_number AS "batchNumber",
        b.expiry_date AS "expiryDate",
        bs.stock::numeric AS "batchStock"
      FROM medicine_batches b
      JOIN medicine_masters m ON b.medicine_id = m.id
      JOIN (
        SELECT batch_id, SUM(quantity_delta) AS stock
        FROM stock_ledger_entries
        WHERE batch_id IS NOT NULL
        GROUP BY batch_id
        HAVING SUM(quantity_delta) > 0
      ) bs ON bs.batch_id = b.id
      WHERE m.is_active = true
      ORDER BY b.expiry_date ASC
    `,
  ]);

  console.log(`Queried ${activeMedicines.length} medicines and ${positiveBatches.length} positive batches in parallel.`);

  // Compare with dashboardService.getManagementSummary
  const current = await dashboardService.getManagementSummary(admin.id);
  console.log('Current summary stats:', {
    totalMedicines: current.totalMedicines,
    totalStockUnits: current.totalStockUnits,
    lowStockCount: current.lowStockCount,
    outOfStockCount: current.outOfStockCount,
    nearExpiryCount: current.nearExpiryCount,
    expiredCount: current.expiredCount,
  });

  // Calculate stats from new SQL queries
  let stockValue = new Decimal(0);
  let totalStockUnits = new Decimal(0);
  let lowStock = 0;
  let outOfStock = 0;
  let nearExpiry = 0;
  let expired = 0;

  const batchesByMedicine = new Map<string, typeof positiveBatches>();
  const nearExpiryList: Array<{
    id: string;
    medicineId: string;
    name: string;
    batchNumber: string;
    expiryDate: string;
    daysLeft: number;
    quantityRemaining: number;
  }> = [];

  for (const b of positiveBatches) {
    const list = batchesByMedicine.get(b.medicineId) || [];
    list.push(b);
    batchesByMedicine.set(b.medicineId, list);

    const exp = new Date(b.expiryDate);
    if (exp <= now) {
      expired += 1;
    } else if (exp <= nearExpiryCutoff) {
      nearExpiry += 1;
      nearExpiryList.push({
        id: b.id,
        medicineId: b.medicineId,
        name: b.name,
        batchNumber: b.batchNumber,
        expiryDate: exp.toISOString(),
        daysLeft: Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / 86_400_000)),
        quantityRemaining: Number(b.batchStock),
      });
    }
  }

  const categoryMap: Record<string, { count: number; stock: Decimal }> = {};
  const inventoryOverview: Array<any> = [];
  const lowStockList: Array<any> = [];

  for (const m of activeMedicines) {
    const stock = new Decimal(m.currentStock);
    totalStockUnits = totalStockUnits.plus(stock);
    stockValue = stockValue.plus(stock.mul(m.rate));

    const catName = m.categoryLabel || 'General';
    if (!categoryMap[catName]) categoryMap[catName] = { count: 0, stock: zero() };
    categoryMap[catName].count += 1;
    categoryMap[catName].stock = categoryMap[catName].stock.plus(stock);

    const isOut = stock.lessThanOrEqualTo(0);
    const isLow = !isOut && stock.lessThanOrEqualTo(m.reorderLevel);

    if (isOut) {
      outOfStock += 1;
      lowStockList.push({
        id: m.id,
        name: m.name,
        currentStock: 0,
        reorderLevel: Number(m.reorderLevel),
        unit: m.unitCode,
        isOutOfStock: true,
      });
    } else if (isLow) {
      lowStock += 1;
      lowStockList.push({
        id: m.id,
        name: m.name,
        currentStock: stock.toNumber(),
        reorderLevel: Number(m.reorderLevel),
        unit: m.unitCode,
        isOutOfStock: false,
      });
    }

    const medBatches = batchesByMedicine.get(m.id) || [];
    const earliestBatch = medBatches[0];
    const hasExpired = medBatches.some((b) => new Date(b.expiryDate) <= now);
    const hasNearExpiry = medBatches.some((b) => {
      const exp = new Date(b.expiryDate);
      return exp > now && exp <= nearExpiryCutoff;
    });

    const itemStatus = isOut || hasExpired ? 'Critical' : isLow || hasNearExpiry ? 'Low Stock' : 'Healthy';
    inventoryOverview.push({
      id: m.id,
      code: m.code,
      name: m.name,
      category: catName,
      currentStock: stock.toNumber(),
      reorderLevel: Number(m.reorderLevel),
      expiryDate: earliestBatch ? new Date(earliestBatch.expiryDate).toISOString() : null,
      status: itemStatus,
      batchNumber: earliestBatch ? earliestBatch.batchNumber : null,
    });
  }

  console.log('Optimized SQL stats:', {
    totalMedicines: activeMedicines.length,
    totalStockUnits: totalStockUnits.toNumber(),
    lowStockCount: lowStock + outOfStock,
    outOfStockCount: outOfStock,
    nearExpiryCount: nearExpiry,
    expiredCount: expired,
  });

  assert.equal(activeMedicines.length, current.totalMedicines, 'totalMedicines');
  assert.equal(totalStockUnits.toNumber(), current.totalStockUnits, 'totalStockUnits');
  assert.equal(lowStock + outOfStock, current.lowStockCount, 'lowStockCount');
  assert.equal(outOfStock, current.outOfStockCount, 'outOfStockCount');
  assert.equal(nearExpiry, current.nearExpiryCount, 'nearExpiryCount');
  assert.equal(expired, current.expiredCount, 'expiredCount');

  console.log('PASS: SQL Inventory Aggregations match current dashboard exactly!');
  await prisma.$disconnect();
}

function zero() {
  return new Decimal(0);
}

main().catch(console.error);

