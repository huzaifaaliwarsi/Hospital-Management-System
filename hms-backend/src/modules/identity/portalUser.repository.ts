import { Prisma, PortalRole } from '@prisma/client';
import { prisma } from '@/db/client';
import type { ListPortalUsersQuery } from './portalUser.schemas';

const staffSummarySelect = {
  select: {
    id: true,
    employeeId: true,
    fullName: true,
    designation: true,
    department: { select: { id: true, name: true, code: true } },
  },
} as const;

const portalUserSelect = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  phone: true,
  role: true,
  status: true,
  isProtected: true,
  isCashHandling: true,
  mustResetPassword: true,
  lastLoginAt: true,
  passwordResetAt: true,
  passwordResetBy: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
  staff: staffSummarySelect,
} satisfies Prisma.PortalUserSelect;

function buildWhere(query: ListPortalUsersQuery): Prisma.PortalUserWhereInput {
  const where: Prisma.PortalUserWhereInput = {};
  if (query.roles && query.roles.length > 0) {
    where.role = { in: query.roles as PortalRole[] };
  }
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { username: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { displayName: { contains: query.search, mode: 'insensitive' } },
      { staff: { fullName: { contains: query.search, mode: 'insensitive' } } },
    ];
  }
  return where;
}

export const portalUserRepository = {
  async findMany(query: ListPortalUsersQuery) {
    const where = buildWhere(query);
    const [rows, totalItems] = await prisma.$transaction([
      prisma.portalUser.findMany({
        where,
        select: portalUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.portalUser.count({ where }),
    ]);
    return { rows, totalItems };
  },

  findById(id: string) {
    return prisma.portalUser.findUnique({ where: { id }, select: portalUserSelect });
  },

  findByStaffId(staffId: string) {
    return prisma.portalUser.findUnique({ where: { staffId } });
  },

  create(data: Prisma.PortalUserCreateInput) {
    return prisma.portalUser.create({ data, select: portalUserSelect });
  },

  update(id: string, data: Prisma.PortalUserUpdateInput) {
    return prisma.portalUser.update({ where: { id }, data, select: portalUserSelect });
  },

  updateStatus(id: string, status: 'ACTIVE' | 'SUSPENDED', updatedBy: string) {
    return prisma.portalUser.update({ where: { id }, data: { status, updatedBy }, select: portalUserSelect });
  },

  updatePasswordForcedReset(id: string, passwordHash: string, actorLabel: string) {
    return prisma.portalUser.update({
      where: { id },
      data: {
        passwordHash,
        mustResetPassword: true,
        passwordResetAt: new Date(),
        passwordResetBy: actorLabel,
        updatedBy: actorLabel,
      },
      select: portalUserSelect,
    });
  },

  delete(id: string) {
    return prisma.portalUser.delete({ where: { id } });
  },
};
