import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { panelBillingController as c } from './panelBilling.controller';
import * as s from './panelBilling.schemas';

const router = Router();
const view = authorize('frontdesk', 'view');
const create = authorize('frontdesk', 'create');

router.get(
  '/verify/:panelPatientId',
  view,
  validate({ params: s.panelPatientIdParamsSchema }),
  asyncHandler(c.verifyPanelPatient),
);

router.get(
  '/contract-resolution',
  view,
  validate({ query: s.contractResolutionQuerySchema }),
  asyncHandler(c.resolveContract),
);

router.get(
  '/panels/:corporatePanelId/statement',
  view,
  validate({ params: s.corporatePanelIdParamsSchema, query: s.panelStatementQuerySchema }),
  asyncHandler(c.getStatement),
);

router.get(
  '/panels/:corporatePanelId/ledger',
  view,
  validate({ params: s.corporatePanelIdParamsSchema }),
  asyncHandler(c.getLedger),
);

router.post(
  '/panels/:corporatePanelId/remittances',
  create,
  validate({ params: s.corporatePanelIdParamsSchema, body: s.recordPanelRemittanceSchema }),
  asyncHandler(c.recordRemittance),
);

router.get(
  '/panels/:corporatePanelId/remittances',
  view,
  validate({ params: s.corporatePanelIdParamsSchema }),
  asyncHandler(c.listRemittances),
);

export default router;
