import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { portalUserRepository } from './portalUser.repository';
import { authRepository } from './auth.repository';
import { NotFoundError, ConflictError, BusinessRuleError, AuthorizationError } from '@/shared/errors/AppError';
import { buildPaginationMeta } from '@/shared/pagination';
import { resolveActorLabel } from '@/shared/actorLabel';
import type { PortalRole } from '@/config/constants';
import type {
  CreatePortalUserBody,
  UpdatePortalUserBody,
  ListPortalUsersQuery,
  UpdatePortalUserStatusBody,
} from './portalUser.schemas';

const BCRYPT_ROUNDS = 12;

/** Only these two tiers are "administrative" for the guard below — every other role is Staff. */
const ADMIN_TIER_ROLES: PortalRole[] = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Governance rule: an ADMIN actor may provision/manage Staff accounts freely
 * (§3.3 Access-Control Matrix grants `identity: full` at the module level),
 * but may never create, promote into, or otherwise manage an ADMIN or
 * SUPER_ADMIN tier account — that is reserved for SUPER_ADMIN. This
 * record-scoped check can't live in the coarse module policy map
 * (`authorize.ts`), so it's enforced here per §7.9.
 */
function assertActorMayManageRole(actorRole: PortalRole, targetRole: PortalRole, verb: string) {
  if (actorRole === 'ADMIN' && ADMIN_TIER_ROLES.includes(targetRole)) {
    throw new AuthorizationError(
      `Admins cannot ${verb} Admin or Super Admin accounts — only a Super Admin can manage administrative-tier accounts.`,
    );
  }
}

/** Translates a Prisma unique-constraint hit into a clear, field-specific message. */
function rethrowAsConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
    throw new ConflictError(`A portal account with this ${target} already exists.`);
  }
  throw error;
}

export const portalUserService = {
  async list(query: ListPortalUsersQuery) {
    const { rows, totalItems } = await portalUserRepository.findMany(query);
    return { rows, meta: buildPaginationMeta(query, totalItems) };
  },

  async getById(id: string) {
    const user = await portalUserRepository.findById(id);
    if (!user) throw new NotFoundError('Portal account not found');
    return user;
  },

  async create(body: CreatePortalUserBody, createdByPortalUserId: string, actorRole: PortalRole) {
    assertActorMayManageRole(actorRole, body.role, 'create');

    if (body.staffId) {
      const existing = await portalUserRepository.findByStaffId(body.staffId);
      if (existing) {
        throw new ConflictError('This staff member already has a portal login account.');
      }
    }

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    const actorLabel = await resolveActorLabel(createdByPortalUserId);
    const data: Prisma.PortalUserCreateInput = {
      username: body.username.trim(),
      email: body.email,
      displayName: body.fullName.trim(),
      phone: body.phone,
      passwordHash,
      role: body.role,
      isCashHandling: body.isCashHandling ?? false,
      mustResetPassword: true,
      createdBy: actorLabel,
      updatedBy: actorLabel,
      ...(body.staffId ? { staff: { connect: { id: body.staffId } } } : {}),
    };

    try {
      return await portalUserRepository.create(data);
    } catch (error) {
      rethrowAsConflict(error);
    }
  },

  async update(id: string, body: UpdatePortalUserBody, updatedByPortalUserId: string, actorRole: PortalRole) {
    const existing = await this.getById(id);
    assertActorMayManageRole(actorRole, existing.role, 'edit');
    if (body.role) {
      assertActorMayManageRole(actorRole, body.role, 'assign');
    }
    const actorLabel = await resolveActorLabel(updatedByPortalUserId);
    const data: Prisma.PortalUserUpdateInput = {
      email: body.email,
      role: body.role,
      isCashHandling: body.isCashHandling,
      updatedBy: actorLabel,
      ...(body.fullName !== undefined ? { displayName: body.fullName.trim() } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
    };
    try {
      return await portalUserRepository.update(id, data);
    } catch (error) {
      rethrowAsConflict(error);
    }
  },

  /** Root/protected accounts (§3.2 — SUPER_ADMIN / PHARMACY_SUPER_ADMIN) can never be suspended or deleted. */
  async assertNotProtected(id: string, action: string) {
    const user = await this.getById(id);
    if (user.isProtected) {
      throw new BusinessRuleError(`This account is protected and cannot be ${action}.`);
    }
    return user;
  },

  async updateStatus(id: string, body: UpdatePortalUserStatusBody, updatedByPortalUserId: string, actorRole: PortalRole) {
    let existing;
    if (body.status === 'SUSPENDED') {
      existing = await this.assertNotProtected(id, 'suspended');
    } else {
      existing = await this.getById(id);
    }
    assertActorMayManageRole(actorRole, existing.role, 'change the status of');
    const actorLabel = await resolveActorLabel(updatedByPortalUserId);
    await portalUserRepository.updateStatus(id, body.status, actorLabel);
    if (body.status === 'SUSPENDED') {
      await authRepository.revokeAllRefreshTokensForUser(id);
    }
    return this.getById(id);
  },

  async resetPassword(id: string, newPassword: string, resetByPortalUserId: string, actorRole: PortalRole) {
    const existing = await this.assertNotProtected(id, 'password-reset by another administrator');
    assertActorMayManageRole(actorRole, existing.role, 'reset the password of');
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const actorLabel = await resolveActorLabel(resetByPortalUserId);
    await portalUserRepository.updatePasswordForcedReset(id, passwordHash, actorLabel);
    await authRepository.revokeAllRefreshTokensForUser(id);
    return this.getById(id);
  },

  async remove(id: string, actorRole: PortalRole) {
    const existing = await this.assertNotProtected(id, 'deleted');
    assertActorMayManageRole(actorRole, existing.role, 'delete');
    try {
      await portalUserRepository.delete(id);
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
          'This account has linked activity (invoices, approvals, audit history) and cannot be deleted. Suspend it instead.',
        );
      }
      throw error;
    }
  },
};
