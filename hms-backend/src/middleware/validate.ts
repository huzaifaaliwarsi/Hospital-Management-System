import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Zod schema validation wrapper (§7.7). On success, replaces
 * `req.body`/`query`/`params` with the parsed (and coerced/defaulted)
 * values. On failure, throws `ZodError`, caught by `errorHandler` and
 * mapped to `400 VALIDATION_ERROR` (§8.2).
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query;
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
    next();
  };
}
