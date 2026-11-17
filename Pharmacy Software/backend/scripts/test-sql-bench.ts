import 'dotenv/config';
import { prisma } from '../src/db/client';
import { Prisma } from '@prisma/client';

async function main() {
  const count = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM medicine_masters WHERE is_active = true`;
  console.log('Active medicines:', Number(count[0].count));

  const stocks = await prisma.$queryRaw<any[]>`
    SELECT 
      m.id,
      m.code,
      m.name,
      COALESCE(m.category, 'General') AS category,
      m.reorder_level::numeric AS "reorderLevel",
      COALESCE(m.purchase_rate, m.sale_rate)::numeric AS "rate",
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
  `;
  console.log('Queried stocks count:', stocks.length, 'First item:', stocks[0]);

  const batches = await prisma.$queryRaw<any[]>`
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
  `;
  console.log('Queried positive stock batches:', batches.length);
  await prisma.$disconnect();
}

main().catch(console.error);

