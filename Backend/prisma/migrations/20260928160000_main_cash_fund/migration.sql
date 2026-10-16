-- CreateEnum
CREATE TYPE "MainFundEntryType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'PETTY_CASH_ISSUE');

-- CreateTable
CREATE TABLE "main_cash_fund_entries" (
    "id" TEXT NOT NULL,
    "direction" "CashDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "type" "MainFundEntryType" NOT NULL,
    "note" TEXT,
    "performed_by" TEXT NOT NULL,
    "related_user_cash_balance_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "main_cash_fund_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "main_cash_fund_entries_related_user_cash_balance_id_key" ON "main_cash_fund_entries"("related_user_cash_balance_id");

-- CreateIndex
CREATE INDEX "main_cash_fund_entries_occurred_at_idx" ON "main_cash_fund_entries"("occurred_at");

-- AddForeignKey
ALTER TABLE "main_cash_fund_entries" ADD CONSTRAINT "main_cash_fund_entries_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
