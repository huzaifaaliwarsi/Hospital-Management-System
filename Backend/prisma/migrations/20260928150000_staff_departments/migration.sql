-- CreateTable
CREATE TABLE IF NOT EXISTS "staff_departments" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,

    CONSTRAINT "staff_departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "staff_departments_staff_id_department_id_key" ON "staff_departments"("staff_id", "department_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "staff_departments_staff_id_idx" ON "staff_departments"("staff_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "staff_departments_department_id_idx" ON "staff_departments"("department_id");

-- AddForeignKey
ALTER TABLE "staff_departments" DROP CONSTRAINT IF EXISTS "staff_departments_staff_id_fkey";
ALTER TABLE "staff_departments" ADD CONSTRAINT "staff_departments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_departments" DROP CONSTRAINT IF EXISTS "staff_departments_department_id_fkey";
ALTER TABLE "staff_departments" ADD CONSTRAINT "staff_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
