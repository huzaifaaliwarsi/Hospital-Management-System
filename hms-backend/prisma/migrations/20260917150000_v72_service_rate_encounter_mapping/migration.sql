-- AlterTable
ALTER TABLE "service_rates" ADD COLUMN IF NOT EXISTS "encounter_type" TEXT DEFAULT 'NONE';
ALTER TABLE "service_rates" ADD COLUMN IF NOT EXISTS "is_default_encounter_service" BOOLEAN NOT NULL DEFAULT false;
