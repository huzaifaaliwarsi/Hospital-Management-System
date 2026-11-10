import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { reportsController as c } from './reports.controller';
import { reportQuerySchema } from './reports.schemas';

const router = Router();

router.get('/', authorize('reports', 'view'), validate({ query: reportQuerySchema }), asyncHandler(c.run));

export default router;
