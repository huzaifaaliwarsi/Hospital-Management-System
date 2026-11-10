import { prisma } from '@/db/client';

export const authRepository = {
  findByIdentifier(identifier: string) {
    return prisma.portalUser.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    });
  },

  findById(id: string) {
    return prisma.portalUser.findUnique({ where: { id } });
  },

  updateLastLogin(id: string) {
    return prisma.portalUser.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },

  updatePassword(id: string, passwordHash: string) {
    return prisma.portalUser.update({
      where: { id },
      data: { passwordHash, mustResetPassword: false },
    });
  },

  createRefreshToken(data: {
    portalUserId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }) {
    return prisma.refreshToken.create({ data });
  },

  findRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  revokeRefreshToken(id: string, replacedBy?: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedBy },
    });
  },

  revokeAllRefreshTokensForUser(portalUserId: string) {
    return prisma.refreshToken.updateMany({
      where: { portalUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
