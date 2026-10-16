-- AlterTable
ALTER TABLE "biometric_raw_punches" ALTER COLUMN "device_source" SET DEFAULT 'HTTP_ADMS';

-- AlterTable
ALTER TABLE "hospital_invoices" ADD COLUMN IF NOT EXISTS "notes" TEXT,
ADD COLUMN IF NOT EXISTS "weight_kg" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "self_pay_encounters" ADD COLUMN IF NOT EXISTS "weight_kg" DECIMAL(5,2);
