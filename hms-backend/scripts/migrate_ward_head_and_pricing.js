const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Migrating ward head_staff_id and fixed_price columns...');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "wards" ADD COLUMN IF NOT EXISTS "head_staff_id" TEXT REFERENCES "staff"("id") ON DELETE SET NULL;
  `);
  console.log('Column head_staff_id verified on wards table.');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "wards" ADD COLUMN IF NOT EXISTS "fixed_price" DECIMAL(14, 2);
  `);
  console.log('Column fixed_price verified on wards table.');

  console.log('Migration completed successfully.');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
