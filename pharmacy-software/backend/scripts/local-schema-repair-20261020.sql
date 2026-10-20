BEGIN;
SET LOCAL lock_timeout = '5s';
-- CreateEnum
CREATE TYPE "CollectionOwner" AS ENUM ('PHARMACY_RETAIL', 'HMS_FRONT_DESK');

-- CreateEnum
CREATE TYPE "InternalSettlementStatus" AS ENUM ('NOT_DUE', 'PENDING', 'REQUESTED', 'PARTIALLY_RELEASED', 'SETTLED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "pharmacy_invoices" DROP CONSTRAINT "pharmacy_invoices_medicine_request_id_fkey";

-- DropIndex
DROP INDEX "pharmacy_invoices_medicine_request_id_key";

-- AlterTable
ALTER TABLE "medicine_requests" ADD COLUMN     "invoice_id" TEXT;

-- AlterTable
ALTER TABLE "pharmacy_invoice_lines" ADD COLUMN     "dispense_event_id" TEXT,
ADD COLUMN     "dispensed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dispensed_by" TEXT,
ADD COLUMN     "external_request_ref" TEXT,
ADD COLUMN     "medicine_request_id" TEXT,
ADD COLUMN     "request_line_id" TEXT,
ADD COLUMN     "returned_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
ADD COLUMN     "returned_value" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pharmacy_invoices" ADD COLUMN     "collection_owner" "CollectionOwner" NOT NULL DEFAULT 'PHARMACY_RETAIL',
ADD COLUMN     "external_admission_ref" TEXT,
ADD COLUMN     "hms_collected_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hms_receivable" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hms_settled_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "internal_settlement_status" "InternalSettlementStatus",
ADD COLUMN     "processed_collection_receipts" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "hms_receivable_settlements" (
    "id" TEXT NOT NULL,
    "settlement_number" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "external_admission_ref" TEXT NOT NULL,
    "patient_name_snapshot" TEXT,
    "invoice_number" TEXT NOT NULL,
    "invoice_total" DECIMAL(14,2) NOT NULL,
    "hms_collected" DECIMAL(14,2) NOT NULL,
    "amount_requested" DECIMAL(14,2) NOT NULL,
    "amount_released" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remaining_receivable" DECIMAL(14,2) NOT NULL,
    "status" "InternalSettlementStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "payment_method" TEXT,
    "payment_reference" TEXT,
    "release_remarks" TEXT,

    CONSTRAINT "hms_receivable_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hms_receivable_settlements_settlement_number_key" ON "hms_receivable_settlements"("settlement_number");

-- CreateIndex
CREATE INDEX "pharmacy_invoice_lines_invoice_id_dispense_event_id_idx" ON "pharmacy_invoice_lines"("invoice_id", "dispense_event_id");

-- CreateIndex
CREATE INDEX "pharmacy_invoices_channel_external_admission_ref_idx" ON "pharmacy_invoices"("channel", "external_admission_ref");

-- AddForeignKey
ALTER TABLE "medicine_requests" ADD CONSTRAINT "medicine_requests_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "pharmacy_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hms_receivable_settlements" ADD CONSTRAINT "hms_receivable_settlements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "pharmacy_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hms_receivable_settlements" ADD CONSTRAINT "hms_receivable_settlements_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve the existing request-to-invoice link when changing relation direction.
UPDATE medicine_requests AS r SET invoice_id = i.id FROM pharmacy_invoices AS i WHERE i.medicine_request_id = r.id AND r.invoice_id IS NULL;

COMMIT;
