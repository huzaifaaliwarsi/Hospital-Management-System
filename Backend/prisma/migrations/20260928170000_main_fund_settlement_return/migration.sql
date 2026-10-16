-- AlterEnum
ALTER TYPE "MainFundEntryType" ADD VALUE 'SETTLEMENT_RETURN';

-- AlterTable
ALTER TABLE "main_cash_fund_entries" ADD COLUMN "related_account_settlement_id" TEXT;

-- CreateIndex
CREATE INDEX "main_cash_fund_entries_related_account_settlement_id_idx" ON "main_cash_fund_entries"("related_account_settlement_id");
