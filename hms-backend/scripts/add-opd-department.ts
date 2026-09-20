import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for existing OPD department in database...');
  const existing = await prisma.department.findFirst({
    where: {
      OR: [
        { code: 'OPD' },
        { name: { equals: 'OPD', mode: 'insensitive' } },
        { name: { equals: 'Outpatient Department', mode: 'insensitive' } },
        { name: { contains: 'OPD', mode: 'insensitive' } },
      ],
    },
  });

  if (existing) {
    console.log('Found existing department matching OPD:', existing);
    const updated = await prisma.department.update({
      where: { id: existing.id },
      data: {
        code: 'OPD',
        name: existing.name.includes('OPD') ? existing.name : 'Outpatient Department (OPD)',
        departmentType: 'CLINICAL',
        supportsOpd: true,
        isActive: true,
      },
    });
    console.log('Successfully updated OPD department in database:', updated);
    return updated;
  }

  const created = await prisma.department.create({
    data: {
      code: 'OPD',
      name: 'Outpatient Department (OPD)',
      description: 'Primary ambulatory and outpatient consultation department',
      departmentType: 'CLINICAL',
      supportsOpd: true,
      supportsObservation: true,
      supportsEmergency: false,
      supportsAdmission: false,
      isActive: true,
      fulfillmentOwnership: 'INTERNAL',
    },
  });

  console.log('Successfully created new OPD department in database:', created);
  return created;
}

main()
  .catch((err) => {
    console.error('Error in add-opd-department:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
