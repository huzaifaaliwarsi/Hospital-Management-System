import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- 1. Verify Floors in Database ---');
  const floors = await prisma.hospitalFloor.findMany({
    orderBy: { floorNumber: 'asc' },
  });
  console.log(`Found ${floors.length} floors in database:`);
  floors.forEach((f) => {
    console.log(`  - [ID: ${f.id}] #${f.floorNumber}: "${f.name}" (Building: ${f.building || 'Main'}, Active: ${f.isActive})`);
  });

  if (floors.length === 0) {
    throw new Error('No floors found in database! Expected seeded floors.');
  }

  console.log('\n--- 2. Test Floor CRUD Operations ---');
  const testFloor = await prisma.hospitalFloor.create({
    data: {
      floorNumber: 99,
      name: 'Test Floor 99',
      building: 'Diagnostic Tower',
      description: 'Temporary floor for verification',
      isActive: true,
    },
  });
  console.log('Created test floor:', testFloor.name, '(id:', testFloor.id, ')');

  const updatedFloor = await prisma.hospitalFloor.update({
    where: { id: testFloor.id },
    data: { name: 'Test Floor 99 Renamed' },
  });
  console.log('Updated test floor name:', updatedFloor.name);

  await prisma.hospitalFloor.delete({
    where: { id: testFloor.id },
  });
  console.log('Successfully deleted test floor 99.');

  console.log('\n--- 3. Verify Department Fixed Price and Floor Assignment ---');
  const sampleDept = await prisma.department.findFirst({
    where: { isActive: true },
  });

  if (!sampleDept) {
    console.log('No active department found to test.');
    return;
  }

  console.log(`Testing with department: "${sampleDept.name}" (${sampleDept.code})`);
  const updatedDept = await prisma.department.update({
    where: { id: sampleDept.id },
    data: {
      floor: '1st Floor',
      location: '1st Floor',
      fixedPrice: 1750.00,
    },
  });

  console.log('Successfully updated department:');
  console.log(`  - Name: ${updatedDept.name}`);
  console.log(`  - Floor: ${updatedDept.floor}`);
  console.log(`  - Location: ${updatedDept.location}`);
  console.log(`  - Fixed Price: ${updatedDept.fixedPrice?.toString()} PKR`);

  const fetchedDept = await prisma.department.findUnique({
    where: { id: sampleDept.id },
  });

  if (fetchedDept?.floor !== '1st Floor') {
    throw new Error(`Expected floor to be "1st Floor", got "${fetchedDept?.floor}"`);
  }
  if (Number(fetchedDept?.fixedPrice) !== 1750) {
    throw new Error(`Expected fixedPrice to be 1750, got "${fetchedDept?.fixedPrice}"`);
  }

  console.log('\n✅ ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

main()
  .catch((e) => {
    console.error('Test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
