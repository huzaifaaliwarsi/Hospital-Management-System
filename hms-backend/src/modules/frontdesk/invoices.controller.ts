import type { Request, Response } from 'express';
import { invoicesService } from './invoices.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type {
  CreateEncounterBody,
  AddServiceLineBody,
  ApplyDiscountBody,
  CollectPaymentBody,
  RefundPaymentBody,
  ListInvoicesQuery,
} from './invoices.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

function actorRole(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.role;
}

export const invoicesController = {
  createEncounter: async (req: Request, res: Response) => {
    const encounter = await invoicesService.createEncounter(
      req.body as CreateEncounterBody,
      actorId(req),
    );
    res.status(201).json({ data: encounter });
  },

  addServiceLine: async (req: Request, res: Response) => {
    const line = await invoicesService.addServiceLine(
      req.params.id as string,
      req.body as AddServiceLineBody,
      actorId(req),
      actorRole(req),
    );
    res.status(201).json({ data: line });
  },

  applyDiscount: async (req: Request, res: Response) => {
    const updated = await invoicesService.applyDiscount(
      req.params.id as string,
      req.body as ApplyDiscountBody,
      actorId(req),
      actorRole(req),
    );
    res.json({ data: updated });
  },

  collectPayment: async (req: Request, res: Response) => {
    const result = await invoicesService.collectPayment(
      req.params.id as string,
      req.body as CollectPaymentBody,
      actorId(req),
    );
    res.status(201).json({ data: result });
  },

  refundPayment: async (req: Request, res: Response) => {
    const result = await invoicesService.refundPayment(
      req.params.id as string,
      req.body as RefundPaymentBody,
      actorId(req),
    );
    res.json({ data: result });
  },

  getReceipt: async (req: Request, res: Response) => {
    const receipt = await invoicesService.getReceipt(req.params.id as string);
    res.json({ data: receipt });
  },

  listInvoices: async (req: Request, res: Response) => {
    const invoices = await invoicesService.listInvoices(
      req.query as unknown as ListInvoicesQuery,
    );
    res.json({ data: invoices });
  },

  getInvoice: async (req: Request, res: Response) => {
    const invoice = await invoicesService.getInvoice(req.params.id as string);
    res.json({ data: invoice });
  },
};
