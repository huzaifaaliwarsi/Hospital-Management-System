import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AuthenticationError, ValidationError } from '@/shared/errors/AppError';
import { authRepository } from './auth.repository';
import type { LoginBody, ChangePasswordBody } from './auth.schemas';
import type { AccessTokenPayload } from '@/middleware/authenticate';

const REFRESH_TOKEN_BYTES = 40;
const BCRYPT_ROUNDS = 12;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

function msToMillis(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value);
  if (!match) throw new Error(`Invalid duration string: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof unitMs;
  const unitMs = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * (unitMs[unit] ?? 1);
}

async function issueRefreshToken(portalUserId: string) {
  const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + msToMillis(env.JWT_REFRESH_TTL));
  await authRepository.createRefreshToken({ portalUserId, tokenHash, expiresAt });
  return { rawToken, expiresAt };
}

export const authService = {
  async login(body: LoginBody) {
    const user = await authRepository.findByIdentifier(body.identifier);
    if (!user) throw new AuthenticationError('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new AuthenticationError('This account is suspended');

    const passwordOk = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordOk) throw new AuthenticationError('Invalid credentials');

    const payload: AccessTokenPayload = { sub: user.id, role: user.role, mustResetPassword: user.mustResetPassword };
    const accessToken = signAccessToken(payload);
    const { rawToken: refreshToken, expiresAt } = await issueRefreshToken(user.id);
    await authRepository.updateLastLogin(user.id);

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role, mustResetPassword: user.mustResetPassword },
    };
  },

  /** Rotates the refresh token on every use. A replayed/revoked token revokes the whole session family. */
  async refresh(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await authRepository.findRefreshTokenByHash(tokenHash);
    if (!existing) throw new AuthenticationError('Invalid refresh token');

    if (existing.revokedAt) {
      await authRepository.revokeAllRefreshTokensForUser(existing.portalUserId);
      throw new AuthenticationError('Refresh token replay detected — all sessions revoked');
    }
    if (existing.expiresAt.getTime() < Date.now()) throw new AuthenticationError('Refresh token expired');

    const user = await authRepository.findById(existing.portalUserId);
    if (!user || user.status !== 'ACTIVE') throw new AuthenticationError('Account is not active');

    await authRepository.revokeRefreshToken(existing.id);
    const { rawToken: newRefreshToken, expiresAt } = await issueRefreshToken(user.id);
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, mustResetPassword: user.mustResetPassword };
    const accessToken = signAccessToken(payload);

    return { accessToken, refreshToken: newRefreshToken, refreshTokenExpiresAt: expiresAt };
  },

  async logout(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) return;
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await authRepository.findRefreshTokenByHash(tokenHash);
    if (existing && !existing.revokedAt) await authRepository.revokeRefreshToken(existing.id);
  },

  async changePassword(portalUserId: string, body: ChangePasswordBody) {
    const user = await authRepository.findById(portalUserId);
    if (!user) throw new AuthenticationError();
    const currentOk = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!currentOk) throw new ValidationError('Current password is incorrect');
    const newHash = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);
    await authRepository.updatePassword(user.id, newHash);
    await authRepository.revokeAllRefreshTokensForUser(user.id);

    // The caller's own access token still carries the OLD mustResetPassword=true
    // claim (JWTs are stateless) and its refresh token was just revoked above —
    // without issuing a fresh pair here, the now-password-changed user would be
    // stuck unable to call anything else until they log in again from scratch.
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, mustResetPassword: false };
    const accessToken = signAccessToken(payload);
    const { rawToken: refreshToken, expiresAt } = await issueRefreshToken(user.id);
    return { accessToken, refreshToken, refreshTokenExpiresAt: expiresAt };
  },
};
