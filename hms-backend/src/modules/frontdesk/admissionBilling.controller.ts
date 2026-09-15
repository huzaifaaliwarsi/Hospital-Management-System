import type { Request, Response } from 'express';
import { admissionBillingService } from './admissionBilling.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { CollectAdmissionPaymentBody } from './admissionBilling.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const admissionBillingController = {
  getStatement: async (req: Request, res: Response) => {
    const statement = await admissionBillingService.getStatement(req.params.id as string);
    res.json({ data: statement });
  },

  collectPayment: async (req: Request, res: Response) => {
    const result = await admissionBillingService.collectPayment(
      req.params.id as string,
      req.body as CollectAdmissionPaymentBody,
      actorId(req),
    );
    res.status(201).json({ data: result });
  },
};
