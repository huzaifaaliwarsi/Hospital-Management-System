-- Historical payer ownership (panel.md §14 backlog item 1). Freeze which
-- corporate panel owned each invoice at posting time, so a later membership
-- transfer (patient moves to a different company) never silently moves an
-- old invoice's receivable to the new company nor drops it from the old
-- company's statement/ledger/remittance queries.
ALTER TABLE "hospital_invoices"
 ADD COLUMN "corporate_panel_id" TEXT REFERENCES "corporate_panels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "hospital_invoices_corporate_panel_id_idx" ON "hospital_invoices"("corporate_panel_id");

-- Backfill from each invoice's currently-linked panel patient. This is a
-- best-effort backfill using the only evidence available (D15/§6-item-2):
-- every pre-existing invoice was posted while its patient belonged to their
-- current company, since company transfer was blocked until this change.
UPDATE "hospital_invoices" hi
SET "corporate_panel_id" = pp.corporate_panel_id
FROM "panel_patients" pp
WHERE hi.panel_patient_id = pp.id
  AND hi.corporate_panel_id IS NULL;
