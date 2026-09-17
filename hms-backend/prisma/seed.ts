/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';

/**
 * Dev/staging bootstrap seed (§6.16–§6.17). Idempotent — safe to run
 * repeatedly against the same database. Seeds:
 *   1. Singleton Hospital Profile (unconfigured fields stay null — never
 *      fabricated, D16 p.6/p.27).
 *   2. A minimal set of reference Departments (clinical + administrative).
 *   3. A Ward → Room → Bed hierarchy example.
 *   4. The first protected Super Admin account, and an Admin account.
 *
 * Per §6.17, the Super Admin bootstrap only ever runs against an empty
 * `portal_users` table (guarded by a SUPER_ADMIN count check) — a second
 * Super Admin must be created by an existing one through the API, never
 * by re-running this script. The Admin account follows the same
 * idempotency guard by email.
 *
 * Run with: npm run prisma:seed  (or `npx prisma db seed`)
 */
const prisma = new PrismaClient();

async function seedHospitalProfile() {
  const existing = await prisma.hospitalProfile.findFirst();
  if (existing) {
    console.log('Hospital profile already exists — skipping.');
    return existing;
  }

  const profile = await prisma.hospitalProfile.create({
    data: {
      name: 'CH Sharif and Saeed Hospital',
      currencyCode: 'PKR',
      roundingMode: 'ROUND_HALF_UP',
      timezone: 'Asia/Karachi',
      // contactPhone / contactEmail / address / workingHours / logoUrl left
      // null on purpose — "Not configured" until entered live by the client
      // during onboarding (D16 p.6, p.27), not fabricated here.
    },
  });
  console.log('Created hospital profile:', profile.name);
  return profile;
}

async function seedDepartments() {
  const departmentSeeds = [
    { code: 'OPD', name: 'Outpatient Department (OPD)', departmentType: 'CLINICAL' as const, supportsOpd: true, supportsObservation: true },
    { code: 'ADM', name: 'Administration', departmentType: 'ADMINISTRATIVE' as const },
    { code: 'FDB', name: 'Front Desk / Billing', departmentType: 'ADMINISTRATIVE' as const, supportsOpd: true },
    {
      code: 'GMED',
      name: 'General Medicine',
      departmentType: 'CLINICAL' as const,
      supportsOpd: true,
      supportsAdmission: true,
    },
    { code: 'ER', name: 'Emergency', departmentType: 'CLINICAL' as const, supportsOpd: true },
  ];

  const departments: Record<string, { id: string }> = {};
  for (const seed of departmentSeeds) {
    const department = await prisma.department.upsert({
      where: { code: seed.code },
      update: {},
      create: seed,
    });
    departments[seed.code] = department;
    console.log(`Department ready: ${seed.code} — ${seed.name}`);
  }
  return departments;
}

async function seedWardsRoomsBeds(clinicalDepartmentId: string) {
  const existingWard = await prisma.ward.findFirst({ where: { departmentId: clinicalDepartmentId } });
  if (existingWard) {
    console.log('Reference ward already exists — skipping ward/room/bed seed.');
    return;
  }

  const ward = await prisma.ward.create({
    data: { departmentId: clinicalDepartmentId, name: 'General Ward', wardType: 'GENERAL' },
  });
  const room = await prisma.room.create({
    data: { wardId: ward.id, name: 'Room 101', roomType: 'SHARED' },
  });
  await prisma.bed.createMany({
    data: [
      { roomId: room.id, bedNumber: '101-A', dailyRate: 2000, status: 'AVAILABLE' },
      { roomId: room.id, bedNumber: '101-B', dailyRate: 2000, status: 'AVAILABLE' },
    ],
  });
  console.log('Created reference Ward → Room → Bed hierarchy.');
}

async function seedSuperAdmin() {
  const protectedCount = await prisma.portalUser.count({ where: { role: 'SUPER_ADMIN' } });
  if (protectedCount > 0) {
    console.log('A Super Admin already exists — refusing to re-seed (§6.17).');
    return;
  }

  if (!env.SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_BOOTSTRAP_PASSWORD) {
    console.warn(
      'SUPER_ADMIN_EMAIL / SUPER_ADMIN_BOOTSTRAP_PASSWORD not set — skipping Super Admin bootstrap.',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_BOOTSTRAP_PASSWORD, 12);
  const user = await prisma.portalUser.create({
    data: {
      username: 'superadmin',
      email: env.SUPER_ADMIN_EMAIL,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      isProtected: true,
      mustResetPassword: true,
    },
  });
  console.log(`Bootstrap Super Admin created: ${user.email} (must reset password on first login).`);
}

async function seedAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD) {
    console.warn('ADMIN_EMAIL / ADMIN_BOOTSTRAP_PASSWORD not set — skipping Admin bootstrap.');
    return;
  }

  const existing = await prisma.portalUser.findUnique({ where: { email: env.ADMIN_EMAIL } });
  if (existing) {
    console.log(`Admin already exists for ${env.ADMIN_EMAIL} — skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_BOOTSTRAP_PASSWORD, 12);
  const user = await prisma.portalUser.create({
    data: {
      username: 'admin',
      email: env.ADMIN_EMAIL,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      isProtected: false,
      mustResetPassword: true,
    },
  });
  console.log(`Bootstrap Admin created: ${user.email} (must reset password on first login).`);
}

async function seedStaffAccounts() {
  const staffSeeds = [
    {
      username: 'frontdesk',
      email: 'frontdesk@chss.example',
      password: 'FrontDesk@123',
      role: 'FRONT_DESK_BILLING' as const,
    },
    {
      username: 'admission',
      email: 'admission@chss.example',
      password: 'Admission@123',
      role: 'ADMISSION' as const,
    },
    {
      username: 'inventory',
      email: 'inventory@chss.example',
      password: 'Inventory@123',
      role: 'INVENTORY_MANAGEMENT' as const,
    },
    {
      username: 'pharmacy',
      email: 'pharmacy@chss.example',
      password: 'Pharmacy@123',
      role: 'PHARMACY_SALES_DISPENSING' as const,
    },
  ];

  for (const s of staffSeeds) {
    const existing = await prisma.portalUser.findFirst({
      where: { OR: [{ username: s.username }, { email: s.email }] },
    });
    if (!existing) {
      const passwordHash = await bcrypt.hash(s.password, 12);
      await prisma.portalUser.create({
        data: {
          username: s.username,
          email: s.email,
          passwordHash,
          role: s.role,
          status: 'ACTIVE',
        },
      });
      console.log(`Created portal account: ${s.username} (${s.role})`);
    }
  }
}

async function main() {
  await seedHospitalProfile();
  const departments = await seedDepartments();
  await seedWardsRoomsBeds(departments.GMED.id);
  await seedSuperAdmin();
  await seedAdmin();
  await seedStaffAccounts();
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
