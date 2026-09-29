import bcrypt from 'bcryptjs';
import { prisma } from '@/db/client';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '@/shared/errors/AppError';
import type { PortalRole } from '@/config/constants';
import type { CreateUserBody, UpdateUserStatusBody, ResetPasswordBody } from './users.schemas';

const BCRYPT_ROUNDS = 12;

/**
 * pharmacy.md §2.1/§13 — "Super Admin creates Admin accounts only. Admin
 * creates Sales accounts only." Enforced precisely here (not by the coarse
 * per-module `authorize` policy) — this is exactly the governance step
 * hms-backend's Pharmacy roles are missing today (pharmacy.md §19.1).
 */
const WHO_CAN_CREATE: Record<PortalRole, PortalRole | null> = {
  SUPER_ADMIN: 'ADMIN',
  ADMIN: 'SALES_DISPENSING',
  SALES_DISPENSING: null,
};

const SAFE_SELECT = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  isProtected: true,
  mustResetPassword: true,
  lastLoginAt: true,
  createdAt: true,
  createdById: true,
} as const;

export const usersService = {
  /** Every account the requesting role is allowed to manage — Super Admin sees Admins, Admin sees Sales. */
  async listManaged(actorRole: PortalRole) {
    const targetRole = WHO_CAN_CREATE[actorRole];
    if (!targetRole) throw new AuthorizationError('This role does not manage any accounts');
    return prisma.portalUser.findMany({ where: { role: targetRole }, select: SAFE_SELECT, orderBy: { createdAt: 'desc' } });
  },

  async create(body: CreateUserBody, actorId: string, actorRole: PortalRole) {
    const allowedTarget = WHO_CAN_CREATE[actorRole];
    if (!allowedTarget || body.role !== allowedTarget) {
      throw new AuthorizationError(`${actorRole} may only create ${allowedTarget ?? 'no'} accounts`);
    }

    const existing = await prisma.portalUser.findFirst({
      where: { OR: [{ username: body.username }, ...(body.email ? [{ email: body.email }] : [])] },
    });
    if (existing) throw new ConflictError('Username or email already in use');

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    return prisma.portalUser.create({
      data: {
        username: body.username,
        email: body.email,
        fullName: body.fullName,
        phone: body.phone,
        passwordHash,
        role: body.role,
        createdById: actorId,
        mustResetPassword: true,
      },
      select: SAFE_SELECT,
    });
  },

  async updateStatus(id: string, body: UpdateUserStatusBody, actorRole: PortalRole) {
    const target = await prisma.portalUser.findUnique({ where: { id } });
    if (!target) throw new NotFoundError('User not found');
    if (target.isProtected) throw new AuthorizationError('The protected Super Admin account cannot be changed');
    if (WHO_CAN_CREATE[actorRole] !== target.role) {
      throw new AuthorizationError(`${actorRole} may not manage a ${target.role} account`);
    }
    return prisma.portalUser.update({ where: { id }, data: { status: body.status }, select: SAFE_SELECT });
  },

  async resetPassword(id: string, body: ResetPasswordBody, actorRole: PortalRole) {
    const target = await prisma.portalUser.findUnique({ where: { id } });
    if (!target) throw new NotFoundError('User not found');
    if (target.isProtected) throw new AuthorizationError('The protected Super Admin account cannot be changed');
    if (WHO_CAN_CREATE[actorRole] !== target.role) {
      throw new AuthorizationError(`${actorRole} may not manage a ${target.role} account`);
    }
    if (body.newPassword.length < 8) throw new ValidationError('Password must be at least 8 characters');
    const passwordHash = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);
    return prisma.portalUser.update({ where: { id }, data: { passwordHash, mustResetPassword: true }, select: SAFE_SELECT });
  },
};
