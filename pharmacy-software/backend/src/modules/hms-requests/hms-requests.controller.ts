import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { registerSseClient } from '@/shared/hmsEvents';
import { hmsRequestsService } from './hms-requests.service';
import type {
  CreateRequestBody,
  ListRequestsQuery,
  FulfillRequestBody,
  RejectRequestBody,
  UpdateSettingsBody,
  PatientCollectedCallbackBody,
  CreateSettlementRequestBody,
  ReleaseSettlementCallbackBody,
} from './hms-requests.schemas';


export const hmsRequestsController = {
  streamEvents(_req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    registerSseClient(res);
  },
  async getSettings(_req: Request, res: Response) {
    const data = await hmsRequestsService.getSettings();
    res.json({ data });
  },
  async updateSettings(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await hmsRequestsService.updateSettings(req.body as UpdateSettingsBody, req.user.sub);
    res.json({ data });
  },
  async create(req: Request, res: Response) {
    const actorId = (req as any).isInternalBridge ? undefined : req.user?.sub;
    const data = await hmsRequestsService.createRequest(req.body as CreateRequestBody, actorId);
    res.status(201).json({ data });
  },
  async list(req: Request, res: Response) {
    const data = await hmsRequestsService.list(req.query as unknown as ListRequestsQuery);
    res.json({ data });
  },
  async getById(req: Request, res: Response) {
    const data = await hmsRequestsService.getById(req.params.id as string);
    res.json({ data });
  },
  async approve(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await hmsRequestsService.approve(req.params.id as string, req.user.sub);
    res.json({ data });
  },
  async reject(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await hmsRequestsService.reject(req.params.id as string, req.body as RejectRequestBody, req.user.sub);
    res.json({ data });
  },
  async fulfill(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await hmsRequestsService.fulfill(req.params.id as string, req.body as FulfillRequestBody, req.user.sub);
    res.json({ data });
  },

  // ── Callbacks & Inter-Entity Settlements ─────────────────────────────────
  async patientCollectedCallback(req: Request, res: Response) {
    const data = await hmsRequestsService.handlePatientCollected(req.body as PatientCollectedCallbackBody);
    res.json({ data });
  },
  async createSettlementRequest(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await hmsRequestsService.createSettlementRequest(req.body as CreateSettlementRequestBody, req.user.sub);
    res.status(201).json({ data });
  },
  async settlementReleaseCallback(req: Request, res: Response) {
    const data = await hmsRequestsService.handleSettlementRelease(req.body as ReleaseSettlementCallbackBody);
    res.json({ data });
  },
  async listReceivables(_req: Request, res: Response) {
    const data = await hmsRequestsService.listReceivables();
    res.json({ data });
  },
};
