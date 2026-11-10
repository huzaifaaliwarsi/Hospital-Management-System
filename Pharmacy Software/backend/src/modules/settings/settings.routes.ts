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

// Markup Rules (purchase-costing-plan) — view for the Purchase form's live price suggestion, edit for Admin/Super Admin only.
router.get('/markup-rules', view, asyncHandler(c.listMarkupRules));
router.put('/markup-rules', edit, validate({ body: s.upsertMarkupRuleBodySchema }), asyncHandler(c.upsertMarkupRule));
router.delete('/markup-rules/:category', edit, validate({ params: s.categoryParamsSchema }), asyncHandler(c.deleteMarkupRule));

// Medicine Categories (Add-Medicine-form fix) — view for the Add/Edit Medicine dropdown, edit to manage from Settings.
router.get('/medicine-categories', view, asyncHandler(c.listMedicineCategories));
router.post('/medicine-categories', edit, validate({ body: s.createMedicineCategoryBodySchema }), asyncHandler(c.createMedicineCategory));
router.patch('/medicine-categories/:id', edit, validate({ params: s.medicineCategoryIdParamsSchema, body: s.updateMedicineCategoryBodySchema }), asyncHandler(c.updateMedicineCategory));

// Testing Data Reset (Admin / Super Admin only)
router.post('/reset-data', edit, validate({ body: s.resetDataBodySchema }), asyncHandler(c.resetData));

export default router;
