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
  const existingCount = await prisma.portalUser.count({ where: { role: 'SUPER_ADMIN' } });
  if (existingCount > 0) {
    console.log('A Super Admin already exists — skipping.');
    return;
  }
  if (!env.SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_BOOTSTRAP_PASSWORD) {
    console.log('SUPER_ADMIN_EMAIL / SUPER_ADMIN_BOOTSTRAP_PASSWORD not set — skipping Super Admin bootstrap.');
    return;
  }
  const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_BOOTSTRAP_PASSWORD, 12);
  const user = await prisma.portalUser.create({
    data: {
      username: 'superadmin',
      email: env.SUPER_ADMIN_EMAIL,
      fullName: 'Pharmacy Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      isProtected: true,
      mustResetPassword: true,
    },
  });
  console.log(`Seeded protected Super Admin: ${user.username} (${user.email})`);
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
