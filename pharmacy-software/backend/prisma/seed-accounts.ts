import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo & standard accounts matching frontend LoginPage...');

  const accounts = [
    {
      username: 'superadmin',
      email: 'superadmin@pharmacy.example',
      fullName: 'Pharmacy Super Admin',
      password: 'SuperAdmin@2026New',
      role: 'SUPER_ADMIN' as const,
      isProtected: true,
      mustResetPassword: false,
    },
    {
      username: 'admin1',
      email: 'admin1@pharmacy.example',
      fullName: 'Pharmacy Admin',
      password: 'Admin@2026New',
      role: 'ADMIN' as const,
      isProtected: false,
      mustResetPassword: false,
    },
    {
      username: 'sales1',
      email: 'sales1@pharmacy.example',
      fullName: 'Pharmacy Sales Staff',
      password: 'Sales@12345',
      role: 'SALES_DISPENSING' as const,
      isProtected: false,
      mustResetPassword: false,
    },
  ];

  for (const acc of accounts) {
    const passwordHash = await bcrypt.hash(acc.password, 12);
    const user = await prisma.portalUser.upsert({
      where: { username: acc.username },
      update: {
        email: acc.email,
        fullName: acc.fullName,
        passwordHash,
        role: acc.role,
        isProtected: acc.isProtected,
        mustResetPassword: acc.mustResetPassword,
        status: 'ACTIVE',
      },
      create: {
        username: acc.username,
        email: acc.email,
        fullName: acc.fullName,
        passwordHash,
        role: acc.role,
        isProtected: acc.isProtected,
        mustResetPassword: acc.mustResetPassword,
        status: 'ACTIVE',
      },
    });
    console.log(`✓ Account ready: ${user.username} (${acc.role}) - Password: ${acc.password}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
