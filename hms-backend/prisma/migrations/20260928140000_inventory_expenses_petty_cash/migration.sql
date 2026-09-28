-- AlterTable
ALTER TABLE "user_cash_balances" ADD COLUMN     "issued_by" TEXT,
ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "inventory_expenses" (
    "id" TEXT NOT NULL,
    "expense_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "payee" TEXT,
    "description" TEXT,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "inventory_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_expenses_expense_date_idx" ON "inventory_expenses"("expense_date");

-- AddForeignKey
ALTER TABLE "user_cash_balances" ADD CONSTRAINT "user_cash_balances_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_expenses" ADD CONSTRAINT "inventory_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
