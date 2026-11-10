-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FLAT');

-- AlterTable
ALTER TABLE "pharmacy_settings" ADD COLUMN     "default_markup_percent" DECIMAL(6,2) NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "purchase_lines" ADD COLUMN     "discount_type" "DiscountType" NOT NULL DEFAULT 'FLAT',
ADD COLUMN     "final_sale_rate" DECIMAL(14,2),
ADD COLUMN     "freight_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "packaging_overridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suggested_sale_rate" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "freight_total" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "markup_rules" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "markup_percent" DECIMAL(6,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markup_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "markup_rules_category_key" ON "markup_rules"("category");

