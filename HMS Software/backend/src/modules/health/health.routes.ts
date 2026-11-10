import { Router } from 'express';
import { checkDatabaseConnection } from '@/db/client';

import { pharmacyBridgeClient } from '@/shared/pharmacyBridgeClient';

/** §7.16 — liveness/readiness probes. Public, no auth. */
const router = Router();

router.get('/', async (_req, res) => {
  const bridgeMedicines = await pharmacyBridgeClient.getMedicines().catch((err: any) => ({ error: err.message }));
  res.json({
    data: {
      status: 'ok',
      version: 'bridge-v2',
      bridgeMedicinesCount: Array.isArray(bridgeMedicines) ? bridgeMedicines.length : null,
      bridgeMedicines,
    },
  });
});

router.get('/ready', async (_req, res) => {
  const dbOk = await checkDatabaseConnection();
  res.status(dbOk ? 200 : 503).json({ data: { status: dbOk ? 'ready' : 'not_ready', database: dbOk } });
});

export default router;
