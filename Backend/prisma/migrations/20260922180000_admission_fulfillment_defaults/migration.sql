ALTER TABLE "admission_records"
ADD COLUMN "outsourced_fulfillment_mode" "MedicationMode" NOT NULL DEFAULT 'HOSPITAL_MANAGED';

-- Change the default for future admissions; preserve every existing pharmacy choice.
ALTER TABLE "admission_records" ALTER COLUMN "medication_mode" SET DEFAULT 'HOSPITAL_MANAGED';
