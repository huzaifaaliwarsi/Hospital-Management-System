-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DepartmentType" ADD VALUE 'SURGICAL';
ALTER TYPE "DepartmentType" ADD VALUE 'DIAGNOSTIC';
ALTER TYPE "DepartmentType" ADD VALUE 'EMERGENCY';
ALTER TYPE "DepartmentType" ADD VALUE 'PHARMACY';
ALTER TYPE "DepartmentType" ADD VALUE 'SUPPORT_SERVICE';
ALTER TYPE "DepartmentType" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "contact_extension" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "pharmacy_related" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status_changed_at" TIMESTAMP(3),
ADD COLUMN     "status_changed_by" TEXT,
ADD COLUMN     "supports_emergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supports_observation" BOOLEAN NOT NULL DEFAULT false;

