import { Router } from 'express';
import { checkDatabaseConnection } from '@/db/client';
import { asyncHandler } from '@/shared/asyncHandler';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const dbOk = await checkDatabaseConnection();
  res.status(dbOk ? 200 : 503).json({ data: { status: dbOk ? 'ok' : 'degraded', database: dbOk } });
}));

export default router;
