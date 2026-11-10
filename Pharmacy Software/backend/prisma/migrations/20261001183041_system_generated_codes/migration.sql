-- AlterTable
ALTER TABLE "account_settlements" ADD COLUMN     "settlement_number" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "cash_ledger_entries" ADD COLUMN     "reference_no" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "expense_number" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "stock_adjustments" ADD COLUMN     "adjustment_number" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "vendor_ledger_entries" ADD COLUMN     "reference_no" TEXT;

-- CreateTable
CREATE TABLE "document_sequences" (
    "key" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_settlements_settlement_number_key" ON "account_settlements"("settlement_number");

-- CreateIndex
CREATE UNIQUE INDEX "cash_ledger_entries_reference_no_key" ON "cash_ledger_entries"("reference_no");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_expense_number_key" ON "expenses"("expense_number");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_adjustment_number_key" ON "stock_adjustments"("adjustment_number");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_ledger_entries_reference_no_key" ON "vendor_ledger_entries"("reference_no");

