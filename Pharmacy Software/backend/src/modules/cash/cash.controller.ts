import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { cashService } from './cash.service';
import type { IssuePettyCashBody, BalanceSheetQuery, SubmitSettlementBody, ReviewSettlementBody, ListSettlementsQuery } from './cash.schemas';

export const cashController = {
  async issuePettyCash(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await cashService.issuePettyCash(req.body as IssuePettyCashBody, req.user.sub);
    res.status(201).json({ data });
  },
  /** My Balance Sheet — always the caller's own, never another user's (query userId ignored except for management oversight, kept simple for now: self only). */
  async myBalanceSheet(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await cashService.getBalanceSheet(req.user.sub, req.query as unknown as BalanceSheetQuery);
    res.json({ data });
  },
  async submitSettlement(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await cashService.submitSettlement(req.user.sub, req.body as SubmitSettlementBody);
    res.status(201).json({ data });
  },
  async reviewSettlement(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await cashService.reviewSettlement(req.params.id as string, req.body as ReviewSettlementBody, req.user.sub);
    res.json({ data });
  },
  async listSettlements(req: Request, res: Response) {
    const data = await cashService.listSettlements(req.query as unknown as ListSettlementsQuery);
    res.json({ data });
  },
};
