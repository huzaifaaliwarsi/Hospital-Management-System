-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'EVENING', 'NIGHT', 'CUSTOM');

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "shift_type" "ShiftType" NOT NULL DEFAULT 'CUSTOM',
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "default_arrival_grace_minutes" INTEGER NOT NULL DEFAULT 0,
    "default_early_exit_tolerance_minutes" INTEGER NOT NULL DEFAULT 0,
    "default_weekly_off_days" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shifts_code_key" ON "shifts"("code");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

