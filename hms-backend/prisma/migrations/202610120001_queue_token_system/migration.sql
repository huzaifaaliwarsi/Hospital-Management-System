-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_service_rate_id_fkey";
ALTER TABLE "invoice_line_items" DROP CONSTRAINT IF EXISTS "invoice_line_items_service_rate_id_fkey";
ALTER TABLE "shifts" DROP CONSTRAINT IF EXISTS "shifts_department_id_fkey";

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "queue_date" DATE,
ADD COLUMN IF NOT EXISTS "queue_number" TEXT,
ADD COLUMN IF NOT EXISTS "queue_sequence" INTEGER;

-- AlterTable
ALTER TABLE "hospital_invoices" ADD COLUMN IF NOT EXISTS "queue_date" DATE,
ADD COLUMN IF NOT EXISTS "queue_number" TEXT,
ADD COLUMN IF NOT EXISTS "queue_sequence" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "daily_queue_sequences" (
    "id" TEXT NOT NULL,
    "encounter_type" "EncounterType" NOT NULL,
    "date" DATE NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_queue_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "daily_queue_sequences_encounter_type_date_key" ON "daily_queue_sequences"("encounter_type", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointments_queue_number_idx" ON "appointments"("queue_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hospital_invoices_queue_date_encounter_type_idx" ON "hospital_invoices"("queue_date", "encounter_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hospital_invoices_queue_number_idx" ON "hospital_invoices"("queue_number");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "hospital_invoices_encounter_type_queue_date_queue_sequence_key" ON "hospital_invoices"("encounter_type", "queue_date", "queue_sequence");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_rate_id_fkey" FOREIGN KEY ("service_rate_id") REFERENCES "service_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_service_rate_id_fkey" FOREIGN KEY ("service_rate_id") REFERENCES "service_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
