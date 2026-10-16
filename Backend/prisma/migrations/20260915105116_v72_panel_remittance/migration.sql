-- CreateTable
CREATE TABLE "panel_remittances" (
    "id" TEXT NOT NULL,
    "remittance_number" TEXT NOT NULL,
    "corporate_panel_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "remarks" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panel_remittances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_remittance_allocations" (
    "id" TEXT NOT NULL,
    "panel_remittance_id" TEXT NOT NULL,
    "hospital_invoice_id" TEXT NOT NULL,
    "allocated_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panel_remittance_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "panel_remittances_remittance_number_key" ON "panel_remittances"("remittance_number");

-- CreateIndex
CREATE INDEX "panel_remittances_corporate_panel_id_idx" ON "panel_remittances"("corporate_panel_id");

-- CreateIndex
CREATE INDEX "panel_remittance_allocations_panel_remittance_id_idx" ON "panel_remittance_allocations"("panel_remittance_id");

-- CreateIndex
CREATE INDEX "panel_remittance_allocations_hospital_invoice_id_idx" ON "panel_remittance_allocations"("hospital_invoice_id");

-- AddForeignKey
ALTER TABLE "panel_remittances" ADD CONSTRAINT "panel_remittances_corporate_panel_id_fkey" FOREIGN KEY ("corporate_panel_id") REFERENCES "corporate_panels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_remittances" ADD CONSTRAINT "panel_remittances_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_remittance_allocations" ADD CONSTRAINT "panel_remittance_allocations_panel_remittance_id_fkey" FOREIGN KEY ("panel_remittance_id") REFERENCES "panel_remittances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_remittance_allocations" ADD CONSTRAINT "panel_remittance_allocations_hospital_invoice_id_fkey" FOREIGN KEY ("hospital_invoice_id") REFERENCES "hospital_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

