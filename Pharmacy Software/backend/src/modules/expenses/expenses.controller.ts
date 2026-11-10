import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { expensesService } from './expenses.service';
import type { CreateExpenseBody, ListExpensesQuery } from './expenses.schemas';

export const expensesController = {
  async create(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await expensesService.create(req.body as CreateExpenseBody, req.user.sub);
    res.status(201).json({ data });
  },
  async list(req: Request, res: Response) {
    const data = await expensesService.list(req.query as unknown as ListExpensesQuery);
    res.json({ data });
  },
  async approve(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await expensesService.approve(req.params.id as string, req.user.sub);
    res.json({ data });
  },
};
