import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/shared/logger';

/** Assigns a request ID and logs each request (§7.6 step 3). */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  res.setHeader('X-Request-Id', requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}
