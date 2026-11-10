import type { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async controller method so a rejected promise is forwarded to
 * `next()` (and therefore to `errorHandler`) instead of becoming an
 * unhandled rejection. Express 4 does not do this automatically.
 */
export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
