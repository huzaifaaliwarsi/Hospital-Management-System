-- AlterTable
ALTER TABLE "pharmacy_settings" ADD COLUMN     "default_tax_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "max_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "near_expiry_window_days" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "receipt_footer_text" TEXT,
ADD COLUMN     "receipt_header_text" TEXT;
