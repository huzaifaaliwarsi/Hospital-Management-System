import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { pharmacyService } from './pharmacy.service';
import type {
  CreateMedicineBody,
  UpdateMedicineBody,
  ListMedicinesQuery,
  CreateBatchBody,
  OpeningStockBody,
  DispenseRetailBody,
  AddPaymentBody,
  ListInvoicesQuery,
  StockAdjustmentBody,
  StockMovementsQuery,
  SalesReturnBody,
} from './pharmacy.schemas';

export const pharmacyController = {
  async createMedicine(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await pharmacyService.createMedicine(req.body as CreateMedicineBody, req.user.sub);
    res.status(201).json({ data });
  },
  async updateMedicine(req: Request, res: Response) {
    const data = await pharmacyService.updateMedicine(req.params.id as string, req.body as UpdateMedicineBody);
    res.json({ data });
  },
  async listMedicines(req: Request, res: Response) {
    const data = await pharmacyService.listMedicines(req.query as unknown as ListMedicinesQuery);
    res.json({ data });
  },
  async createBatch(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await pharmacyService.createBatch(req.params.id as string, req.body as CreateBatchBody, req.user.sub);
    res.status(201).json({ data });
  },
  async getMedicineBatches(req: Request, res: Response) {
    const data = await pharmacyService.getMedicineBatches(req.params.id as string);
    res.json({ data });
  },
  async receiveOpeningStock(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await pharmacyService.receiveOpeningStock(req.params.id as string, (req.params.batchId as string) ?? null, req.body as OpeningStockBody, req.user.sub);
    res.status(201).json({ data });
  },
  async stockMovements(req: Request, res: Response) {
    const data = await pharmacyService.stockMovements(req.query as unknown as StockMovementsQuery);
    res.json({ data });
  },
  async createStockAdjustment(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await pharmacyService.createStockAdjustment(req.body as StockAdjustmentBody, req.user.sub);
    res.status(201).json({ data });
  },
  async dispenseRetail(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await pharmacyService.dispenseRetail(req.body as DispenseRetailBody, req.user.sub);
    res.status(201).json({ data });
  },
  async addPayment(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await pharmacyService.addPayment(req.params.id as string, req.body as AddPaymentBody, req.user.sub);
    res.json({ data });
  },
  async listInvoices(req: Request, res: Response) {
    const data = await pharmacyService.listInvoices(req.query as unknown as ListInvoicesQuery);
    res.json({ data });
  },
  async salesReturn(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await pharmacyService.salesReturn(req.body as SalesReturnBody, req.user.sub);
    res.status(201).json({ data });
  },
  async getInvoiceById(req: Request, res: Response) {
    const data = await pharmacyService.getInvoiceById(req.params.id as string);
    res.json({ data });
  },
};
