import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { PortalRole } from '@/config/constants';

export interface AccessTokenPayload {
  sub: string; // portal user id
  role: PortalRole;
  staffId: string | null;
  mustResetPassword: boolean;
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
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or malformed Authorization header');
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    req.user = payload;
    next();
  } catch {
    throw new AuthenticationError('Invalid or expired access token');
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
    throw new AuthenticationError('Password reset required before continuing');
  }
  next();
}
