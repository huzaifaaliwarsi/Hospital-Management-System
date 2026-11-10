-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "status_changed_at" TIMESTAMP(3),
ADD COLUMN     "status_changed_by" TEXT;

