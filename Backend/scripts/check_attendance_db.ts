import { prisma } from '../src/db/client';

async function main() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));

  const recs = await prisma.attendanceRecord.findMany({
    where: {
      attendanceDate: { gte: start, lte: end },
      status: { in: ['PRESENT', 'HALF_DAY'] },
      staff: { isActive: true, category: { in: ['Doctor', 'RMO'] } },
    },
    include: { staff: true },
  });

  console.log('Attended clinical staff today:', recs.map((r) => ({
    staff: r.staff.fullName,
    category: r.staff.category,
    status: r.status,
    date: r.attendanceDate,
  })));
}

main().finally(() => prisma.$disconnect());
