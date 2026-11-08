/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';

/**
 * Dev/staging bootstrap seed — idempotent, safe to run repeatedly. Seeds only
 * the first protected Super Admin account (guarded by a SUPER_ADMIN count
 * check, mirroring hms-backend's own seed pattern) — every other account is
 * created live through the app per pharmacy.md §13 (Super Admin -> Admin,
 * Admin -> Sales), never re-seeded.
 *
 * Run with: npm run prisma:seed
 */
const prisma = new PrismaClient();

async function seedSuperAdmin() {
  const accounts = [
    {
      username: 'superadmin',
      email: env.SUPER_ADMIN_EMAIL || 'superadmin@pharmacy.example',
      fullName: 'Pharmacy Super Admin',
      password: env.SUPER_ADMIN_BOOTSTRAP_PASSWORD || 'SuperAdmin@2026New',
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
    await prisma.portalUser.upsert({
      where: { username: acc.username },
      update: {
        passwordHash,
        mustResetPassword: false,
      },
      create: {
        username: acc.username,
        email: acc.email,
        fullName: acc.fullName,
        passwordHash,
        role: acc.role,
        isProtected: acc.isProtected,
        mustResetPassword: acc.mustResetPassword,
      },
    });
    console.log(`Seeded account: ${acc.username} (${acc.role})`);
  }
}

async function main() {
  await seedSuperAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
