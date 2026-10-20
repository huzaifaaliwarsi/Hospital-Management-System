import { beforeEach, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
const mocks = vi.hoisted(() => ({
  findSession: vi.fn(),
  repository: {
    findByIdentifier: vi.fn(), findById: vi.fn(), createRefreshToken: vi.fn(),
    updateLastLogin: vi.fn(), findRefreshTokenByHash: vi.fn(), revokeRefreshToken: vi.fn(),
    revokeAllRefreshTokensForUser: vi.fn(), updatePassword: vi.fn(),
  },
}));
vi.mock('@/db/client', () => ({ prisma: { refreshToken: { findUnique: mocks.findSession } } }));
vi.mock('@/config/env', () => ({ env: {
  JWT_ACCESS_SECRET: 'test-session-signing-secret', JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d',
  INTERNAL_BRIDGE_SECRET: 'test-bridge-secret',
} }));
vi.mock('@/modules/identity/auth.repository', () => ({ authRepository: mocks.repository }));
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn().mockResolvedValue(true), hash: vi.fn().mockResolvedValue('new-hash') } }));
import { authenticate, blockIfMustResetPassword } from '@/middleware/authenticate';
import { authService } from '@/modules/identity/auth.service';

const user = { id: 'user', status: 'ACTIVE', role: 'FRONT_DESK_BILLING', staffId: null, mustResetPassword: false };
const session = () => ({ portalUserId: user.id, revokedAt: null, expiresAt: new Date(Date.now() + 60000), portalUser: { ...user } });
const token = (claims = {}) => jwt.sign({
  sub: user.id, role: 'SUPER_ADMIN', staffId: null, mustResetPassword: false, sessionId: 'session', ...claims,
}, 'test-session-signing-secret', { expiresIn: '15m' });
async function request(accessToken = token()) {
  const req: any = { headers: { authorization: `Bearer ${accessToken}` } };
  const next = vi.fn();
  await authenticate(req, {} as any, next);
  return { req, next };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findSession.mockResolvedValue(session());
  mocks.repository.findByIdentifier.mockResolvedValue(user);
  mocks.repository.findById.mockResolvedValue(user);
  mocks.repository.createRefreshToken.mockResolvedValue({ id: 'new-session' });
});
it('uses the current database role instead of the old super-admin JWT claim', async () => {
  const { req, next } = await request();
  expect(next).toHaveBeenCalledWith();
  expect(req.user.role).toBe('FRONT_DESK_BILLING');
});
it.each(['suspended', 'revoked', 'expired', 'missing', 'wrong-owner'])('blocks %s sessions immediately', async condition => {
  const state: any = session();
  if (condition === 'suspended') state.portalUser.status = 'SUSPENDED';
  if (condition === 'revoked') state.revokedAt = new Date();
  if (condition === 'expired') state.expiresAt = new Date(0);
  if (condition === 'wrong-owner') state.portalUserId = 'another-user';
  mocks.findSession.mockResolvedValue(condition === 'missing' ? null : state);
  const { req, next } = await request();
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  expect(req.user).toBeUndefined();
});
it('enforces a password reset imposed after the access token was issued', async () => {
  mocks.findSession.mockResolvedValue({ ...session(), portalUser: { ...user, mustResetPassword: true } });
  const { req } = await request();
  const next = vi.fn();
  blockIfMustResetPassword(req, {} as any, next);
  expect(next.mock.calls[0][0].message).toContain('Password reset required');
});
it('does not keep a completed password reset blocked by an old JWT flag', async () => {
  const { req } = await request(token({ mustResetPassword: true }));
  const next = vi.fn();
  blockIfMustResetPassword(req, {} as any, next);
  expect(next).toHaveBeenCalledWith();
});
it('requires legacy tokens to refresh and forwards DB failures to Express', async () => {
  expect((await request(token({ sessionId: undefined }))).next.mock.calls[0][0]).toBeInstanceOf(Error);
  mocks.findSession.mockRejectedValue(new Error('database unavailable'));
  expect((await request()).next.mock.calls[0][0].message).toBe('database unavailable');
});
it('keeps the existing authenticated bridge path working', async () => {
  const req: any = { headers: { 'x-bridge-token': 'test-bridge-secret' } };
  const next = vi.fn();
  await authenticate(req, {} as any, next);
  expect(req.isInternalBridge).toBe(true);
  expect(next).toHaveBeenCalledWith();
  expect(mocks.findSession).not.toHaveBeenCalled();
});
it('binds login and refreshed access tokens to the newly created session', async () => {
  const login = await authService.login({ identifier: 'user', password: 'test-only' }, {});
  expect((jwt.decode(login.accessToken) as any).sessionId).toBe('new-session');
  mocks.repository.findRefreshTokenByHash.mockResolvedValue({ id: 'old-session', portalUserId: 'user', expiresAt: new Date(Date.now() + 60000), revokedAt: null });
  const refreshed = await authService.refresh('old-refresh', {});
  expect((jwt.decode(refreshed.accessToken) as any).sessionId).toBe('new-session');
  expect(mocks.repository.revokeRefreshToken).toHaveBeenCalledWith('old-session', expect.any(String));
});
it('logout and password changes revoke the sessions checked on every request', async () => {
  mocks.repository.findRefreshTokenByHash.mockResolvedValue({ id: 'session', revokedAt: null });
  await authService.logout('refresh');
  expect(mocks.repository.revokeRefreshToken).toHaveBeenCalledWith('session');
  await authService.changePassword('user', { currentPassword: 'old-password', newPassword: 'new-password' });
  expect(mocks.repository.revokeAllRefreshTokensForUser).toHaveBeenCalledWith('user');
});
