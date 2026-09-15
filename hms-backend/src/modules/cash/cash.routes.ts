import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { cashController as c } from './cash.controller';
import { submitSettlementSchema } from './settlement.schemas';

const router = Router();
const view = authorize('cash', 'view');
const create = authorize('cash', 'create');

// Cashier's own balance sheet (§8.12)
router.get('/balance-sheet', view, asyncHandler(c.getMyBalanceSheet));
router.get('/balance-sheet/:userId', view, asyncHandler(c.getUserBalanceSheet));

// My Account Settlement (§3.3) — closes out every currently-unsettled
// balance-sheet row into one settlement record.
router.get('/settlements', view, asyncHandler(c.listMySettlements));
router.post('/settlements', create, validate({ body: submitSettlementSchema }), asyncHandler(c.submitMySettlement));

export default router;
