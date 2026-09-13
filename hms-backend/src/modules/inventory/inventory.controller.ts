import type { Request, Response } from 'express';
import { inventoryService } from './inventory.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type {
  CreateSupplierBody,
  UpdateSupplierBody,
  CreateStockItemBody,
  UpdateStockItemBody,
  CreatePurchaseBody,
  CreateDepartmentIssueBody,
  CreateFundRequestBody,
} from './inventory.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const inventoryController = {
  createSupplier: async (req: Request, res: Response) => {
    const supplier = await inventoryService.createSupplier(
      req.body as CreateSupplierBody,
      actorId(req),
    );
    res.status(201).json({ data: supplier });
  },

  updateSupplier: async (req: Request, res: Response) => {
    const updated = await inventoryService.updateSupplier(
      req.params.id!,
      req.body as UpdateSupplierBody,
    );
    res.json({ data: updated });
  },

  listSuppliers: async (req: Request, res: Response) => {
    const suppliers = await inventoryService.listSuppliers(req.query.search as string | undefined);
    res.json({ data: suppliers });
  },

  getSupplierLedger: async (req: Request, res: Response) => {
    const ledger = await inventoryService.getSupplierLedger(req.params.id!);
    res.json({ data: ledger });
  },

  createStockItem: async (req: Request, res: Response) => {
    const item = await inventoryService.createStockItem(
      req.body as CreateStockItemBody,
      actorId(req),
    );
    res.status(201).json({ data: item });
  },

  updateStockItem: async (req: Request, res: Response) => {
    const updated = await inventoryService.updateStockItem(
      req.params.id!,
      req.body as UpdateStockItemBody,
    );
    res.json({ data: updated });
  },

  listStockItems: async (req: Request, res: Response) => {
    const items = await inventoryService.listStockItems(req.query.search as string | undefined);
    res.json({ data: items });
  },

  getItemLedger: async (req: Request, res: Response) => {
    const ledger = await inventoryService.getItemLedger(req.params.id!);
    res.json({ data: ledger });
  },

  approveFundRequest: async (req: Request, res: Response) => {
    const body = req.body as CreateFundRequestBody & { recipientUserId?: string };
    const recipientId = body.recipientUserId ?? actorId(req);
    const balance = await inventoryService.approveFundRequest(recipientId, body.amount);
    res.status(201).json({ data: balance });
  },

  createPurchase: async (req: Request, res: Response) => {
    const po = await inventoryService.createPurchase(
      req.body as CreatePurchaseBody,
      actorId(req),
    );
    res.status(201).json({ data: po });
  },

  issueToDepartment: async (req: Request, res: Response) => {
    const requisition = await inventoryService.issueToDepartment(
      req.body as CreateDepartmentIssueBody,
      actorId(req),
    );
    res.status(201).json({ data: requisition });
  },
};
