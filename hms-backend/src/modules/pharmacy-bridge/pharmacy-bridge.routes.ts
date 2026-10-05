import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { bridgeAuth } from '@/middleware/bridgeAuth';
import { pharmacyBridgeController as c } from './pharmacy-bridge.controller';
import * as s from './pharmacy-bridge.schemas';

const router = Router();
const view = authorize('pharmacy-bridge', 'view');
const edit = authorize('pharmacy-bridge', 'edit');

// Inpatient Medicine Requests — READ ONLY here. Requests are created via
// `/admissions/:id/pharmacy-requests` (admission.service.ts's
// `createPharmacyRequest`), which dispatches to the standalone Pharmacy
// system; dispensing happens there too, and lands back on the admission's
// invoice via the `/callback/dispensed` webhook below. A local
// create-and-dispense pair used to live here as a second path — removed
// (2026-10-05): it dispensed medicine straight out of local stock and
// marked itself PAID without ever touching the HospitalInvoice, so a
// request made through it was free to the patient. Confirmed unused by any
// caller (frontend, scripts, or the Pharmacy backend) before removal.
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

// Manual resync (idempotent) for when `collectPayment`'s automatic webhook
// to Pharmacy silently failed — see `resyncPatientCollected`'s doc comment.
router.post(
  '/charges/:admissionId/resync',
  edit,
  validate({ params: s.admissionIdParamsSchema }),
  asyncHandler(c.resyncPatientCollected),
);

export default router;
