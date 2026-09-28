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
  CreateDepartmentReturnBody,
  CreateSupplierReturnBody,
  CreateAdjustmentBody,
  CreateFundRequestBody,
  CreateInventoryExpenseBody,
  PaySupplierBody,
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

  deleteSupplier: async (req: Request, res: Response) => {
    const result = await inventoryService.deleteSupplier(req.params.id!);
    res.json({ data: result });
  },

  paySupplier: async (req: Request, res: Response) => {
    const entry = await inventoryService.paySupplier(req.params.id!, req.body as PaySupplierBody, actorId(req));
    res.status(201).json({ data: entry });
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

  deleteStockItem: async (req: Request, res: Response) => {
    const result = await inventoryService.deleteStockItem(req.params.id!);
    res.json({ data: result });
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
    const body = req.body as CreateFundRequestBody;
    const recipientId = body.recipientUserId ?? actorId(req);
    const balance = await inventoryService.approveFundRequest(recipientId, body.amount, body.reason, actorId(req));
    res.status(201).json({ data: balance });
  },

  listPettyCash: async (req: Request, res: Response) => {
    const rows = await inventoryService.listPettyCash(actorId(req));
    res.json({ data: rows });
  },

  createInventoryExpense: async (req: Request, res: Response) => {
    const expense = await inventoryService.createInventoryExpense(
      req.body as CreateInventoryExpenseBody,
      actorId(req),
    );
    res.status(201).json({ data: expense });
  },

  listInventoryExpenses: async (req: Request, res: Response) => {
    const rows = await inventoryService.listInventoryExpenses(actorId(req));
    res.json({ data: rows });
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

  receiveDepartmentReturn: async (req: Request, res: Response) => {
    const requisition = await inventoryService.receiveDepartmentReturn(
      req.body as CreateDepartmentReturnBody,
      actorId(req),
    );
    res.status(201).json({ data: requisition });
  },

  returnToSupplier: async (req: Request, res: Response) => {
    const result = await inventoryService.returnToSupplier(
      req.body as CreateSupplierReturnBody,
      actorId(req),
    );
    res.status(201).json({ data: result });
  },

  createAdjustment: async (req: Request, res: Response) => {
    const adjustment = await inventoryService.createAdjustment(
      req.body as CreateAdjustmentBody,
      actorId(req),
    );
    res.status(201).json({ data: adjustment });
  },

  listAdjustments: async (_req: Request, res: Response) => {
    const rows = await inventoryService.listAdjustments();
    res.json({ data: rows });
  },
};
