-- CreateEnum
CREATE TYPE "StockAdjustmentType" AS ENUM ('DAMAGE', 'EXPIRY', 'COUNT_CORRECTION', 'LOSS', 'SURPLUS', 'QUARANTINE');

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "batch_no" TEXT,
    "type" "StockAdjustmentType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_adjustments_stock_item_id_created_at_idx" ON "stock_adjustments"("stock_item_id", "created_at");

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
