-- AlterTable
ALTER TABLE "panel_patients" ADD COLUMN     "address_line1" TEXT,
ADD COLUMN     "address_line2" TEXT,
ADD COLUMN     "alternate_phone" TEXT,
ADD COLUMN     "blood_group" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emergency_contact_name" TEXT,
ADD COLUMN     "emergency_contact_phone" TEXT,
ADD COLUMN     "emergency_contact_relation" TEXT,
ADD COLUMN     "guardian_relation" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

