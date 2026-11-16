ALTER TABLE "pharmacy_payments" ADD COLUMN IF NOT EXISTS "request_key" TEXT,
  ADD COLUMN IF NOT EXISTS "is_initial" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "payment_account_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "pharmacy_payments_request_key_key" ON "pharmacy_payments"("request_key");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_payments_payment_account_id_fkey') THEN
    ALTER TABLE "pharmacy_payments" ADD CONSTRAINT "pharmacy_payments_payment_account_id_fkey"
      FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
