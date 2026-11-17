import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkIndexes() {
  const indexes = await prisma.$queryRaw<any[]>`
    SELECT
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename IN ('pharmacy_invoices', 'pharmacy_payments', 'pharmacy_financial_events', 'cash_ledger_entries')
    ORDER BY tablename, indexname;
  `;
  console.log('Existing indexes:');
  for (const idx of indexes) {
    console.log(`- ${idx.tablename} -> ${idx.indexname}: ${idx.indexdef}`);
  }
  await prisma.$disconnect();
}

checkIndexes().catch(console.error);
