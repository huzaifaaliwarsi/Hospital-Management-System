import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { expensesController as c } from './expenses.controller';
import {
  expenseBodySchema,
  voidExpenseBodySchema,
  expenseIdParamsSchema,
  listExpensesQuerySchema,
} from './expenses.schemas';

/**
 * Expense Management — only SUPER_ADMIN and ADMIN hold the `expenses`
 * module (see `authorize.ts`); every other role gets 403.
 */
const router = Router();
const view = authorize('expenses', 'view');

router.get('/', view, validate({ query: listExpensesQuerySchema }), asyncHandler(c.list));
router.get('/:id', view, validate({ params: expenseIdParamsSchema }), asyncHandler(c.get));
router.post(
  '/',
  authorize('expenses', 'create'),
  validate({ body: expenseBodySchema }),
  asyncHandler(c.create),
);
router.put(
  '/:id',
  authorize('expenses', 'edit'),
  validate({ params: expenseIdParamsSchema, body: expenseBodySchema }),
  asyncHandler(c.update),
);
router.post(
  '/:id/void',
  authorize('expenses', 'void'),
  validate({ params: expenseIdParamsSchema, body: voidExpenseBodySchema }),
  asyncHandler(c.void),
);

export default router;
