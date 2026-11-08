-- AlterTable
ALTER TABLE "medicine_batches" ADD COLUMN     "packaging_snapshot_json" JSONB,
ADD COLUMN     "purchase_unit_conversion_to_base" DECIMAL(14,4),
ADD COLUMN     "purchase_unit_id" TEXT;

-- AlterTable
ALTER TABLE "medicine_masters" ADD COLUMN     "base_unit_id" TEXT;

-- AlterTable
ALTER TABLE "medicine_request_lines" ADD COLUMN     "sale_unit_id" TEXT,
ADD COLUMN     "sale_unit_quantity" DECIMAL(14,3);

-- AlterTable
ALTER TABLE "pharmacy_invoice_lines" ADD COLUMN     "sale_unit_id" TEXT,
ADD COLUMN     "sale_unit_quantity" DECIMAL(14,3);

-- AlterTable
ALTER TABLE "purchase_lines" ADD COLUMN     "conversion_to_base_snapshot" DECIMAL(14,4),
ADD COLUMN     "purchase_unit_id" TEXT,
ADD COLUMN     "purchase_unit_quantity" DECIMAL(14,3);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_code" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_packaging_levels" (
    "id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "conversion_to_base" DECIMAL(14,4) NOT NULL,
    "is_purchase_unit" BOOLEAN NOT NULL DEFAULT false,
    "is_sale_unit" BOOLEAN NOT NULL DEFAULT false,
    "override_sale_rate" DECIMAL(14,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "medicine_packaging_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_name_key" ON "units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "medicine_packaging_levels_medicine_id_level_key" ON "medicine_packaging_levels"("medicine_id", "level");

-- AddForeignKey
ALTER TABLE "medicine_masters" ADD CONSTRAINT "medicine_masters_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_packaging_levels" ADD CONSTRAINT "medicine_packaging_levels_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_packaging_levels" ADD CONSTRAINT "medicine_packaging_levels_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_purchase_unit_id_fkey" FOREIGN KEY ("purchase_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_purchase_unit_id_fkey" FOREIGN KEY ("purchase_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_request_lines" ADD CONSTRAINT "medicine_request_lines_sale_unit_id_fkey" FOREIGN KEY ("sale_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_invoice_lines" ADD CONSTRAINT "pharmacy_invoice_lines_sale_unit_id_fkey" FOREIGN KEY ("sale_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

