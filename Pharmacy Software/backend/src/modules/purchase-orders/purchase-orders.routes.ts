import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { purchaseOrdersController as c } from './purchase-orders.controller';
import * as s from './purchase-orders.schemas';

const router = Router();
const view = authorize('purchaseOrders', 'view');
const create = authorize('purchaseOrders', 'create');
const edit = authorize('purchaseOrders', 'edit');

router.get('/next-code', create, asyncHandler(c.nextCode));
router.get('/', view, validate({ query: s.listPurchaseOrdersQuerySchema }), asyncHandler(c.list));
router.get('/:id', view, validate({ params: s.idParamsSchema }), asyncHandler(c.getById));
router.post('/', create, validate({ body: s.createPurchaseOrderBodySchema }), asyncHandler(c.create));
router.post('/:id/cancel', edit, validate({ params: s.idParamsSchema }), asyncHandler(c.cancel));
router.post('/:id/mark-converted', edit, validate({ params: s.idParamsSchema }), asyncHandler(c.markConverted));

export default router;
