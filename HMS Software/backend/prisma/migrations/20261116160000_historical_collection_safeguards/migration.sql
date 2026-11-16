-- Additive only: preserve every existing invoice, receipt and cash entry.
ALTER TABLE "payment_receipts" ADD COLUMN "collection_request_key" TEXT;
ALTER TABLE "payment_receipts" ADD COLUMN "payment_account" TEXT;
CREATE UNIQUE INDEX "payment_receipts_collection_request_key_key" ON "payment_receipts"("collection_request_key");
