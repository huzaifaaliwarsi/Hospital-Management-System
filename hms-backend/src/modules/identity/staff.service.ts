import { Prisma } from '@prisma/client';
import { staffRepository } from './staff.repository';
import { NotFoundError } from '@/shared/errors/AppError';
import { buildPaginationMeta } from '@/shared/pagination';
import { resolveActorLabel } from '@/shared/actorLabel';
import type {
  CreateStaffBody,
  UpdateStaffBody,
  ListStaffQuery,
} from './staff.schemas';

/**
 * System-generated Employee ID (§16 Q-01 — exact format not specified by
 * the client; `EMP-<year>-<sequence>` is this phase's placeholder).
 * Generation + insert is retried on a unique-constraint race rather than
 * serialized behind a lock, since staff creation is a low-frequency,
 * low-concurrency operation.
 */
function buildEmployeeId(sequence: number): string {
  const year = new Date().getFullYear();
  return `EMP-${year}-${String(sequence).padStart(6, '0')}`;
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
      const nextSequence = (await staffRepository.count()) + 1 + attempt;
      const employeeId = buildEmployeeId(nextSequence);
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
    await this.getById(id);
    const actorLabel = await resolveActorLabel(updatedById);
    return staffRepository.update(id, { isActive: false, employmentStatus: 'INACTIVE', updatedBy: actorLabel });
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
};
