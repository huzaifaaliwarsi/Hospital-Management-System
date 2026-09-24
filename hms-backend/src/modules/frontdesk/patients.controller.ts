import type { Request, Response } from 'express';
import { patientsService } from './patients.service';
import { AuthenticationError, AuthorizationError } from '@/shared/errors/AppError';
import type {
  CheckDuplicateQuery,
  CreatePanelPatientBody,
  UpdatePanelPatientBody,
  CreateSelfPayEncounterBody,
  ListPanelPatientsQuery,
} from './patients.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const patientsController = {
  membershipHistory: async (req: Request, res: Response) => {
    const query = req.query as unknown as ListPanelPatientsQuery;
    const { rows, meta } = await patientsService.membershipHistory(req.params.id as string, query.page, query.pageSize);
    res.json({ data: rows, meta: { pagination: meta } });
  },
  checkDuplicate: async (req: Request, res: Response) => {
    res.json({ data: await patientsService.checkDuplicate(req.query as unknown as CheckDuplicateQuery) });
  },

  listPanelPatients: async (req: Request, res: Response) => {
    const { rows, meta } = await patientsService.listPanelPatients(req.query as unknown as ListPanelPatientsQuery);
    res.json({ data: rows, meta: { pagination: meta } });
  },
  createPanelPatient: async (req: Request, res: Response) => {
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
      throw new AuthorizationError('Only Super Admin and Admin can register panel patients');
    }
    res.status(201).json({ data: await patientsService.createPanelPatient(req.body as CreatePanelPatientBody, actorId(req)) });
  },
  updatePanelPatient: async (req: Request, res: Response) => {
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
      throw new AuthorizationError('Only Super Admin and Admin can edit panel patients');
    }
    res.json({ data: await patientsService.updatePanelPatient(req.params.id as string, req.body as UpdatePanelPatientBody, actorId(req)) });
  },

  listSelfPayEncounters: async (req: Request, res: Response) => {
    res.json({ data: await patientsService.listSelfPayEncounters(req.query.search as string | undefined) });
  },
  createSelfPayEncounter: async (req: Request, res: Response) => {
    res
      .status(201)
      .json({ data: await patientsService.createSelfPayEncounter(req.body as CreateSelfPayEncounterBody, actorId(req)) });
  },
};
