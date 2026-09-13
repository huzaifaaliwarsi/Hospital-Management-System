import type { Request, Response } from 'express';
import { cashService } from './cash.service';
import { AuthenticationError } from '@/shared/errors/AppError';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const cashController = {
  getMyBalanceSheet: async (req: Request, res: Response) => {
    const sheet = await cashService.getCashierBalanceSheet(actorId(req));
    res.json({ data: sheet });
  },

  getUserBalanceSheet: async (req: Request, res: Response) => {
    const sheet = await cashService.getCashierBalanceSheet(req.params.userId as string);
    res.json({ data: sheet });
  },
};
