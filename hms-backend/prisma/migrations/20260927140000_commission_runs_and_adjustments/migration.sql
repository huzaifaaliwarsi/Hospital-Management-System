CREATE TABLE "commission_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "period_type" TEXT NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "filters" JSONB NOT NULL,
  "status" "CommissionStatus" NOT NULL DEFAULT 'GENERATED',
  "total_amount" DECIMAL(14,2) NOT NULL,
  "generated_by" TEXT NOT NULL,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3)
);
ALTER TABLE "doctor_commission_accruals" ADD COLUMN "commission_run_id" TEXT,
  ADD COLUMN "generated_snapshot" JSONB;
ALTER TABLE "doctor_commission_accruals" ADD CONSTRAINT "doctor_commission_accruals_commission_run_id_fkey"
  FOREIGN KEY ("commission_run_id") REFERENCES "commission_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "salary_adjustments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "salary_slip_id" TEXT NOT NULL REFERENCES "salary_slips"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "commission_adjustments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accrual_id" TEXT NOT NULL REFERENCES "doctor_commission_accruals"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
