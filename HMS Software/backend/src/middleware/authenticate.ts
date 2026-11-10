import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { PortalRole } from '@/config/constants';
import { prisma } from '@/db/client';

export interface AccessTokenPayload {
  sub: string; // portal user id
  role: PortalRole;
  staffId: string | null;
  mustResetPassword: boolean;
  sessionId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/** Verifies the JWT access token and attaches `req.user` (§7.6 step 6, §7.8). */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const bridgeToken = req.headers['x-bridge-token'] || req.headers['x-internal-secret'] || req.headers['x-bridge-key'];
    if (bridgeToken && bridgeToken === env.INTERNAL_BRIDGE_SECRET) {
      (req as any).isInternalBridge = true;
      req.user = {
        sub: 'bridge-system',
        role: 'SUPER_ADMIN',
        staffId: null,
        mustResetPassword: false,
      };
      return next();
    }

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or malformed Authorization header');
    }

    const token = header.slice('Bearer '.length);

    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AccessTokenPayload;
    } catch {
      throw new AuthenticationError('Invalid or expired access token');
    }
    if (!payload || typeof payload.sub !== 'string' || typeof payload.sessionId !== 'string') {
      throw new AuthenticationError('Session refresh required');
    }
    const session = await prisma.refreshToken.findUnique({
      where: { id: payload.sessionId },
      select: {
        portalUserId: true, revokedAt: true, expiresAt: true,
        portalUser: { select: { id: true, status: true, role: true, staffId: true, mustResetPassword: true } },
      },
    });
    if (!session || session.portalUserId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
      throw new AuthenticationError('Session expired or revoked');
    }
    const user = session.portalUser;
    if (user.status !== 'ACTIVE') throw new AuthenticationError('Account is not active');
    // Permissions and reset requirements come from the current account, not stale JWT claims.
    req.user = { sub: user.id, role: user.role, staffId: user.staffId,
      mustResetPassword: user.mustResetPassword, sessionId: payload.sessionId };
    next();
  } catch (error) {
    next(error); // Express 4 does not forward rejected async middleware automatically.
  }
}

/**
 * Blocks all non-auth routes until the user completes a forced password
 * reset (§7.8) — used for the bootstrap Super Admin and any Admin-issued
 * Reset Password action. Mount after `authenticate` on protected routers,
 * excluding the auth router itself.
 */
export function blockIfMustResetPassword(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.mustResetPassword) {
    return next(new AuthenticationError('Password reset required before continuing'));
  }
  next();
}
