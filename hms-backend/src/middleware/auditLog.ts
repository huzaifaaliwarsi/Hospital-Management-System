import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@/db/client';
import { logger } from '@/shared/logger';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Writes `audit_logs` for mutating requests (§7.6 step 9, §7.14). Registered
 * as response-finish middleware so it captures the actual outcome/status
 * code, not just the intent. Satisfies the "actual user attribution"
 * requirement even where no dedicated Audit Log UI page exists (D17 p.2).
 */
export function auditLog(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  res.on('finish', () => {
    void prisma.auditLog
      .create({
        data: {
          actorId: req.user?.sub,
          action: `${req.method} ${req.route?.path ?? req.path}`,
          entityType: req.baseUrl.replace('/api/v1/', '') || 'unknown',
          entityId: req.params?.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          requestId: res.getHeader('X-Request-Id') as string | undefined,
        },
      })
      .catch((error) => {
        // Audit logging must never break the primary request/response cycle.
        logger.error('Failed to write audit log', { error: (error as Error).message });
      });
  });

  next();
}
