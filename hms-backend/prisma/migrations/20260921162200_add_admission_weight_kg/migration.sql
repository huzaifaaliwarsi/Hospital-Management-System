-- Add optional weight_kg column to admission_records table
ALTER TABLE "admission_records" ADD COLUMN "weight_kg" DECIMAL(5,2);
