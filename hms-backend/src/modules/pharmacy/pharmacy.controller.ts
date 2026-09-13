import type { Request, Response } from 'express';
import { pharmacyService } from './pharmacy.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type {
  CreateMedicineBody,
  UpdateMedicineBody,
  CreateBatchBody,
  ReceiveBatchStockBody,
  DispenseRetailBody,
} from './pharmacy.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const pharmacyController = {
  createMedicine: async (req: Request, res: Response) => {
    const medicine = await pharmacyService.createMedicine(
      req.body as CreateMedicineBody,
      actorId(req),
    );
    res.status(201).json({ data: medicine });
  },

  updateMedicine: async (req: Request, res: Response) => {
    const updated = await pharmacyService.updateMedicine(
      req.params.id!,
      req.body as UpdateMedicineBody,
    );
    res.json({ data: updated });
  },

  listMedicines: async (req: Request, res: Response) => {
    const list = await pharmacyService.listMedicines(req.query.search as string | undefined);
    res.json({ data: list });
  },

  createBatch: async (req: Request, res: Response) => {
    const batch = await pharmacyService.createBatch(
      req.params.id!,
      req.body as CreateBatchBody,
      actorId(req),
    );
    res.status(201).json({ data: batch });
  },

  receiveBatchStock: async (req: Request, res: Response) => {
    const body = req.body as ReceiveBatchStockBody;
    const entry = await pharmacyService.receiveBatchStock(
      req.params.id!,
      req.params.batchId!,
      body.quantity,
      actorId(req),
      body.referenceInvoice,
    );
    res.status(201).json({ data: entry });
  },

  getMedicineBatches: async (req: Request, res: Response) => {
    const batches = await pharmacyService.getMedicineBatches(req.params.id!);
    res.json({ data: batches });
  },

  dispenseRetail: async (req: Request, res: Response) => {
    const dispense = await pharmacyService.dispenseRetail(
      req.body as DispenseRetailBody,
      actorId(req),
    );
    res.status(201).json({ data: dispense });
  },
};
