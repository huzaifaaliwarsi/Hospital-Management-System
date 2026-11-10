ALTER TABLE "corporate_panels"
 ADD COLUMN "member_id_label" TEXT,
 ADD COLUMN "member_id_required" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "membership_validity_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "panel_patients"
 ADD COLUMN "membership_status" TEXT NOT NULL DEFAULT 'ACTIVE',
 ADD COLUMN "membership_valid_from" DATE,
 ADD COLUMN "membership_valid_to" DATE,
 ADD COLUMN "policy_number" TEXT,
 ADD COLUMN "plan_name" TEXT,
 ADD COLUMN "principal_member_name" TEXT,
 ADD COLUMN "member_relationship" TEXT,
 ADD CONSTRAINT "panel_membership_dates_check" CHECK (membership_valid_to IS NULL OR membership_valid_from IS NULL OR membership_valid_to >= membership_valid_from),
 ADD CONSTRAINT "panel_membership_status_check" CHECK (membership_status IN ('ACTIVE', 'SUSPENDED', 'CANCELLED'));
CREATE TABLE "panel_membership_history" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "panel_patient_id" TEXT NOT NULL REFERENCES "panel_patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "snapshot" JSONB NOT NULL,
 "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "recorded_by" TEXT
);
CREATE INDEX "panel_membership_history_patient_date_idx" ON "panel_membership_history"("panel_patient_id", "recorded_at");
-- Preserve the pre-upgrade identity as the first revision, without guessing dates.
INSERT INTO "panel_membership_history" (id, panel_patient_id, snapshot, recorded_by)
SELECT 'baseline-' || id, id, jsonb_build_object(
 'corporatePanelId', corporate_panel_id, 'panelMemberId', panel_member_id,
 'membershipStatus', membership_status, 'membershipValidFrom', NULL, 'membershipValidTo', NULL,
 'policyNumber', NULL, 'planName', NULL, 'principalMemberName', NULL, 'memberRelationship', NULL
), updated_by FROM "panel_patients";
