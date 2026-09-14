import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { staffRepository } from './staff.repository';
import { NotFoundError, ConflictError } from '@/shared/errors/AppError';
import { buildPaginationMeta } from '@/shared/pagination';
import { resolveActorLabel } from '@/shared/actorLabel';
import type {
  CreateStaffBody,
  UpdateStaffBody,
  ListStaffQuery,
  SetClinicalAuthBody,
  ResetClinicalAuthPasswordBody,
  CreateSalaryProfileBody,
} from './staff.schemas';

const BCRYPT_ROUNDS = 12;

// `clinicalAuthPasswordHash` (v7.2 §2.4) never needs stripping here — it's
// globally omitted at the Prisma client level (`src/db/client.ts`), so it's
// structurally absent from every query result everywhere, not just this file.

/**
 * System-generated Employee ID (§16 Q-01 — exact format not specified by
 * the client; `EMP-<year>-<sequence>` is this phase's placeholder).
 * Generation + insert is retried on a unique-constraint race rather than
/**
 * System-generated purely numeric Employee ID (e.g. 1001, 1002, 1003...).
 * Automatically scans existing staff to find the highest numeric code and increments it sequentially.
 */
async function generateNumericEmployeeId(attempt: number = 0): Promise<string> {
  const { rows } = await staffRepository.findMany({ pageSize: 1000, page: 1 });
  let maxNum = 1000;
  for (const s of rows) {
    const num = parseInt(s.employeeId, 10);
    if (!Number.isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }
  return String(maxNum + 1 + attempt);
}

const MAX_EMPLOYEE_ID_RETRIES = 3;

export const staffService = {
  async list(query: ListStaffQuery) {
    const { rows, totalItems } = await staffRepository.findMany(query);
    return { rows, meta: buildPaginationMeta(query, totalItems) };
  },

  async getById(id: string) {
    const staff = await staffRepository.findById(id);
    if (!staff) throw new NotFoundError('Staff record not found');
    return staff;
  },

  async create(body: CreateStaffBody, createdById: string) {
    const actorLabel = await resolveActorLabel(createdById);
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_EMPLOYEE_ID_RETRIES; attempt += 1) {
      const employeeId = await generateNumericEmployeeId(attempt);
      try {
        const data: Prisma.StaffCreateInput = {
          employeeId,
          fullName: body.fullName,
          fatherGuardianName: body.fatherGuardianName,
          cnic: body.cnic,
          category: body.category,
          department: { connect: { id: body.departmentId } },
          designation: body.designation,
          phone: body.phone,
          alternatePhone: body.alternatePhone,
          email: body.email,
          joiningDate: body.joiningDate,
          notes: body.notes,
          doctorSponsoredDiscountTrackingEnabled: body.doctorSponsoredDiscountTrackingEnabled ?? false,
          createdBy: actorLabel,
          updatedBy: actorLabel,
        };
        return await staffRepository.create(data);
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          lastError = error;
          continue; // employeeId collision — retry with the next sequence value
        }
        throw error;
      }
    }
    throw lastError;
  },

  async update(id: string, body: UpdateStaffBody, updatedById: string) {
    await this.getById(id);
    const actorLabel = await resolveActorLabel(updatedById);
    const data: Prisma.StaffUpdateInput = { ...body, updatedBy: actorLabel };
    if (body.departmentId) {
      data.department = { connect: { id: body.departmentId } };
      delete (data as Record<string, unknown>).departmentId;
    }
    return staffRepository.update(id, data);
  },

  async deactivate(id: string, updatedById: string) {
    const existing = await staffRepository.findFullProfile(id);
    if (!existing) throw new NotFoundError('Staff record not found');
    const actorLabel = await resolveActorLabel(updatedById);
    return prisma.$transaction(async (tx) => {
      if (existing.portalUser) {
        await tx.portalUser.update({
          where: { id: existing.portalUser.id },
          data: { status: 'SUSPENDED', updatedBy: actorLabel },
        });
        await tx.refreshToken.updateMany({
          where: { portalUserId: existing.portalUser.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return tx.staff.update({
        where: { id },
        data: { isActive: false, employmentStatus: 'INACTIVE', updatedBy: actorLabel },
      });
    });
  },

  async delete(id: string) {
    const staff = await staffRepository.findById(id);
    if (!staff) throw new NotFoundError('Staff record not found');

    try {
      await staffRepository.delete(id);
    } catch (error: any) {
      const msg = String(error?.message || '');
      const code = String(error?.code || '');
      const isFkError =
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') ||
        code === 'P2003' ||
        code === '23001' ||
        code === '23503' ||
        msg.includes('foreign key constraint') ||
        msg.includes('violates RESTRICT');

      if (isFkError) {
        throw new ConflictError(
          'This staff member has recorded hospital activity (appointments, patient admissions, billing, or salary history) and cannot be deleted. Deactivate them instead.',
        );
      }
      throw error;
    }
  },

  async getFullProfile(id: string) {
    const profile = await staffRepository.findFullProfile(id);
    if (!profile) throw new NotFoundError('Staff record not found');

    const currentSalaryProfile =
      profile.salaryProfiles.find((p) => p.effectiveTo === null) ?? profile.salaryProfiles[0] ?? null;

    return {
      overview: {
        id: profile.id,
        employeeId: profile.employeeId,
        fullName: profile.fullName,
        category: profile.category,
        designation: profile.designation,
        department: profile.department,
        phone: profile.phone,
        email: profile.email,
        joiningDate: profile.joiningDate,
        employmentStatus: profile.employmentStatus,
        isActive: profile.isActive,
        notes: profile.notes,
      },
      // v7.2 Doctor Clinical Discharge Authorization status (§2.4) — never
      // the hash itself, just whether/when a credential is configured.
      clinicalAuthorization: {
        username: profile.clinicalAuthUsername,
        active: profile.clinicalAuthActive,
        configured: !!profile.clinicalAuthUsername,
        updatedAt: profile.clinicalAuthUpdatedAt,
      },
      portalAccess: profile.portalUser ?? null, // null = "No Portal Access", a valid state (D16 p.4)
      employmentHistory: profile.employmentHistory,
      recentAttendance: profile.attendanceRecords,
      salary: {
        current: currentSalaryProfile,
        history: profile.salaryProfiles,
      },
      commissionRules: profile.commissionRules,
    };
  },

  // ── v7.2 Doctor Clinical Discharge Authorization (§2.4) ─────────────────
  // Deliberately separate from `PortalUser` login — a doctor can be "Staff
  // Record Only" (no portal account) and still hold discharge authorization.
  // Consumed later by the Admission Portal's discharge re-authentication
  // popup (not built in this phase — see HMS_V7.2_NEW_REQUIREMENTS.md §3.4).

  /** Create or replace a doctor's clinical discharge credential (also (re)activates it). */
  async setClinicalAuth(id: string, body: SetClinicalAuthBody, actorId: string) {
    await this.getById(id);
    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    try {
      const updated = await prisma.staff.update({
        where: { id },
        data: {
          clinicalAuthUsername: body.username,
          clinicalAuthPasswordHash: passwordHash,
          clinicalAuthActive: true,
          clinicalAuthUpdatedAt: new Date(),
          clinicalAuthUpdatedById: actorId,
        },
      });
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Clinical authorization username "${body.username}" is already in use by another doctor.`);
      }
      throw error;
    }
  },

  /** Rotates the password on an existing clinical discharge credential without changing the username. */
  async resetClinicalAuthPassword(id: string, body: ResetClinicalAuthPasswordBody, actorId: string) {
    const staff = await this.getById(id);
    if (!staff.clinicalAuthUsername) {
      throw new ConflictError('This staff member has no clinical discharge authorization credential configured yet.');
    }
    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    const updated = await prisma.staff.update({
      where: { id },
      data: {
        clinicalAuthPasswordHash: passwordHash,
        clinicalAuthUpdatedAt: new Date(),
        clinicalAuthUpdatedById: actorId,
      },
    });
    return updated;
  },

  async setClinicalAuthActive(id: string, active: boolean, actorId: string) {
    const staff = await this.getById(id);
    if (!staff.clinicalAuthUsername) {
      throw new ConflictError('This staff member has no clinical discharge authorization credential configured yet.');
    }
    const updated = await prisma.staff.update({
      where: { id },
      data: { clinicalAuthActive: active, clinicalAuthUpdatedAt: new Date(), clinicalAuthUpdatedById: actorId },
    });
    return updated;
  },

  // ── Salary Profile (HMS_V7.2_NEW_REQUIREMENTS.md §2.7) ─────────────────
  // Creating a new profile closes out whichever row was previously current
  // (effectiveTo = null) at this staff member's new effectiveFrom, so
  // `salaryProfiles.find(p => p.effectiveTo === null)` (used by
  // getFullProfile above) always resolves to exactly one current row.
  async createSalaryProfile(staffId: string, body: CreateSalaryProfileBody, actorId: string) {
    await this.getById(staffId);
    return prisma.$transaction(async (tx) => {
      await tx.staffSalaryProfile.updateMany({
        where: { staffId, effectiveTo: null },
        data: { effectiveTo: body.effectiveFrom },
      });
      return tx.staffSalaryProfile.create({
        data: {
          staffId,
          salaryTemplateId: body.salaryTemplateId ?? undefined,
          salaryBasis: body.salaryBasis,
          baseAmount: body.baseAmount,
          payrollDivisor: body.payrollDivisor ?? 30,
          salaryTaxMethod: body.salaryTaxMethod ?? null,
          salaryTaxValue: body.salaryTaxValue ?? null,
          salaryTaxEffectiveFrom: body.salaryTaxMethod ? body.effectiveFrom : null,
          effectiveFrom: body.effectiveFrom,
          createdById: actorId,
        },
        include: { salaryTemplate: true },
      });
    });
  },
};
