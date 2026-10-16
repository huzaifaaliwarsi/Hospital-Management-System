import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AuthenticationError, ValidationError } from '@/shared/errors/AppError';
import { authRepository } from './auth.repository';
import type { LoginBody, ChangePasswordBody } from './auth.schemas';
import type { AccessTokenPayload } from '@/middleware/authenticate';

const REFRESH_TOKEN_BYTES = 40;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

async function issueRefreshToken(
  portalUserId: string,
  meta: { userAgent?: string; ipAddress?: string },
) {
  const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + msToMillis(env.JWT_REFRESH_TTL));

  await authRepository.createRefreshToken({
    portalUserId,
    tokenHash,
    expiresAt,
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  return { rawToken, expiresAt };
}

function msToMillis(value: string): number {
  // Lightweight duration parser for the small set of suffixes we use
  // (avoids adding a second time-parsing dependency beyond `ms`).
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value);
  if (!match) throw new Error(`Invalid duration string: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof unitMs;
  const unitMs = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * (unitMs[unit] ?? 1);
}

export const authService = {
  async login(body: LoginBody, meta: { userAgent?: string; ipAddress?: string }) {
    const user = await authRepository.findByIdentifier(body.identifier);
    if (!user) throw new AuthenticationError('Invalid credentials');

    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('This account is suspended');
    }

    const passwordOk = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordOk) throw new AuthenticationError('Invalid credentials');

    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      staffId: user.staffId,
      mustResetPassword: user.mustResetPassword,
    };
    const accessToken = signAccessToken(payload);
    const { rawToken: refreshToken, expiresAt } = await issueRefreshToken(user.id, meta);
    await authRepository.updateLastLogin(user.id);

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        mustResetPassword: user.mustResetPassword,
      },
    };
  },

  /**
   * Rotates the refresh token on every use (§7.8). Replaying an
   * already-revoked token is treated as possible theft and revokes every
   * active session for that user.
   */
  async refresh(rawRefreshToken: string, meta: { userAgent?: string; ipAddress?: string }) {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await authRepository.findRefreshTokenByHash(tokenHash);

    if (!existing) throw new AuthenticationError('Invalid refresh token');

    if (existing.revokedAt) {
      // Replay of an already-used/revoked token — revoke the whole session family.
      await authRepository.revokeAllRefreshTokensForUser(existing.portalUserId);
      throw new AuthenticationError('Refresh token replay detected — all sessions revoked');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new AuthenticationError('Refresh token expired');
    }

    const user = await authRepository.findById(existing.portalUserId);
    if (!user || user.status !== 'ACTIVE') {
      throw new AuthenticationError('Account is not active');
    }

    const { rawToken: newRefreshToken, expiresAt } = await issueRefreshToken(user.id, meta);
    await authRepository.revokeRefreshToken(existing.id, newRefreshToken);

    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      staffId: user.staffId,
      mustResetPassword: user.mustResetPassword,
    };
    const accessToken = signAccessToken(payload);

    return { accessToken, refreshToken: newRefreshToken, refreshTokenExpiresAt: expiresAt };
  },

  async logout(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) return;
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await authRepository.findRefreshTokenByHash(tokenHash);
    if (existing && !existing.revokedAt) {
      await authRepository.revokeRefreshToken(existing.id);
    }
  },

  async changePassword(portalUserId: string, body: ChangePasswordBody) {
    const user = await authRepository.findById(portalUserId);
    if (!user) throw new AuthenticationError();

    const currentOk = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!currentOk) throw new ValidationError('Current password is incorrect');

    const newHash = await bcrypt.hash(body.newPassword, 12);
    await authRepository.updatePassword(user.id, newHash);
    // Force re-login everywhere once the password changes.
    await authRepository.revokeAllRefreshTokensForUser(user.id);
  },
};
