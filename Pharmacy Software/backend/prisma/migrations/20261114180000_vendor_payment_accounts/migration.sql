ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK';
CREATE TABLE IF NOT EXISTS "payment_accounts" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "is_active" BOOLEAN NOT NULL DEFAULT true, CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "payment_accounts_name_key" ON "payment_accounts"("name");
ALTER TABLE "cash_ledger_entries" ADD COLUMN IF NOT EXISTS "payment_account_id" TEXT, ADD COLUMN IF NOT EXISTS "payment_method" "PaymentMethod";
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_ledger_entries_payment_account_id_fkey') THEN
    ALTER TABLE "cash_ledger_entries" ADD CONSTRAINT "cash_ledger_entries_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "payment_account_id" TEXT;
ALTER TABLE "vendor_ledger_entries" ADD COLUMN IF NOT EXISTS "request_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_ledger_entries_request_key_key" ON "vendor_ledger_entries"("request_key");
