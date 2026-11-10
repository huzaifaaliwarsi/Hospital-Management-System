-- Additive v7.4 foundation. Existing financial amounts are not rewritten.
CREATE TABLE "panel_categories" (
  "name" TEXT NOT NULL PRIMARY KEY,
  "is_active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "panel_categories" ("name") VALUES
  ('Employer / Corporate Company'), ('Insurance'), ('Institutional / Contract Panel');
INSERT INTO "panel_categories" ("name")
  SELECT DISTINCT "category" FROM "corporate_panels" WHERE "category" IS NOT NULL AND trim("category") <> ''
  ON CONFLICT DO NOTHING;

ALTER TABLE "corporate_panels"
  ADD COLUMN "legal_billing_name" TEXT,
  ADD COLUMN "contact_phone" TEXT,
  ADD COLUMN "contact_email" TEXT,
  ADD COLUMN "billing_terms" TEXT;

DROP INDEX "panel_discount_rules_corporate_panel_id_service_rate_id_eff_key";
ALTER TABLE "panel_discount_rules"
  ALTER COLUMN "service_rate_id" DROP NOT NULL,
  ADD COLUMN "department_id" TEXT,
  ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'SERVICE',
  ADD COLUMN "coverage_type" TEXT NOT NULL DEFAULT 'LEGACY_DISCOUNT',
  ADD COLUMN "fixed_patient_share" DECIMAL(14,2),
  ADD COLUMN "contract_rate" DECIMAL(14,2),
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "created_by" TEXT;
UPDATE "panel_discount_rules" SET "coverage_type" = 'PERCENTAGE' WHERE "coverage_percent" IS NOT NULL;
ALTER TABLE "panel_discount_rules" ADD CONSTRAINT "panel_discount_rules_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "panel_discount_rules_corporate_panel_id_archived_at_idx" ON "panel_discount_rules"("corporate_panel_id", "archived_at");
ALTER TABLE "invoice_line_items" ADD COLUMN "coverage_snapshot" JSONB;
