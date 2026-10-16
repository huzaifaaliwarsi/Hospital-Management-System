import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authRateLimiter } from '@/middleware/rateLimiter';
import { validate } from '@/middleware/validate';
import { authController } from './auth.controller';
import { loginBodySchema, changePasswordBodySchema } from './auth.schemas';
import { asyncHandler } from '@/shared/asyncHandler';

/**
 * Public auth endpoints (§8.3). Mounted at `/api/v1/auth` BEFORE the
 * blanket `authenticate` middleware in app.ts, except `/change-password`
 * and `/me` which require a valid access token.
 */
const router = Router();

router.post('/login', authRateLimiter, validate({ body: loginBodySchema }), asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordBodySchema }),
  asyncHandler(authController.changePassword),
);
router.get('/me', authenticate, asyncHandler(authController.me));

export default router;
