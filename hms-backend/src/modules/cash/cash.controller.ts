import type { Request, Response } from 'express';
import { cashService } from './cash.service';
import { settlementService } from './settlement.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { SubmitSettlementBody } from './settlement.schemas';

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

  submitMySettlement: async (req: Request, res: Response) => {
    const settlement = await settlementService.submitSettlement(actorId(req), req.body as SubmitSettlementBody);
    res.status(201).json({ data: settlement });
  },

  listMySettlements: async (req: Request, res: Response) => {
    const settlements = await settlementService.listMySettlements(actorId(req));
    res.json({ data: settlements });
  },
};
