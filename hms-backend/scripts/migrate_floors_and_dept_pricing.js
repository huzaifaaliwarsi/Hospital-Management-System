const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Migrating hospital floors and department fixed pricing...');

  // 1. Create hospital_floors table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "hospital_floors" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "floor_number" INTEGER NOT NULL,
      "name" TEXT NOT NULL UNIQUE,
      "building" TEXT DEFAULT 'Main Building',
      "description" TEXT,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Table hospital_floors verified.');

  // 2. Add floor and fixed_price columns to departments table
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "floor" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "fixed_price" DECIMAL(14, 2);
  `);
  console.log('Columns floor and fixed_price verified on departments table.');

  // 3. Seed default floors if none exist
  const existingFloors = await prisma.hospitalFloor.findMany();
  if (existingFloors.length === 0) {
    const defaultFloors = [
      { floorNumber: 0, name: 'Ground Floor', building: 'Main Building', description: 'Emergency, OPD Reception, Pharmacy, Diagnostics' },
      { floorNumber: 1, name: '1st Floor', building: 'Main Building', description: 'Consultant Clinics, Admin Offices, Minor OT' },
      { floorNumber: 2, name: '2nd Floor', building: 'Main Building', description: 'General Wards, Semi-Private Rooms' },
      { floorNumber: 3, name: '3rd Floor', building: 'Main Building', description: 'Main OT Complex, ICU, Private Rooms' },
    ];

    for (const f of defaultFloors) {
      await prisma.hospitalFloor.create({
        data: f,
      });
    }
    console.log(`Seeded ${defaultFloors.length} default hospital floors.`);
  } else {
    console.log(`Found ${existingFloors.length} existing hospital floor(s).`);
  }

  console.log('Migration complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
