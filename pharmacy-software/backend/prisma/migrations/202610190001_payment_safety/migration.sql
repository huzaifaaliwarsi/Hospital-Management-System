ALTER TABLE "pharmacy_invoice_lines" ADD COLUMN "returned_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0;
ALTER TABLE "pharmacy_invoice_lines" ADD COLUMN "returned_value" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "pharmacy_invoices" ADD COLUMN "processed_collection_receipts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "pharmacy_invoice_lines" ADD CONSTRAINT "returned_quantity_bounds" CHECK ("returned_quantity" >= 0 AND "returned_quantity" <= "quantity");
