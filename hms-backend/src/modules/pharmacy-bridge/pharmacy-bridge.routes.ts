import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { bridgeAuth } from '@/middleware/bridgeAuth';
import { pharmacyBridgeController as c } from './pharmacy-bridge.controller';
import * as s from './pharmacy-bridge.schemas';

const router = Router();
const view = authorize('pharmacy-bridge', 'view');
const create = authorize('pharmacy-bridge', 'create');
const edit = authorize('pharmacy-bridge', 'edit');

// Inpatient Medicine Requests
router.post(
  '/requests',
  create,
  validate({ body: s.createMedicineRequestSchema }),
  asyncHandler(c.createRequest),
);

router.get(
  '/requests',
  view,
  validate({ query: s.listRequestsQuerySchema }),
  asyncHandler(c.listRequests),
);

router.get(
  '/requests/:id',
  view,
  validate({ params: s.idParamsSchema }),
  asyncHandler(c.getRequestById),
);

router.post(
  '/requests/:id/dispense',
  create,
  validate({ params: s.idParamsSchema }),
  asyncHandler(c.fulfillAndDispense),
);

// ── Webhook Callback from Standalone Pharmacy ──────────────────────────────
router.post(
  '/callback/dispensed',
  bridgeAuth,
  validate({ body: s.dispensedCallbackSchema }),
  asyncHandler(c.handleDispensedCallback),
);

// ── Inter-Entity Institutional Settlement Routes ───────────────────────────
router.post(
  '/settlement/request',
  bridgeAuth,
  validate({ body: s.settlementRequestSchema }),
  asyncHandler(c.handleSettlementRequest),
);

router.get(
  '/settlements',
  view,
  asyncHandler(c.listSettlements),
);

router.post(
  '/settlements/:id/release',
  edit,
  validate({ params: s.idParamsSchema, body: s.releaseSettlementSchema }),
  asyncHandler(c.releaseSettlement),
);

router.get(
  '/charges',
  view,
  asyncHandler(c.listCharges),
);

export default router;
