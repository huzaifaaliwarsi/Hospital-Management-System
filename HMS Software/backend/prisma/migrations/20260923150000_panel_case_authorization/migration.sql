-- Case authorization / guarantee enforcement (panel.md §15 backlog item 2).
-- Company-wide policy flag + per-case reference/limit/validity, captured at
-- intake and re-checked on every subsequent charge — a preauthorization
-- checkbox alone (PanelDiscountRule.preauthorization_required, already
-- existing) is metadata, not enforcement, until paired with these.
ALTER TABLE "corporate_panels"
 ADD COLUMN "authorization_required" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "admission_records"
 ADD COLUMN "authorization_number" TEXT,
 ADD COLUMN "authorization_limit" DECIMAL(14, 2),
 ADD COLUMN "authorization_valid_until" TIMESTAMP(3);

ALTER TABLE "hospital_invoices"
 ADD COLUMN "authorization_number" TEXT,
 ADD COLUMN "authorization_limit" DECIMAL(14, 2),
 ADD COLUMN "authorization_valid_until" TIMESTAMP(3);
