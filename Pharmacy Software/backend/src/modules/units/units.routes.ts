import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { bridgeAuth } from '@/middleware/bridgeAuth';
import { unitsController as c } from './units.controller';
import * as s from './units.schemas';

const router = Router();
// Every role can view (POS/Purchase forms all need the unit list); only Admin/Super Admin manage the catalog.
const view = authorize('units', 'view');
const edit = authorize('units', 'edit');

const viewOrBridge = (req: any, res: any, next: any) => {
  if (req.headers['x-bridge-token'] || req.headers['x-internal-secret']) {
    return bridgeAuth(req, res, next);
  }
  return view(req, res, next);
};

router.get('/', viewOrBridge, validate({ query: s.listUnitsQuerySchema }), asyncHandler(c.list));
router.post('/', edit, validate({ body: s.createUnitBodySchema }), asyncHandler(c.create));
router.patch('/:id', edit, validate({ params: s.idParamsSchema, body: s.updateUnitBodySchema }), asyncHandler(c.update));

export default router;
