import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { PortalRole } from '@/config/constants';

export interface AccessTokenPayload {
  sub: string; // portal user id
  role: PortalRole;
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

/** Verifies the JWT access token and attaches `req.user`. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const bridgeToken = req.headers['x-bridge-token'] || req.headers['x-internal-secret'] || req.headers['x-bridge-key'];
  if (bridgeToken && bridgeToken === env.INTERNAL_BRIDGE_SECRET) {
    (req as any).isInternalBridge = true;
    req.user = {
      sub: 'bridge-system',
      role: 'SUPER_ADMIN',
      mustResetPassword: false,
    };
    return next();
  }

  let token: string | undefined;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length);
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    throw new AuthenticationError('Missing or malformed Authorization header');
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    req.user = payload;
    next();
  } catch {
    throw new AuthenticationError('Invalid or expired access token');
  }
}

/** Blocks all non-auth routes until the user completes a forced password reset. */
export function blockIfMustResetPassword(req: Request, _res: Response, next: NextFunction) {
  if ((req as any).isInternalBridge) {
    return next();
  }
  if (req.user?.mustResetPassword) {
    throw new AuthenticationError('Password reset required before continuing');
  }
  next();
}
