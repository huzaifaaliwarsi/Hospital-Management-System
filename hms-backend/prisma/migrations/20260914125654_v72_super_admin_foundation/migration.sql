-- CreateEnum
CREATE TYPE "DepartmentFulfillmentOwnership" AS ENUM ('INTERNAL', 'OUTSOURCED');

-- CreateEnum
CREATE TYPE "ProviderSettlementStatus" AS ENUM ('FULL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "HighCostAuthLogic" AS ENUM ('ATTENDANT_ONLY', 'MANAGEMENT_ONLY', 'EITHER', 'BOTH');

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "fulfillment_ownership" "DepartmentFulfillmentOwnership" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "outsourced_provider_id" TEXT;

-- AlterTable
ALTER TABLE "doctor_commission_rules" ADD COLUMN     "commission_tax_method" TEXT,
ADD COLUMN     "commission_tax_value" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "panel_discount_rules" ADD COLUMN     "cap_amount" DECIMAL(14,2),
ADD COLUMN     "coverage_percent" DECIMAL(5,2),
ADD COLUMN     "preauthorization_required" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "clinical_auth_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clinical_auth_password_hash" TEXT,
ADD COLUMN     "clinical_auth_updated_at" TIMESTAMP(3),
ADD COLUMN     "clinical_auth_updated_by" TEXT,
ADD COLUMN     "clinical_auth_username" TEXT;

-- AlterTable
ALTER TABLE "staff_salary_profiles" ADD COLUMN     "salary_tax_effective_from" DATE,
ADD COLUMN     "salary_tax_method" TEXT,
ADD COLUMN     "salary_tax_value" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "outsourced_providers" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "representative_name" TEXT,
    "representative_designation" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "payment_terms_notes" TEXT,
    "settlement_cycle" TEXT,
    "allowed_payment_methods" TEXT[],
    "bank_name" TEXT,
    "bank_account_title" TEXT,
    "bank_account_number" TEXT,
    "cheque_payee_name" TEXT,
    "withholding_tax_percent" DECIMAL(5,2),
    "withholding_effective_from" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "outsourced_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_settlements" (
    "id" TEXT NOT NULL,
    "outsourced_provider_id" TEXT NOT NULL,
    "department_id" TEXT,
    "period_label" TEXT,
    "eligible_realized_amount" DECIMAL(14,2) NOT NULL,
    "already_settled_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "settlement_amount" DECIMAL(14,2) NOT NULL,
    "status" "ProviderSettlementStatus" NOT NULL,
    "payment_method" TEXT NOT NULL,
    "payment_reference" TEXT,
    "representative_name" TEXT,
    "representative_designation" TEXT,
    "remarks" TEXT,
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "high_cost_medicine_policy" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "threshold_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "threshold_basis" TEXT NOT NULL DEFAULT 'LINE_TOTAL',
    "attendant_confirmation_required" BOOLEAN NOT NULL DEFAULT true,
    "management_approval_required" BOOLEAN NOT NULL DEFAULT true,
    "combined_logic" "HighCostAuthLogic" NOT NULL DEFAULT 'BOTH',
    "panel_preauth_required" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "high_cost_medicine_policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outsourced_providers_code_key" ON "outsourced_providers"("code");

-- CreateIndex
CREATE INDEX "provider_settlements_outsourced_provider_id_idx" ON "provider_settlements"("outsourced_provider_id");

-- CreateIndex
CREATE INDEX "provider_settlements_department_id_idx" ON "provider_settlements"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_clinical_auth_username_key" ON "staff"("clinical_auth_username");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_clinical_auth_updated_by_fkey" FOREIGN KEY ("clinical_auth_updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_outsourced_provider_id_fkey" FOREIGN KEY ("outsourced_provider_id") REFERENCES "outsourced_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outsourced_providers" ADD CONSTRAINT "outsourced_providers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outsourced_providers" ADD CONSTRAINT "outsourced_providers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_settlements" ADD CONSTRAINT "provider_settlements_outsourced_provider_id_fkey" FOREIGN KEY ("outsourced_provider_id") REFERENCES "outsourced_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_settlements" ADD CONSTRAINT "provider_settlements_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_settlements" ADD CONSTRAINT "provider_settlements_settled_by_fkey" FOREIGN KEY ("settled_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "high_cost_medicine_policy" ADD CONSTRAINT "high_cost_medicine_policy_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

