-- AlterTable
ALTER TABLE "hospital_invoices" ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "panel_receivable" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "patient_share" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payment_receipts" ADD COLUMN     "appointment_id" TEXT;

-- AddForeignKey
ALTER TABLE "hospital_invoices" ADD CONSTRAINT "hospital_invoices_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

