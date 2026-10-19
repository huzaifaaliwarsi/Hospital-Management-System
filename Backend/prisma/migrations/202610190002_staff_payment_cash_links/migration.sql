ALTER TYPE "CashCategory" ADD VALUE IF NOT EXISTS 'SALARY_PAYMENT';
ALTER TYPE "CashCategory" ADD VALUE IF NOT EXISTS 'COMMISSION_PAYMENT';

ALTER TABLE "salary_payments"
  ADD COLUMN "request_key" TEXT,
  ADD COLUMN "reversal_of_id" TEXT,
  ADD COLUMN "reversal_reason" TEXT,
  ADD COLUMN "cash_entry_id" TEXT;
CREATE UNIQUE INDEX "salary_payments_request_key_key" ON "salary_payments"("request_key");
CREATE UNIQUE INDEX "salary_payments_reversal_of_id_key" ON "salary_payments"("reversal_of_id");
CREATE UNIQUE INDEX "salary_payments_cash_entry_id_key" ON "salary_payments"("cash_entry_id");
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "salary_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_cash_entry_id_fkey" FOREIGN KEY ("cash_entry_id") REFERENCES "user_cash_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commission_payouts"
  ADD COLUMN "request_key" TEXT,
  ADD COLUMN "reversal_of_id" TEXT,
  ADD COLUMN "reversal_reason" TEXT,
  ADD COLUMN "cash_entry_id" TEXT;
CREATE UNIQUE INDEX "commission_payouts_request_key_key" ON "commission_payouts"("request_key");
CREATE UNIQUE INDEX "commission_payouts_reversal_of_id_key" ON "commission_payouts"("reversal_of_id");
CREATE UNIQUE INDEX "commission_payouts_cash_entry_id_key" ON "commission_payouts"("cash_entry_id");
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "commission_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_cash_entry_id_fkey" FOREIGN KEY ("cash_entry_id") REFERENCES "user_cash_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
