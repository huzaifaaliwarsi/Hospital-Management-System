import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { inventoryController as c } from './inventory.controller';
import * as s from './inventory.schemas';

const router = Router();
const view = authorize('inventory', 'view');
const create = authorize('inventory', 'create');
const edit = authorize('inventory', 'edit');

// Suppliers
router.post(
  '/suppliers',
  create,
  validate({ body: s.createSupplierSchema }),
  asyncHandler(c.createSupplier),
);

router.get(
  '/suppliers',
  view,
  asyncHandler(c.listSuppliers),
);

router.patch(
  '/suppliers/:id',
  edit,
  validate({ params: s.idParamsSchema, body: s.updateSupplierSchema }),
  asyncHandler(c.updateSupplier),
);

router.get(
  '/suppliers/:id/ledger',
  view,
  validate({ params: s.idParamsSchema }),
  asyncHandler(c.getSupplierLedger),
);

// Stock Items
router.post(
  '/items',
  create,
  validate({ body: s.createStockItemSchema }),
  asyncHandler(c.createStockItem),
);

router.get(
  '/items',
  view,
  asyncHandler(c.listStockItems),
);

router.patch(
  '/items/:id',
  edit,
  validate({ params: s.idParamsSchema, body: s.updateStockItemSchema }),
  asyncHandler(c.updateStockItem),
);

router.get(
  '/items/:id/ledger',
  view,
  validate({ params: s.idParamsSchema }),
  asyncHandler(c.getItemLedger),
);

// Fund Requests (Petty Cash for inventory)
router.post(
  '/fund-requests',
  create,
  validate({ body: s.createFundRequestSchema }),
  asyncHandler(c.approveFundRequest),
);

// Purchases (Goods receipt & vendor credit/cash payment)
router.post(
  '/purchases',
  create,
  validate({ body: s.createPurchaseSchema }),
  asyncHandler(c.createPurchase),
);

// Department Requisitions & Stock Issues
router.post(
  '/department-issues',
  create,
  validate({ body: s.createDepartmentIssueSchema }),
  asyncHandler(c.issueToDepartment),
);

export default router;
