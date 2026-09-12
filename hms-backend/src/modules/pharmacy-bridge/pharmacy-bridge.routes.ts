import { Router } from 'express';

/**
 * pharmacy-bridge module — scaffold only. Business endpoints are implemented in a
 * later phase; see PROJECT_MASTER_SPEC.md §4 (module breakdown) and §8
 * (REST API specification) for the full endpoint inventory this module
 * will eventually carry.
 */
const router = Router();

router.get('/_scaffold', (_req, res) => {
  res.json({ data: { module: 'pharmacy-bridge', status: 'scaffolded' } });
});

export default router;
