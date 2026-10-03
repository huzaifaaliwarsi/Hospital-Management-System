import type { NextFunction, Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { env } from '@/config/env';

export function bridgeAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers['x-bridge-token'] || req.headers['x-internal-secret'] || req.headers['x-bridge-key'];
  if (token && token === env.INTERNAL_BRIDGE_SECRET) {
    (req as any).isInternalBridge = true;
    return next();
  }

  if ((req as any).user) {
    return next();
  }

  throw new AuthenticationError('Unauthorized bridge request: invalid or missing internal bridge token');
}
