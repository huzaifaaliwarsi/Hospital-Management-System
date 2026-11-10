import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const columns = await db.$queryRaw`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('salary_payments','commission_payouts') ORDER BY table_name, ordinal_position`;
  const counts = await db.$queryRaw`SELECT 'salary' AS stream, count(*)::int AS payments, coalesce(sum(amount),0)::text AS paid FROM salary_payments UNION ALL SELECT 'commission', count(*)::int, coalesce(sum(amount),0)::text FROM commission_payouts`;
  console.log(JSON.stringify({ columns, counts }, null, 2));
}
main().finally(() => db.$disconnect());
