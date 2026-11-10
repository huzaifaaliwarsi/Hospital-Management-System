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
const del = authorize('inventory', 'delete');

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

router.delete(
  '/suppliers/:id',
  del,
  validate({ params: s.idParamsSchema }),
  asyncHandler(c.deleteSupplier),
);

router.get(
  '/suppliers/:id/ledger',
  view,
  validate({ params: s.idParamsSchema }),
  asyncHandler(c.getSupplierLedger),
);

router.post(
  '/suppliers/:id/payments',
  create,
  validate({ params: s.idParamsSchema, body: s.paySupplierSchema }),
  asyncHandler(c.paySupplier),
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

router.delete(
  '/items/:id',
  del,
  validate({ params: s.idParamsSchema }),
  asyncHandler(c.deleteStockItem),
);

router.get(
  '/items/:id/ledger',
  view,
  validate({ params: s.idParamsSchema }),
  asyncHandler(c.getItemLedger),
);

// Fund Requests / Petty Cash Received (inventory)
router.post(
  '/fund-requests',
  create,
  validate({ body: s.createFundRequestSchema }),
  asyncHandler(c.approveFundRequest),
);

router.get(
  '/petty-cash',
  view,
  asyncHandler(c.listPettyCash),
);

// Inventory Expenses
router.post(
  '/expenses',
  create,
  validate({ body: s.createInventoryExpenseSchema }),
  asyncHandler(c.createInventoryExpense),
);

router.get(
  '/expenses',
  view,
  asyncHandler(c.listInventoryExpenses),
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

router.post(
  '/department-returns',
  create,
  validate({ body: s.createDepartmentReturnSchema }),
  asyncHandler(c.receiveDepartmentReturn),
);

// Supplier Returns
router.post(
  '/supplier-returns',
  create,
  validate({ body: s.createSupplierReturnSchema }),
  asyncHandler(c.returnToSupplier),
);

// Adjustments (Damage/Expiry/Count Correction/Loss/Surplus/Quarantine)
router.post(
  '/adjustments',
  create,
  validate({ body: s.createAdjustmentSchema }),
  asyncHandler(c.createAdjustment),
);

router.get(
  '/adjustments',
  view,
  asyncHandler(c.listAdjustments),
);

export default router;
