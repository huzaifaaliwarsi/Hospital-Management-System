import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { vendorsService } from './vendors.service';
import type { CreateVendorBody, UpdateVendorBody, PayVendorBody, CreatePurchaseBody, PurchaseReturnBody } from './vendors.schemas';

export const vendorsController = {
  async nextCode(_req: Request, res: Response) {
    const code = await vendorsService.peekNextVendorCode();
    res.json({ data: { code } });
  },
  async create(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await vendorsService.create(req.body as CreateVendorBody, req.user.sub);
    res.status(201).json({ data });
  },
  async update(req: Request, res: Response) {
    const data = await vendorsService.update(req.params.id as string, req.body as UpdateVendorBody);
    res.json({ data });
  },
  async list(req: Request, res: Response) {
    const data = await vendorsService.list(req.query.search as string | undefined);
    res.json({ data });
  },
  async getLedger(req: Request, res: Response) {
    const data = await vendorsService.getLedger(req.params.id as string);
    res.json({ data });
  },
  async createPurchase(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await vendorsService.createPurchase(req.body as CreatePurchaseBody, req.user.sub);
    res.status(201).json({ data });
  },
  async postPurchase(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await vendorsService.postPurchase(req.params.id as string, req.user.sub);
    res.json({ data });
  },
  async payVendor(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await vendorsService.payVendor(req.params.id as string, req.body as PayVendorBody, req.user.sub);
    res.status(201).json({ data });
  },
  async purchaseReturn(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await vendorsService.purchaseReturn(req.body as PurchaseReturnBody, req.user.sub);
    res.status(201).json({ data });
  },
};
