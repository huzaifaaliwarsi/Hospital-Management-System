import { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import type { ListStaffQuery } from './staff.schemas';

function buildWhere(query: ListStaffQuery): Prisma.StaffWhereInput {
  const where: Prisma.StaffWhereInput = {};
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.category) where.category = query.category;
  if (query.employmentStatus) where.employmentStatus = query.employmentStatus;
  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { employeeId: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

export const staffRepository = {
  count() {
    return prisma.staff.count();
  },

  async findMany(query: ListStaffQuery) {
    const where = buildWhere(query);
    const [rows, totalItems] = await prisma.$transaction([
      prisma.staff.findMany({
        where,
        include: { department: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.staff.count({ where }),
    ]);
    return { rows, totalItems };
  },

  findById(id: string) {
    return prisma.staff.findUnique({ where: { id } });
  },

  create(data: Prisma.StaffCreateInput) {
    return prisma.staff.create({ data });
  },

  update(id: string, data: Prisma.StaffUpdateInput) {
    return prisma.staff.update({ where: { id }, data });
  },

  deactivate(id: string) {
    return prisma.staff.update({
      where: { id },
      data: { isActive: false, employmentStatus: 'INACTIVE' },
    });
  },

  /**
   * Staff 360° profile (§4.1) — a single aggregate read across every tab
   * the client screen needs: Overview, Employment/Shift history, recent
   * Attendance, current Salary configuration, and Commission rules.
   */
  findFullProfile(id: string) {
    return prisma.staff.findUnique({
      where: { id },
      include: {
        department: true,
        portalUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            status: true,
            isCashHandling: true,
            mustResetPassword: true,
            lastLoginAt: true,
          },
        },
        employmentHistory: {
          orderBy: { effectiveFrom: 'desc' },
          take: 20,
        },
        attendanceRecords: {
          orderBy: { attendanceDate: 'desc' },
          take: 30,
        },
        salaryProfiles: {
          orderBy: { effectiveFrom: 'desc' },
          take: 5,
          include: { salaryTemplate: true },
        },
        commissionRules: {
          orderBy: { effectiveFrom: 'desc' },
          include: { serviceRate: { select: { id: true, code: true, name: true } } },
        },
      },
    });
  },
};
