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

/** staff.md §2/§4 — "Doctor service assignments must reference active real services." */
async function assertServicesActive(serviceIds: string[]): Promise<void> {
  const rows = await prisma.serviceRate.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, isActive: true, isDeleted: true },
  });
  const found = new Map(rows.map((r) => [r.id, r]));
  for (const id of serviceIds) {
    const svc = found.get(id);
    if (!svc || svc.isDeleted || !svc.isActive) {
      throw new ConflictError(`Service "${id}" is not an active service and cannot be assigned to a doctor.`);
    }
  }
}

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
    if (body.cnic) {
      const existing = await prisma.staff.findUnique({ where: { cnic: body.cnic } });
      if (existing) throw new ConflictError(`CNIC "${body.cnic}" is already registered to another staff member.`);
    }
    if (body.category === 'Doctor' && body.serviceIds && body.serviceIds.length > 0) {
      await assertServicesActive(body.serviceIds);
    }

    const actorLabel = await resolveActorLabel(createdById);
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_EMPLOYEE_ID_RETRIES; attempt += 1) {
      const employeeId = await generateNumericEmployeeId(attempt);
      try {
        const deptIds = body.departmentIds ?? [];
        const primaryDeptId = deptIds[0];

        const data: Prisma.StaffCreateInput = {
          employeeId,
          fullName: body.fullName,
          fatherGuardianName: body.fatherGuardianName,
          cnic: body.cnic,
          dateOfBirth: body.dateOfBirth,
          category: body.category,
          ...(primaryDeptId ? { department: { connect: { id: primaryDeptId } } } : {}),
          designation: body.designation,
          phone: body.phone,
          alternatePhone: body.alternatePhone,
          email: body.email,
          joiningDate: body.joiningDate ?? new Date(),
          notes: body.notes,
          ...(body.assignedShiftId ? { assignedShift: { connect: { id: body.assignedShiftId } } } : {}),
          doctorSponsoredDiscountTrackingEnabled: body.doctorSponsoredDiscountTrackingEnabled ?? false,
          availableForOpd: body.availableForOpd ?? false,
          availableForObservation: body.availableForObservation ?? false,
          availableForEmergency: body.availableForEmergency ?? false,
          createdBy: actorLabel,
          updatedBy: actorLabel,
          ...(deptIds.length > 0
            ? {
                staffDepartments: {
                  create: deptIds.map((deptId) => ({
                    departmentId: deptId,
                    isPrimary: deptId === primaryDeptId,
                    assignedBy: actorLabel,
                  })),
                },
              }
            : {}),
          ...(body.serviceIds && body.serviceIds.length > 0
            ? {
                staffServices: {
                  create: body.serviceIds.map((serviceRateId) => ({ serviceRateId, assignedBy: actorLabel })),
                },
              }
            : {}),
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
    const existing = await this.getById(id);

    if (body.cnic && body.cnic !== existing.cnic) {
      const dup = await prisma.staff.findUnique({ where: { cnic: body.cnic } });
      if (dup && dup.id !== id) throw new ConflictError(`CNIC "${body.cnic}" is already registered to another staff member.`);
    }

    const nextCategory = body.category ?? existing.category;
    if (nextCategory === 'Doctor' && body.serviceIds && body.serviceIds.length > 0) {
      await assertServicesActive(body.serviceIds);
    }
    const leavingDoctorCategory = existing.category === 'Doctor' && body.category !== undefined && body.category !== 'Doctor';

    const actorLabel = await resolveActorLabel(updatedById);
    const data: Prisma.StaffUpdateInput = { ...body, updatedBy: actorLabel };
    delete (data as Record<string, unknown>).departmentIds;
    delete (data as Record<string, unknown>).serviceIds;
    delete (data as Record<string, unknown>).assignedShiftId;
    if (body.departmentIds && body.departmentIds.length > 0) {
      data.department = { connect: { id: body.departmentIds[0] } };
    }
    if (body.assignedShiftId !== undefined) {
      data.assignedShift = body.assignedShiftId ? { connect: { id: body.assignedShiftId } } : { disconnect: true };
    }

    // Plain field update, no department/service junction work needed — skip the transaction.
    const needsJunctionSync = body.departmentIds !== undefined || body.serviceIds !== undefined || leavingDoctorCategory;
    if (!needsJunctionSync) {
      return staffRepository.update(id, data);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.staff.update({
        where: { id },
        data,
        include: {
          department: true,
          staffDepartments: { select: { id: true, departmentId: true, isPrimary: true, department: { select: { id: true, name: true, code: true } } } },
          staffServices: { where: { isActive: true }, select: { id: true, serviceRateId: true, serviceRate: { select: { id: true, name: true, code: true } } } },
          portalUser: { select: { id: true, username: true, email: true, role: true, status: true, mustResetPassword: true, lastLoginAt: true, passwordResetBy: true, passwordResetAt: true } },
        },
      });

      // Replace department junction rows only when the caller explicitly sent a new list.
      if (body.departmentIds !== undefined) {
        await tx.staffDepartment.deleteMany({ where: { staffId: id } });
        if (body.departmentIds.length > 0) {
          await tx.staffDepartment.createMany({
            data: body.departmentIds.map((deptId) => ({
              staffId: id,
              departmentId: deptId,
              isPrimary: deptId === body.departmentIds![0],
              assignedBy: actorLabel,
            })),
          });
        }
      }

      // Doctor ↔ Service assignments: soft-deactivate rather than delete, so
      // commission history on `DoctorCommissionRule` for the same service stays intact.
      if (leavingDoctorCategory) {
        await tx.staffService.updateMany({ where: { staffId: id, isActive: true }, data: { isActive: false } });
      } else if (body.serviceIds !== undefined) {
        const targetIds = new Set(body.serviceIds);
        const current = await tx.staffService.findMany({ where: { staffId: id } });
        const currentById = new Map(current.map((c) => [c.serviceRateId, c]));

        for (const row of current) {
          if (row.isActive && !targetIds.has(row.serviceRateId)) {
            await tx.staffService.update({ where: { id: row.id }, data: { isActive: false } });
          }
        }
        for (const serviceRateId of targetIds) {
          const row = currentById.get(serviceRateId);
          if (!row) {
            await tx.staffService.create({ data: { staffId: id, serviceRateId, assignedBy: actorLabel } });
          } else if (!row.isActive) {
            await tx.staffService.update({ where: { id: row.id }, data: { isActive: true, assignedBy: actorLabel } });
          }
        }
      }

      return updated;
    });
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
        assignedShift: profile.assignedShift,
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
      departments: profile.staffDepartments,
      assignedServices: profile.staffServices,
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
