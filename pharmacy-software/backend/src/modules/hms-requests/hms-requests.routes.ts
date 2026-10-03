import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { bridgeAuth } from '@/middleware/bridgeAuth';
import { hmsRequestsController as c } from './hms-requests.controller';
import * as s from './hms-requests.schemas';

const router = Router();
const view = authorize('pharmacy', 'view');
const create = authorize('pharmacy', 'create');
const edit = authorize('pharmacy', 'edit');

router.get('/stream/events', c.streamEvents);
router.get('/settings', view, asyncHandler(c.getSettings));
router.put('/settings', edit, validate({ body: s.updateSettingsBodySchema }), asyncHandler(c.updateSettings));

// Inbound Request Dispatch from HMS (authenticated via bridgeAuth or create session)
router.post('/', bridgeAuth, validate({ body: s.createRequestBodySchema }), asyncHandler(c.create));
router.get('/', view, validate({ query: s.listRequestsQuerySchema }), asyncHandler(c.list));
router.get('/:id', view, validate({ params: s.idParamsSchema }), asyncHandler(c.getById));
router.post('/:id/approve', edit, validate({ params: s.idParamsSchema }), asyncHandler(c.approve));
router.post('/:id/reject', create, validate({ params: s.idParamsSchema, body: s.rejectRequestBodySchema }), asyncHandler(c.reject));
router.post('/:id/fulfill', create, validate({ params: s.idParamsSchema, body: s.fulfillRequestBodySchema }), asyncHandler(c.fulfill));

// Inter-Entity Settlement & Webhook Endpoints
router.post('/callback/patient-collected', bridgeAuth, validate({ body: s.patientCollectedCallbackSchema }), asyncHandler(c.patientCollectedCallback));
router.post('/settlements/request', create, validate({ body: s.createSettlementRequestBodySchema }), asyncHandler(c.createSettlementRequest));
router.post('/settlement/release', bridgeAuth, validate({ body: s.releaseSettlementCallbackSchema }), asyncHandler(c.settlementReleaseCallback));
router.get('/receivables/list', view, asyncHandler(c.listReceivables));

export default router;
