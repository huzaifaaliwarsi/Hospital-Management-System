import rateLimit from 'express-rate-limit';
import { env } from '@/config/env';

/** Global limiter. In-memory store — fine for a single-instance deployment. */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } },
});

/** Stricter limiter for `/auth/login` to blunt credential-stuffing. */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again later.' } },
});
