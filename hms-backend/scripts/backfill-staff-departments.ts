/**
 * One-time backfill: creates a StaffDepartment junction row (isPrimary=true)
 * for every Staff row that doesn't have one yet.
 * Safe to re-run — uses upsert on the unique (staffId, departmentId) key.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.staff.findMany({
    select: { id: true, departmentId: true, fullName: true },
  });

  let created = 0;
  let skipped = 0;

  for (const s of staff) {
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
        assignedBy: 'system-backfill',
      },
    });
    created++;
    console.log(`✓ ${s.fullName} → dept backfilled`);
  }

  console.log(`\nBackfill complete: ${created} created, ${skipped} already existed.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
