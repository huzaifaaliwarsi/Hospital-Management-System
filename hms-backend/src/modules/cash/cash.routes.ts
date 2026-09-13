import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { asyncHandler } from '@/shared/asyncHandler';
import { cashController as c } from './cash.controller';

const router = Router();
const view = authorize('cash', 'view');

// Cashier's own balance sheet (§8.12)
router.get('/balance-sheet', view, asyncHandler(c.getMyBalanceSheet));
router.get('/balance-sheet/:userId', view, asyncHandler(c.getUserBalanceSheet));

export default router;
