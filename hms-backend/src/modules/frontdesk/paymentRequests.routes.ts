import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { paymentRequestsController as c } from './paymentRequests.controller';
import * as s from './paymentRequests.schemas';

const router = Router();
const view = authorize('frontdesk', 'view');
const create = authorize('frontdesk', 'create');

router.get(
  '/',
  view,
  validate({ query: s.listPaymentRequestsQuerySchema }),
  asyncHandler(c.listPaymentRequests),
);

router.post(
  '/:id/collect',
  create,
  validate({ params: s.paymentRequestIdParamsSchema, body: s.collectPaymentRequestSchema }),
  asyncHandler(c.collectPaymentRequest),
);

export default router;
