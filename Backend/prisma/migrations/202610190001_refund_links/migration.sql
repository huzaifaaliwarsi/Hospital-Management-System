ALTER TABLE "payment_receipts" ADD COLUMN "refund_request_key" TEXT;
ALTER TABLE "payment_receipts" ADD COLUMN "original_receipt_id" TEXT;
CREATE UNIQUE INDEX "payment_receipts_refund_request_key_key" ON "payment_receipts"("refund_request_key");
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_original_receipt_id_fkey" FOREIGN KEY ("original_receipt_id") REFERENCES "payment_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
