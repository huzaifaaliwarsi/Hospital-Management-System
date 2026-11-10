-- AlterTable
ALTER TABLE "admission_records" ADD COLUMN     "final_bill_number" TEXT,
ADD COLUMN     "final_bill_generated_at" TIMESTAMP(3),
ADD COLUMN     "final_bill_generated_by" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "admission_records_final_bill_number_key" ON "admission_records"("final_bill_number");

-- AddForeignKey
ALTER TABLE "admission_records" ADD CONSTRAINT "admission_records_final_bill_generated_by_fkey" FOREIGN KEY ("final_bill_generated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
