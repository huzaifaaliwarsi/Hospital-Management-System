import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { usersController as c } from './users.controller';
import { createUserBodySchema, updateUserStatusBodySchema, resetPasswordBodySchema, userIdParamsSchema } from './users.schemas';

const router = Router();
const view = authorize('identity', 'view');
const create = authorize('identity', 'create');
const edit = authorize('identity', 'edit');

router.get('/', view, asyncHandler(c.list));
router.post('/', create, validate({ body: createUserBodySchema }), asyncHandler(c.create));
router.post('/:id/status', edit, validate({ params: userIdParamsSchema, body: updateUserStatusBodySchema }), asyncHandler(c.updateStatus));
router.post('/:id/reset-password', edit, validate({ params: userIdParamsSchema, body: resetPasswordBodySchema }), asyncHandler(c.resetPassword));

export default router;
