import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { portalUserController as c } from './portalUser.controller';
import * as s from './portalUser.schemas';

/**
 * Portal (login) account management — mounted standalone at
 * `/api/v1/portal-users` (NOT nested under `/staff`) to avoid colliding
 * with `staff.routes.ts`'s `/:id` pattern. Backs both the "Admin Users"
 * and "Staff Users" Super Admin screens (§3.2, §4.1) — the frontend
 * distinguishes them purely via the `?roles=` filter.
 */
const router = Router();
const view = authorize('identity', 'view');
const create = authorize('identity', 'create');
const write = authorize('identity', 'edit');
const remove = authorize('identity', 'delete');

router.get('/', view, validate({ query: s.listPortalUsersQuerySchema }), asyncHandler(c.list));
router.post('/', create, validate({ body: s.createPortalUserBodySchema }), asyncHandler(c.create));
router.get('/:id', view, validate({ params: s.portalUserIdParamsSchema }), asyncHandler(c.getById));
router.patch(
  '/:id',
  write,
  validate({ params: s.portalUserIdParamsSchema, body: s.updatePortalUserBodySchema }),
  asyncHandler(c.update),
);
router.post(
  '/:id/status',
  write,
  validate({ params: s.portalUserIdParamsSchema, body: s.updatePortalUserStatusBodySchema }),
  asyncHandler(c.updateStatus),
);
router.post(
  '/:id/reset-password',
  write,
  validate({ params: s.portalUserIdParamsSchema, body: s.resetPortalUserPasswordBodySchema }),
  asyncHandler(c.resetPassword),
);
router.delete('/:id', remove, validate({ params: s.portalUserIdParamsSchema }), asyncHandler(c.remove));

export default router;
