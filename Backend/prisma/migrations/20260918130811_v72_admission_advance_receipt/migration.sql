-- AlterTable
ALTER TABLE "payment_receipts" ADD COLUMN     "admission_record_id" TEXT;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_admission_record_id_fkey" FOREIGN KEY ("admission_record_id") REFERENCES "admission_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

