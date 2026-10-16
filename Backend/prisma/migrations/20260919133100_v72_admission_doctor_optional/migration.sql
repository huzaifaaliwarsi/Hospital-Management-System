-- DropForeignKey
ALTER TABLE "admission_records" DROP CONSTRAINT "admission_records_doctor_staff_id_fkey";

-- AlterTable
ALTER TABLE "admission_records" ALTER COLUMN "doctor_staff_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "admission_records" ADD CONSTRAINT "admission_records_doctor_staff_id_fkey" FOREIGN KEY ("doctor_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

