import type { Request, Response } from 'express';
import { pharmacyBridgeService } from './pharmacy-bridge.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { CreateMedicineRequestBody, ListRequestsQuery } from './pharmacy-bridge.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const pharmacyBridgeController = {
  createRequest: async (req: Request, res: Response) => {
    const request = await pharmacyBridgeService.createRequest(
      req.body as CreateMedicineRequestBody,
      actorId(req),
    );
    res.status(201).json({ data: request });
  },

  listRequests: async (req: Request, res: Response) => {
    const requests = await pharmacyBridgeService.listRequests(
      req.query as unknown as ListRequestsQuery,
    );
    res.json({ data: requests });
  },

  getRequestById: async (req: Request, res: Response) => {
    const request = await pharmacyBridgeService.getRequestById(req.params.id!);
    res.json({ data: request });
  },

  fulfillAndDispense: async (req: Request, res: Response) => {
    const result = await pharmacyBridgeService.fulfillAndDispense(
      req.params.id!,
      actorId(req),
    );
    res.status(200).json({ data: result });
  },
};
