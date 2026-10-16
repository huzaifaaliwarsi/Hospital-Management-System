-- AlterTable
ALTER TABLE "corporate_panels" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "panel_patients" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "portal_users" ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "password_reset_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_by" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "rooms" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wards" ALTER COLUMN "updated_at" DROP DEFAULT;

