-- AlterTable
ALTER TABLE "corporate_panels" ADD COLUMN     "category" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "discount_agreement" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "corporate_panels_code_key" ON "corporate_panels"("code");

