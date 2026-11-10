-- AlterTable
ALTER TABLE "hospital_profile" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "extended_profile" JSONB;

