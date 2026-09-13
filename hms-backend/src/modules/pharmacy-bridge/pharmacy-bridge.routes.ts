import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { pharmacyBridgeController as c } from './pharmacy-bridge.controller';
import * as s from './pharmacy-bridge.schemas';

const router = Router();
const view = authorize('pharmacy-bridge', 'view');
const create = authorize('pharmacy-bridge', 'create');

// Inpatient Medicine Requests
router.post(
  '/requests',
  create,
  validate({ body: s.createMedicineRequestSchema }),
  asyncHandler(c.createRequest),
);

router.get(
  '/requests',
  view,
  validate({ query: s.listRequestsQuerySchema }),
  asyncHandler(c.listRequests),
);

router.get(
  '/requests/:id',
  view,
  validate({ params: s.idParamsSchema }),
  asyncHandler(c.getRequestById),
);

router.post(
  '/requests/:id/dispense',
  create,
  validate({ params: s.idParamsSchema }),
  asyncHandler(c.fulfillAndDispense),
);

export default router;
