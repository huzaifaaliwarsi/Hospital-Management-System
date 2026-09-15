import type { Request, Response } from 'express';
import { panelBillingService } from './panelBilling.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { ContractResolutionQuery, RecordPanelRemittanceBody } from './panelBilling.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const panelBillingController = {
  verifyPanelPatient: async (req: Request, res: Response) => {
    const result = await panelBillingService.verifyPanelPatient(req.params.panelPatientId as string);
    res.json({ data: result });
  },

  resolveContract: async (req: Request, res: Response) => {
    const result = await panelBillingService.resolveContract(req.query as unknown as ContractResolutionQuery);
    res.json({ data: result });
  },

  getStatement: async (req: Request, res: Response) => {
    const { panelPatientId } = req.query as { panelPatientId?: string };
    const result = await panelBillingService.getPanelStatement(req.params.corporatePanelId as string, panelPatientId);
    res.json({ data: result });
  },

  recordRemittance: async (req: Request, res: Response) => {
    const result = await panelBillingService.recordRemittance(
      req.params.corporatePanelId as string,
      req.body as RecordPanelRemittanceBody,
      actorId(req),
    );
    res.status(201).json({ data: result });
  },

  listRemittances: async (req: Request, res: Response) => {
    const result = await panelBillingService.listRemittances(req.params.corporatePanelId as string);
    res.json({ data: result });
  },
};
