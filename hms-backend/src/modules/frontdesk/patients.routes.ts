import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { patientsController as c } from './patients.controller';
import * as s from './patients.schemas';

/** §4.6, §8.7 — mounted at `/api/v1/patients`. */
const router = Router();
const view = authorize('frontdesk', 'view');
const create = authorize('frontdesk', 'create');
const write = authorize('frontdesk', 'edit');

router.get('/check-duplicate', view, validate({ query: s.checkDuplicateQuerySchema }), asyncHandler(c.checkDuplicate));

router.get('/panel', view, validate({ query: s.listPanelPatientsQuerySchema }), asyncHandler(c.listPanelPatients));
router.post('/panel', create, validate({ body: s.createPanelPatientSchema }), asyncHandler(c.createPanelPatient));
router.patch('/panel/:id', write, validate({ params: s.idParamsSchema, body: s.updatePanelPatientSchema }), asyncHandler(c.updatePanelPatient));

router.get('/encounters', view, asyncHandler(c.listSelfPayEncounters));
router.post('/encounters', create, validate({ body: s.createSelfPayEncounterSchema }), asyncHandler(c.createSelfPayEncounter));

export default router;
