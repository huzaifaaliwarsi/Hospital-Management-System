import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { expensesController as c } from './expenses.controller';
import * as s from './expenses.schemas';

const router = Router();
const view = authorize('expenses', 'view');
const create = authorize('expenses', 'create');
const edit = authorize('expenses', 'edit');

router.post('/', create, validate({ body: s.createExpenseBodySchema }), asyncHandler(c.create));
router.get('/', view, validate({ query: s.listExpensesQuerySchema }), asyncHandler(c.list));
router.post('/:id/approve', edit, validate({ params: s.idParamsSchema }), asyncHandler(c.approve));

export default router;
