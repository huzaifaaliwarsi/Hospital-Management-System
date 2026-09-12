import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { staffController } from './staff.controller';
import {
  createStaffBodySchema,
  updateStaffBodySchema,
  listStaffQuerySchema,
  staffIdParamsSchema,
  deactivateStaffBodySchema,
} from './staff.schemas';

/** §4.1, §8.3 — mounted at `/api/v1/staff`. SUPER_ADMIN / ADMIN only. */
const router = Router();

router.get('/', authorize('identity', 'view'), validate({ query: listStaffQuerySchema }), asyncHandler(staffController.list));
router.post('/', authorize('identity', 'create'), validate({ body: createStaffBodySchema }), asyncHandler(staffController.create));
router.get('/:id', authorize('identity', 'view'), validate({ params: staffIdParamsSchema }), asyncHandler(staffController.getById));
router.get(
  '/:id/360',
  authorize('identity', 'view'),
  validate({ params: staffIdParamsSchema }),
  asyncHandler(staffController.getFullProfile),
);
router.patch(
  '/:id',
  authorize('identity', 'edit'),
  validate({ params: staffIdParamsSchema, body: updateStaffBodySchema }),
  asyncHandler(staffController.update),
);
router.post(
  '/:id/deactivate',
  authorize('identity', 'delete'),
  validate({ params: staffIdParamsSchema, body: deactivateStaffBodySchema }),
  asyncHandler(staffController.deactivate),
);

export default router;
