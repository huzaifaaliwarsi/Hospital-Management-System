import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const meds = await prisma.medicineMaster.findMany({
    include: {
      baseUnit: true,
      packagingLevels: { include: { unit: true } },
    },
  });
  console.log('ALL MEDS COUNT:', meds.length);
  for (const m of meds) {
    console.log({
      id: m.id,
      code: m.code,
      name: m.name,
      baseUnitId: m.baseUnitId,
      baseUnit: m.baseUnit,
      packagingLevels: m.packagingLevels,
    });
  }
}

run();
