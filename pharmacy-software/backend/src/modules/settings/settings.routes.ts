import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { settingsController as c } from './settings.controller';
import * as s from './settings.schemas';

const router = Router();
// pharmacy.md §3/§17 — Settings is part of the Management Portal only; Sales
// has no policy at all here (reflected by 'settings' being absent from its POLICY entry).
const view = authorize('settings', 'view');
const edit = authorize('settings', 'edit');

router.get('/', view, asyncHandler(c.get));
router.put('/', edit, validate({ body: s.updatePharmacySettingsBodySchema }), asyncHandler(c.update));

export default router;
