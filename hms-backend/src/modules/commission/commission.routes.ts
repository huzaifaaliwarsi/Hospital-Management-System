import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { commissionController as c } from './commission.controller';
import * as s from './commission.schemas';
import { commissionRunService } from './commissionRun.service';

const router = Router();
const view = authorize('commission', 'view');
const create = authorize('commission', 'create');
const approve = authorize('commission', 'approve');

router.post('/preview', view, validate({ body: s.commissionRunFiltersSchema }), asyncHandler(async (req, res) => {
  res.json({ data: await commissionRunService.preview(req.body) });
}));
router.post('/runs', create, validate({ body: s.commissionRunFiltersSchema }), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await commissionRunService.generate(req.body, req.user!.sub) });
}));
router.get('/runs', view, asyncHandler(async (_req, res) => { res.json({ data: await commissionRunService.list() }); }));
router.get('/runs/:id', view, validate({ params: s.accrualIdParamsSchema }), asyncHandler(async (req, res) => {
  res.json({ data: await commissionRunService.get(req.params.id as string) });
}));
router.post('/runs/:id/approve', approve, validate({ params: s.accrualIdParamsSchema }), asyncHandler(async (req, res) => {
  res.json({ data: await commissionRunService.approve(req.params.id as string, req.user!.sub) });
}));
router.post('/accruals/:id/adjustments', approve, validate({ params: s.accrualIdParamsSchema, body: s.financialAdjustmentSchema }), asyncHandler(c.adjustAccrual));

router.get(
  '/rules',
  view,
  validate({ query: s.listCommissionRulesQuerySchema }),
  asyncHandler(c.listRules),
);

router.post(
  '/rules',
  create,
  validate({ body: s.createCommissionRuleSchema }),
  asyncHandler(c.createRule),
);

router.get(
  '/accruals',
  view,
  validate({ query: s.listAccrualsQuerySchema }),
  asyncHandler(c.listAccruals),
);

router.post(
  '/accruals/:id/approve',
  approve,
  validate({ params: s.accrualIdParamsSchema }),
  asyncHandler(c.approveAccrual),
);

router.post(
  '/accruals/:id/pay',
  create,
  validate({ params: s.accrualIdParamsSchema, body: s.payAccrualBodySchema }),
  asyncHandler(c.payAccrual),
);

export default router;
