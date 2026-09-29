import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { hmsRequestsController as c } from './hms-requests.controller';
import * as s from './hms-requests.schemas';

const router = Router();
// Reuses the 'pharmacy' policy: Sales has view+create (can log/fulfill
// requests, matching pharmacy.md §4's POS/HMS-fulfillment allowance),
// Admin/Super Admin have full access (approve, settings — edit-only).
const view = authorize('pharmacy', 'view');
const create = authorize('pharmacy', 'create');
const edit = authorize('pharmacy', 'edit');

router.get('/settings', view, asyncHandler(c.getSettings));
router.put('/settings', edit, validate({ body: s.updateSettingsBodySchema }), asyncHandler(c.updateSettings));

router.post('/', create, validate({ body: s.createRequestBodySchema }), asyncHandler(c.create));
router.get('/', view, validate({ query: s.listRequestsQuerySchema }), asyncHandler(c.list));
router.get('/:id', view, validate({ params: s.idParamsSchema }), asyncHandler(c.getById));
router.post('/:id/approve', edit, validate({ params: s.idParamsSchema }), asyncHandler(c.approve));
router.post('/:id/reject', create, validate({ params: s.idParamsSchema, body: s.rejectRequestBodySchema }), asyncHandler(c.reject));
router.post('/:id/fulfill', create, validate({ params: s.idParamsSchema, body: s.fulfillRequestBodySchema }), asyncHandler(c.fulfill));

export default router;
