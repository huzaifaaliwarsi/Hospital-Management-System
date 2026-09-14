import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { portalUserRepository } from './portalUser.repository';
import { authRepository } from './auth.repository';
import { NotFoundError, ConflictError, BusinessRuleError } from '@/shared/errors/AppError';
import { buildPaginationMeta } from '@/shared/pagination';
import { resolveActorLabel } from '@/shared/actorLabel';
import type {
  CreatePortalUserBody,
  UpdatePortalUserBody,
  ListPortalUsersQuery,
  UpdatePortalUserStatusBody,
} from './portalUser.schemas';

const BCRYPT_ROUNDS = 12;

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

  async create(body: CreatePortalUserBody, createdByPortalUserId: string) {
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

  async update(id: string, body: UpdatePortalUserBody, updatedByPortalUserId: string) {
    await this.getById(id);
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

  async updateStatus(id: string, body: UpdatePortalUserStatusBody, updatedByPortalUserId: string) {
    if (body.status === 'SUSPENDED') {
      await this.assertNotProtected(id, 'suspended');
    } else {
      await this.getById(id);
    }
    const actorLabel = await resolveActorLabel(updatedByPortalUserId);
    await portalUserRepository.updateStatus(id, body.status, actorLabel);
    if (body.status === 'SUSPENDED') {
      await authRepository.revokeAllRefreshTokensForUser(id);
    }
    return this.getById(id);
  },

  async resetPassword(id: string, newPassword: string, resetByPortalUserId: string) {
    await this.assertNotProtected(id, 'password-reset by another administrator');
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const actorLabel = await resolveActorLabel(resetByPortalUserId);
    await portalUserRepository.updatePasswordForcedReset(id, passwordHash, actorLabel);
    await authRepository.revokeAllRefreshTokensForUser(id);
    return this.getById(id);
  },

  async remove(id: string) {
    await this.assertNotProtected(id, 'deleted');
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
