ALTER TABLE "pharmacy_payments" ADD COLUMN "request_key" TEXT,
  ADD COLUMN "is_initial" BOOLEAN,
  ADD COLUMN "payment_account_id" TEXT;
CREATE UNIQUE INDEX "pharmacy_payments_request_key_key" ON "pharmacy_payments"("request_key");
ALTER TABLE "pharmacy_payments" ADD CONSTRAINT "pharmacy_payments_payment_account_id_fkey"
  FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
