const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Creating staff_departments table in PostgreSQL...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "staff_departments" (
      "id" TEXT NOT NULL,
      "staff_id" TEXT NOT NULL,
      "department_id" TEXT NOT NULL,
      "is_primary" BOOLEAN NOT NULL DEFAULT false,
      "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "assigned_by" TEXT,

      CONSTRAINT "staff_departments_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "staff_departments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "staff_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "staff_departments_staff_id_department_id_key" ON "staff_departments"("staff_id", "department_id");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "staff_departments_staff_id_idx" ON "staff_departments"("staff_id");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "staff_departments_department_id_idx" ON "staff_departments"("department_id");
  `);

  console.log('staff_departments table, constraints, and indexes created successfully.');

  // Backfill existing staff primary departments
  const staff = await prisma.staff.findMany({
    select: { id: true, departmentId: true, fullName: true },
  });

  let created = 0;
  let skipped = 0;

  for (const s of staff) {
    if (!s.departmentId) continue;
    const existing = await prisma.staffDepartment.findUnique({
      where: { staffId_departmentId: { staffId: s.id, departmentId: s.departmentId } },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.staffDepartment.create({
      data: {
        staffId: s.id,
        departmentId: s.departmentId,
        isPrimary: true,
        assignedBy: 'system-migration',
      },
    });
    created++;
  }

  console.log(`Backfill complete: ${created} created, ${skipped} already existed.`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
