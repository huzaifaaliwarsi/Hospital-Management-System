import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { dashboardController } from './dashboard.controller';
import { getSuperAdminDashboardQuerySchema } from './dashboard.schemas';

const router = Router();
const view = authorize('reports', 'view');

// Super Admin executive overview dashboard aggregation
router.get(
  '/dashboard/super-admin',
  view,
  validate({ query: getSuperAdminDashboardQuerySchema }),
  asyncHandler(dashboardController.getSuperAdminDashboard),
);

router.get('/_scaffold', (_req, res) => {
  res.json({ data: { module: 'reports', status: 'scaffolded' } });
});

export default router;

