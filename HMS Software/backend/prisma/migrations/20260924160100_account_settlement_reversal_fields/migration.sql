-- AlterTable
ALTER TABLE "account_settlements" ADD COLUMN     "reversal_reason" TEXT,
ADD COLUMN     "reversed_by" TEXT,
ADD COLUMN     "reversed_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "account_settlements" ADD CONSTRAINT "account_settlements_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
