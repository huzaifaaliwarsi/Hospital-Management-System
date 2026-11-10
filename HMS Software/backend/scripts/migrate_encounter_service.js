const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "service_rates" ADD COLUMN IF NOT EXISTS "encounter_type" TEXT DEFAULT 'NONE';
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "service_rates" ADD COLUMN IF NOT EXISTS "is_default_encounter_service" BOOLEAN NOT NULL DEFAULT false;
  `);
  console.log('Columns added to service_rates table.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
