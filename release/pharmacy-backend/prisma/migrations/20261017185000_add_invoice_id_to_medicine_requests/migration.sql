-- AlterTable
ALTER TABLE "medicine_requests" ADD COLUMN IF NOT EXISTS "invoice_id" TEXT;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'medicine_requests_invoice_id_fkey'
    ) THEN
        ALTER TABLE "medicine_requests" ADD CONSTRAINT "medicine_requests_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "pharmacy_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
