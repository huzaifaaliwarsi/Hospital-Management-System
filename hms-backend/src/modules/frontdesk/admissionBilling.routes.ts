import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { admissionBillingController as c } from './admissionBilling.controller';
import * as s from './admissionBilling.schemas';

const router = Router();
const view = authorize('frontdesk', 'view');
const create = authorize('frontdesk', 'create');

router.get('/records', view, asyncHandler(c.listRecords));

router.get('/:id/statement', view, validate({ params: s.admissionIdParamsSchema }), asyncHandler(c.getStatement));

router.get('/:id/ledger', view, validate({ params: s.admissionIdParamsSchema }), asyncHandler(c.getLedger));

router.post(
  '/:id/collect-payment',
  create,
  validate({ params: s.admissionIdParamsSchema, body: s.collectAdmissionPaymentSchema }),
  asyncHandler(c.collectPayment),
);

router.post(
  '/:id/generate-final-bill',
  create,
  validate({ params: s.admissionIdParamsSchema }),
  asyncHandler(c.generateFinalBill),
);

export default router;
