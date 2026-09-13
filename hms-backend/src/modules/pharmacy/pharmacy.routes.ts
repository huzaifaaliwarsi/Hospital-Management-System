import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { pharmacyController as c } from './pharmacy.controller';
import * as s from './pharmacy.schemas';

const router = Router();
const view = authorize('pharmacy', 'view');
const create = authorize('pharmacy', 'create');
const edit = authorize('pharmacy', 'edit');

// Medicine Master
router.post(
  '/medicines',
  create,
  validate({ body: s.createMedicineSchema }),
  asyncHandler(c.createMedicine),
);

router.get(
  '/medicines',
  view,
  asyncHandler(c.listMedicines),
);

router.patch(
  '/medicines/:id',
  edit,
  validate({ params: s.idParamsSchema, body: s.updateMedicineSchema }),
  asyncHandler(c.updateMedicine),
);

// Batches & Stock Receipt
router.post(
  '/medicines/:id/batches',
  create,
  validate({ params: s.idParamsSchema, body: s.createBatchSchema }),
  asyncHandler(c.createBatch),
);

router.post(
  '/medicines/:id/batches/:batchId/receipt',
  create,
  validate({ params: s.batchIdParamsSchema, body: s.receiveBatchStockSchema }),
  asyncHandler(c.receiveBatchStock),
);

router.get(
  '/medicines/:id/batches',
  view,
  validate({ params: s.idParamsSchema }),
  asyncHandler(c.getMedicineBatches),
);

// Retail Dispensing (FEFO)
router.post(
  '/dispense',
  create,
  validate({ body: s.dispenseRetailSchema }),
  asyncHandler(c.dispenseRetail),
);

export default router;
