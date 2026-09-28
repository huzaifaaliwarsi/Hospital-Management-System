-- AlterTable
ALTER TABLE "purchase_order_lines" ADD COLUMN     "batch_no" TEXT,
ADD COLUMN     "expiry_date" DATE;

-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "stock_ledger" ADD COLUMN     "batch_no" TEXT,
ADD COLUMN     "expiry_date" DATE;

-- CreateIndex
CREATE INDEX "stock_ledger_stock_item_id_batch_no_idx" ON "stock_ledger"("stock_item_id", "batch_no");

-- CreateIndex
CREATE INDEX "stock_ledger_expiry_date_idx" ON "stock_ledger"("expiry_date");
