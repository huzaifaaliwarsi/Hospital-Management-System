-- DropForeignKey
ALTER TABLE "medicine_masters" DROP CONSTRAINT "medicine_masters_base_unit_id_fkey";

-- AlterTable
ALTER TABLE "medicine_masters" ALTER COLUMN "base_unit_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "medicine_masters" ADD CONSTRAINT "medicine_masters_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

