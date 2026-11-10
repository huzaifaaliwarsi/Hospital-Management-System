-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "panel_receivable" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "patient_share" DECIMAL(14,2) NOT NULL DEFAULT 0;

