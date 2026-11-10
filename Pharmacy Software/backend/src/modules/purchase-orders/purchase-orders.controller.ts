import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { purchaseOrdersService } from './purchase-orders.service';
import type { CreatePurchaseOrderBody, ListPurchaseOrdersQuery } from './purchase-orders.schemas';

export const purchaseOrdersController = {
  async nextCode(_req: Request, res: Response) {
    const code = await purchaseOrdersService.peekNextOrderCode();
    res.json({ data: { code } });
  },
  async list(req: Request, res: Response) {
    const data = await purchaseOrdersService.list(req.query as unknown as ListPurchaseOrdersQuery);
    res.json({ data });
  },
  async getById(req: Request, res: Response) {
    const data = await purchaseOrdersService.getById(req.params.id as string);
    res.json({ data });
  },
  async create(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await purchaseOrdersService.create(req.body as CreatePurchaseOrderBody, req.user.sub);
    res.status(201).json({ data });
  },
  async cancel(req: Request, res: Response) {
    const data = await purchaseOrdersService.cancel(req.params.id as string);
    res.json({ data });
  },
  async markConverted(req: Request, res: Response) {
    const data = await purchaseOrdersService.markConverted(req.params.id as string);
    res.json({ data });
  },
};
