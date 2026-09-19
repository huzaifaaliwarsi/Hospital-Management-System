-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ServiceStream" AS ENUM ('HOSPITAL', 'LAB');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "service_rates" ADD COLUMN IF NOT EXISTS "service_stream" "ServiceStream" NOT NULL DEFAULT 'HOSPITAL';
