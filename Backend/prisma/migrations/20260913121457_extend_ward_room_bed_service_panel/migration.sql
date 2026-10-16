-- CreateEnum
CREATE TYPE "BedOperationalStatus" AS ENUM ('ACTIVE', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE', 'DECOMMISSIONED');

-- AlterTable
ALTER TABLE "beds" ADD COLUMN     "bed_type" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "operational_status" "BedOperationalStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "status_changed_at" TIMESTAMP(3),
ADD COLUMN     "status_changed_by" TEXT,
ADD COLUMN     "updated_by" TEXT;

-- AlterTable
ALTER TABLE "corporate_panels" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT;

-- AlterTable
ALTER TABLE "panel_patients" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "daily_room_rate" DECIMAL(14,2),
ADD COLUMN     "floor" TEXT,
ADD COLUMN     "room_number" TEXT,
ADD COLUMN     "status_changed_at" TIMESTAMP(3),
ADD COLUMN     "status_changed_by" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT;

-- AlterTable
ALTER TABLE "service_rates" ADD COLUMN     "description" TEXT,
ADD COLUMN     "status_changed_at" TIMESTAMP(3),
ADD COLUMN     "status_changed_by" TEXT,
ADD COLUMN     "updated_by" TEXT;

-- AlterTable
ALTER TABLE "wards" ADD COLUMN     "code" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "floor" TEXT,
ADD COLUMN     "gender_policy" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "status_changed_at" TIMESTAMP(3),
ADD COLUMN     "status_changed_by" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_by" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "beds_code_key" ON "beds"("code");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wards_code_key" ON "wards"("code");

-- AddForeignKey
ALTER TABLE "service_rates" ADD CONSTRAINT "service_rates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_panels" ADD CONSTRAINT "corporate_panels_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_patients" ADD CONSTRAINT "panel_patients_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

