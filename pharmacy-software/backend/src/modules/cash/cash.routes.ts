import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { cashController as c } from './cash.controller';
import * as s from './cash.schemas';

const router = Router();
const view = authorize('cash', 'view');
const create = authorize('cash', 'create');
const edit = authorize('cash', 'edit');

router.post('/petty-cash', edit, validate({ body: s.issuePettyCashBodySchema }), asyncHandler(c.issuePettyCash));
router.get('/balance-sheet', view, validate({ query: s.balanceSheetQuerySchema }), asyncHandler(c.myBalanceSheet));
router.post('/settlements', create, validate({ body: s.submitSettlementBodySchema }), asyncHandler(c.submitSettlement));
router.get('/settlements', view, validate({ query: s.listSettlementsQuerySchema }), asyncHandler(c.listSettlements));
router.post('/settlements/:id/review', edit, validate({ params: s.idParamsSchema, body: s.reviewSettlementBodySchema }), asyncHandler(c.reviewSettlement));

export default router;
