import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { admissionBillingController as c } from './admissionBilling.controller';
import * as s from './admissionBilling.schemas';

const router = Router();
const view = authorize('frontdesk', 'view');
const create = authorize('frontdesk', 'create');

router.get('/:id/statement', view, validate({ params: s.admissionIdParamsSchema }), asyncHandler(c.getStatement));

router.post(
  '/:id/collect-payment',
  create,
  validate({ params: s.admissionIdParamsSchema, body: s.collectAdmissionPaymentSchema }),
  asyncHandler(c.collectPayment),
);

export default router;
