-- CreateTable
CREATE TABLE "pharmacy_settings" (
    "id" TEXT NOT NULL,
    "high_value_approval_enabled" BOOLEAN NOT NULL DEFAULT false,
    "high_value_threshold" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "pharmacy_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "medicine_requests" ADD CONSTRAINT "medicine_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
