import type { Request, Response } from 'express';
import { pharmacyBridgeService } from './pharmacy-bridge.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type {
  ListRequestsQuery,
  DispensedCallbackBody,
  SettlementRequestBody,
  ReleaseSettlementBody,
} from './pharmacy-bridge.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

function actorRole(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.role;
}

export const pharmacyBridgeController = {
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

  // ── Webhook / Callback from Pharmacy Backend ─────────────────────────────
  handleDispensedCallback: async (req: Request, res: Response) => {
    const result = await pharmacyBridgeService.handleDispensedCallback(
      req.body as DispensedCallbackBody,
    );
    res.status(200).json({ data: result });
  },

  // ── Inter-Entity Settlement Endpoints ─────────────────────────────────────
  handleSettlementRequest: async (req: Request, res: Response) => {
    const settlement = await pharmacyBridgeService.handleSettlementRequest(
      req.body as SettlementRequestBody,
    );
    res.status(201).json({ data: settlement });
  },

  listSettlements: async (_req: Request, res: Response) => {
    const settlements = await pharmacyBridgeService.listSettlements();
    res.json({ data: settlements });
  },

  releaseSettlement: async (req: Request, res: Response) => {
    const settlement = await pharmacyBridgeService.releaseSettlement(
      req.params.id as string,
      req.body as ReleaseSettlementBody,
      actorId(req),
      actorRole(req),
    );
    res.json({ data: settlement });
  },

  listCharges: async (req: Request, res: Response) => {
    const charges = await pharmacyBridgeService.listCharges(
      req.query.admissionRecordId as string | undefined,
    );
    res.json({ data: charges });
  },

  resyncPatientCollected: async (req: Request, res: Response) => {
    const charge = await pharmacyBridgeService.resyncPatientCollected(req.params.admissionId as string);
    res.json({ data: charge });
  },
};
