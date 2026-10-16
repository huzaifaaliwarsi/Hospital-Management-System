-- AlterEnum
ALTER TYPE "SupplierLedgerEntryType" ADD VALUE 'ADJUSTMENT';

-- DropForeignKey
ALTER TABLE "doctor_commission_accruals" DROP CONSTRAINT "doctor_commission_accruals_commission_run_id_fkey";

-- AlterTable
ALTER TABLE "hospital_floors" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "doctor_commission_accruals" ADD CONSTRAINT "doctor_commission_accruals_commission_run_id_fkey" FOREIGN KEY ("commission_run_id") REFERENCES "commission_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
