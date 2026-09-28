import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { expensesService as svc } from './expenses.service';
import type { ExpenseBody, VoidExpenseBody, ListExpensesQuery } from './expenses.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const expensesController = {
  list: async (req: Request, res: Response) => {
    res.json({ data: await svc.list(req.query as unknown as ListExpensesQuery) });
  },
  get: async (req: Request, res: Response) => {
    res.json({ data: await svc.get(req.params.id as string) });
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json({ data: await svc.create(req.body as ExpenseBody, actorId(req)) });
  },
  update: async (req: Request, res: Response) => {
    res.json({
      data: await svc.update(req.params.id as string, req.body as ExpenseBody, actorId(req)),
    });
  },
  void: async (req: Request, res: Response) => {
    res.json({
      data: await svc.void(req.params.id as string, req.body as VoidExpenseBody, actorId(req)),
    });
  },
};
