-- Eligibility is explicitly configured on Staff, independently of departments.
-- Preserve all existing staff, assignments, and appointment records.
ALTER TABLE "staff"
  ADD COLUMN "available_for_opd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "available_for_observation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "available_for_emergency" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "appointments" ALTER COLUMN "doctor_staff_id" DROP NOT NULL;
