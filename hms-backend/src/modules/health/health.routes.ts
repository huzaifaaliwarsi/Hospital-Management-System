import { Router } from 'express';
import { checkDatabaseConnection } from '@/db/client';

/** §7.16 — liveness/readiness probes. Public, no auth. */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ data: { status: 'ok' } });
});

router.get('/ready', async (_req, res) => {
  const dbOk = await checkDatabaseConnection();
  res.status(dbOk ? 200 : 503).json({ data: { status: dbOk ? 'ready' : 'not_ready', database: dbOk } });
});

export default router;
