import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { asyncHandler } from '@/shared/asyncHandler';
import { dashboardController as c } from './dashboard.controller';

const router = Router();
const view = authorize('dashboard', 'view');

router.get('/management', view, asyncHandler(c.management));
router.get('/sales', view, asyncHandler(c.sales));

export default router;
