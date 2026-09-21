const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Running service deletion migration...');

  // 1. Add is_deleted and deleted_at columns if not present
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "service_rates" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "service_rates" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
  `);
  console.log('Columns is_deleted and deleted_at verified on service_rates.');

  // 2. Ensure only the 3 default encounter services have non-NONE encounterType
  // Reset any service that is not default encounter service
  await prisma.$executeRawUnsafe(`
    UPDATE "service_rates"
    SET "encounter_type" = 'NONE', "is_default_encounter_service" = false
    WHERE "code" NOT IN ('SRV-0018', 'SRV-0004', 'SRV-0003');
  `);

  // Explicitly ensure the 3 default encounter services are properly configured
  await prisma.$executeRawUnsafe(`
    UPDATE "service_rates"
    SET "encounter_type" = 'OPD', "is_default_encounter_service" = true
    WHERE "code" = 'SRV-0018';
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "service_rates"
    SET "encounter_type" = 'OBSERVATION', "is_default_encounter_service" = true
    WHERE "code" = 'SRV-0004';
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "service_rates"
    SET "encounter_type" = 'EMERGENCY', "is_default_encounter_service" = true
    WHERE "code" = 'SRV-0003';
  `);

  const services = await prisma.serviceRate.findMany({
    select: { id: true, code: true, name: true, encounterType: true, isDefaultEncounterService: true }
  });
  console.log('Current service rates encounter configuration:');
  console.log(JSON.stringify(services, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
