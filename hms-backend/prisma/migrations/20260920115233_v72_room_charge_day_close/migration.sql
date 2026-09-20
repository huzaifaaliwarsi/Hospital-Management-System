-- CreateTable
CREATE TABLE "hospital_day_close" (
    "id" TEXT NOT NULL,
    "business_date" DATE NOT NULL,
    "admissions_charged" INTEGER NOT NULL DEFAULT 0,
    "total_amount_posted" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closed_by" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospital_day_close_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_room_charge_log" (
    "id" TEXT NOT NULL,
    "admission_record_id" TEXT NOT NULL,
    "business_date" DATE NOT NULL,
    "invoice_line_item_id" TEXT NOT NULL,
    "rate_posted" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_room_charge_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hospital_day_close_business_date_key" ON "hospital_day_close"("business_date");

-- CreateIndex
CREATE UNIQUE INDEX "admission_room_charge_log_invoice_line_item_id_key" ON "admission_room_charge_log"("invoice_line_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "admission_room_charge_log_admission_record_id_business_date_key" ON "admission_room_charge_log"("admission_record_id", "business_date");

-- AddForeignKey
ALTER TABLE "hospital_day_close" ADD CONSTRAINT "hospital_day_close_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_room_charge_log" ADD CONSTRAINT "admission_room_charge_log_admission_record_id_fkey" FOREIGN KEY ("admission_record_id") REFERENCES "admission_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_room_charge_log" ADD CONSTRAINT "admission_room_charge_log_invoice_line_item_id_fkey" FOREIGN KEY ("invoice_line_item_id") REFERENCES "invoice_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

