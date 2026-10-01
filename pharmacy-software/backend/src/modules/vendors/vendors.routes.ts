import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { vendorsController as c } from './vendors.controller';
import * as s from './vendors.schemas';

const router = Router();
const view = authorize('vendors', 'view');
const create = authorize('vendors', 'create');
const edit = authorize('vendors', 'edit');

router.post('/', create, validate({ body: s.createVendorBodySchema }), asyncHandler(c.create));
router.get('/', view, asyncHandler(c.list));
router.get('/next-code', create, asyncHandler(c.nextCode));
router.patch('/:id', edit, validate({ params: s.idParamsSchema, body: s.updateVendorBodySchema }), asyncHandler(c.update));
router.get('/:id/ledger', view, validate({ params: s.idParamsSchema }), asyncHandler(c.getLedger));
router.post('/:id/pay', create, validate({ params: s.idParamsSchema, body: s.payVendorBodySchema }), asyncHandler(c.payVendor));
router.post('/purchases', create, validate({ body: s.createPurchaseBodySchema }), asyncHandler(c.createPurchase));
router.post('/purchases/:id/post', edit, validate({ params: s.idParamsSchema }), asyncHandler(c.postPurchase));
router.post('/purchase-returns', create, validate({ body: s.purchaseReturnBodySchema }), asyncHandler(c.purchaseReturn));

export default router;
