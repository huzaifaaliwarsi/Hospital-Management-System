import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger';
import { env } from '@/config/env';

/**
 * Single error → HTTP response translator (§7.6 step 10, §8.2 error format).
 * Must be registered LAST, after all routes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = res.getHeader('X-Request-Id') as string | undefined;

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          issue: issue.message,
        })),
        requestId,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { code: err.code, requestId, stack: err.stack });
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
    return;
  }

  const error = err as Error;
  logger.error('Unhandled error', {
    message: error?.message,
    stack: error?.stack,
    requestId,
    path: req.originalUrl,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : error?.message,
      requestId,
    },
  });
}

/** Catches unmatched routes and forwards a 404 through the same error envelope. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      requestId: res.getHeader('X-Request-Id'),
    },
  });
}
