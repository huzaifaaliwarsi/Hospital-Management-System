import type { Request, Response } from 'express';
import { paymentRequestsService } from './paymentRequests.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { ListPaymentRequestsQuery, CollectPaymentRequestBody } from './paymentRequests.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const paymentRequestsController = {
  listPaymentRequests: async (req: Request, res: Response) => {
    const requests = await paymentRequestsService.listPaymentRequests(req.query as unknown as ListPaymentRequestsQuery);
    res.json({ data: requests });
  },

  collectPaymentRequest: async (req: Request, res: Response) => {
    const result = await paymentRequestsService.collectPaymentRequest(
      req.params.id as string,
      req.body as CollectPaymentRequestBody,
      actorId(req),
    );
    res.status(201).json({ data: result });
  },
};
