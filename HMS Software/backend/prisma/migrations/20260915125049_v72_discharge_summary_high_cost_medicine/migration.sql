-- AlterEnum
ALTER TYPE "PharmacyClearanceStatus" ADD VALUE 'AUTHORIZATION_REQUIRED';

-- CreateTable
CREATE TABLE "discharge_summaries" (
    "id" TEXT NOT NULL,
    "admission_record_id" TEXT NOT NULL,
    "final_diagnosis" TEXT NOT NULL,
    "treatment_summary" TEXT NOT NULL,
    "condition_at_discharge" TEXT NOT NULL,
    "medicines_instructions" TEXT NOT NULL,
    "follow_up_advice" TEXT,
    "follow_up_doctor_staff_id" TEXT,
    "follow_up_date" DATE,
    "additional_notes" TEXT,
    "doctor_staff_id" TEXT NOT NULL,
    "doctor_name_snapshot" TEXT NOT NULL,
    "doctor_department_snapshot" TEXT,
    "authorized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initiated_by" TEXT NOT NULL,

    CONSTRAINT "discharge_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "high_cost_medicine_authorizations" (
    "id" TEXT NOT NULL,
    "pharmacy_clearance_id" TEXT NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    "threshold_amount" DECIMAL(14,2) NOT NULL,
    "attendant_name" TEXT,
    "attendant_relation" TEXT,
    "attendant_contact" TEXT,
    "attendant_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "attendant_confirmed_by" TEXT,
    "attendant_confirmed_at" TIMESTAMP(3),
    "management_approved_by" TEXT,
    "management_reason" TEXT,
    "management_approved_at" TIMESTAMP(3),
    "panel_authorization_ref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "high_cost_medicine_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discharge_summaries_admission_record_id_key" ON "discharge_summaries"("admission_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "high_cost_medicine_authorizations_pharmacy_clearance_id_key" ON "high_cost_medicine_authorizations"("pharmacy_clearance_id");

-- AddForeignKey
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_admission_record_id_fkey" FOREIGN KEY ("admission_record_id") REFERENCES "admission_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_follow_up_doctor_staff_id_fkey" FOREIGN KEY ("follow_up_doctor_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_doctor_staff_id_fkey" FOREIGN KEY ("doctor_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_summaries" ADD CONSTRAINT "discharge_summaries_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "high_cost_medicine_authorizations" ADD CONSTRAINT "high_cost_medicine_authorizations_pharmacy_clearance_id_fkey" FOREIGN KEY ("pharmacy_clearance_id") REFERENCES "pharmacy_clearances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "high_cost_medicine_authorizations" ADD CONSTRAINT "high_cost_medicine_authorizations_attendant_confirmed_by_fkey" FOREIGN KEY ("attendant_confirmed_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "high_cost_medicine_authorizations" ADD CONSTRAINT "high_cost_medicine_authorizations_management_approved_by_fkey" FOREIGN KEY ("management_approved_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

