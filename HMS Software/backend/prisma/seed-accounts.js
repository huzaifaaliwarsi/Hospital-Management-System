const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ACCOUNTS = [
  {
    username: 'superadmin',
    email: 'superadmin@isywarecloud.com',
    displayName: 'Super Admin',
    password: 'SuperAdmin@123',
    role: 'SUPER_ADMIN',
    isProtected: true,
  },
  {
    username: 'admin',
    email: 'admin@isywarecloud.com',
    displayName: 'Hospital Administrator',
    password: 'Admin@123',
    role: 'ADMIN',
    isProtected: false,
  },
  {
    username: 'frontdesk',
    email: 'frontdesk@isywarecloud.com',
    displayName: 'Front Desk Operator',
    password: 'FrontDesk@123',
    role: 'FRONT_DESK_BILLING',
    isProtected: false,
    isCashHandling: true,
  },
  {
    username: 'admission',
    email: 'admission@isywarecloud.com',
    displayName: 'Admission Officer',
    password: 'Admission@123',
    role: 'ADMISSION',
    isProtected: false,
  },
  {
    username: 'inventory',
    email: 'inventory@isywarecloud.com',
    displayName: 'Inventory Manager',
    password: 'Inventory@123',
    role: 'INVENTORY_MANAGEMENT',
    isProtected: false,
  },
];

async function seed() {
  console.log('Seeding HMS Portal Accounts...');

  // 1. Singleton Hospital Profile if missing
  const existingProfile = await prisma.hospitalProfile.findFirst();
  if (!existingProfile) {
    await prisma.hospitalProfile.create({
      data: {
        name: 'CH Sharif and Saeed Hospital',
        currencyCode: 'PKR',
        roundingMode: 'ROUND_HALF_UP',
        timezone: 'Asia/Karachi',
      },
    });
    console.log('✅ Created Hospital Profile');
  }

  // 2. Upsert all 5 portal accounts
  for (const acc of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(acc.password, 12);
    const user = await prisma.portalUser.upsert({
      where: { username: acc.username },
      update: {
        email: acc.email,
        displayName: acc.displayName,
        passwordHash,
        role: acc.role,
        status: 'ACTIVE',
        mustResetPassword: false,
      },
      create: {
        username: acc.username,
        email: acc.email,
        displayName: acc.displayName,
        passwordHash,
        role: acc.role,
        status: 'ACTIVE',
        isProtected: acc.isProtected,
        isCashHandling: !!acc.isCashHandling,
        mustResetPassword: false,
      },
    });
    console.log(`✅ Ready: ${user.username} [${user.role}] -> Password: ${acc.password}`);
  }

  console.log('\nAll 5 accounts seeded successfully with mustResetPassword = false!');
}

seed()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

