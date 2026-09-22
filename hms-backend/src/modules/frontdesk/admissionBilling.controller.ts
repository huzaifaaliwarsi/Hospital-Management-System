import type { Request, Response } from 'express';
import { admissionBillingService } from './admissionBilling.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { CollectAdmissionPaymentBody } from './admissionBilling.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const admissionBillingController = {
  listRecords: async (_req: Request, res: Response) => {
    const records = await admissionBillingService.listAdmissionRecords();
    res.json({ data: records });
  },

  getStatement: async (req: Request, res: Response) => {
    const statement = await admissionBillingService.getStatement(req.params.id as string);
    res.json({ data: statement });
  },

  getLedger: async (req: Request, res: Response) => {
    const ledger = await admissionBillingService.getLedger(req.params.id as string);
    res.json({ data: ledger });
  },

  getReadOnlyLedger: async (req: Request, res: Response) => {
    const ledger = await admissionBillingService.getLedger(req.params.id as string, true);
    res.json({ data: ledger });
  },

  collectPayment: async (req: Request, res: Response) => {
    const result = await admissionBillingService.collectPayment(
      req.params.id as string,
      req.body as CollectAdmissionPaymentBody,
      actorId(req),
    );
    res.status(201).json({ data: result });
  },

  generateFinalBill: async (req: Request, res: Response) => {
    const result = await admissionBillingService.generateFinalBill(req.params.id as string, actorId(req));
    res.status(201).json({ data: result });
  },
};
