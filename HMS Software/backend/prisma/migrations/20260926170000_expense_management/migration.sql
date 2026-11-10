-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('UTILITIES', 'RENT', 'MAINTENANCE_REPAIRS', 'MEDICAL_SUPPLIES', 'OFFICE_SUPPLIES', 'EQUIPMENT', 'CLEANING_SANITATION', 'FOOD_REFRESHMENTS', 'TRANSPORT', 'MARKETING', 'PROFESSIONAL_FEES', 'MISCELLANEOUS');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('ACTIVE', 'VOID');

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "expense_number" TEXT NOT NULL,
    "expense_date" DATE NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "paid_to" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "department_id" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "void_reason" TEXT,
    "voided_at" TIMESTAMP(3),
    "voided_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expenses_expense_number_key" ON "expenses"("expense_number");

-- CreateIndex
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

