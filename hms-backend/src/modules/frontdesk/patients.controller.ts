import type { Request, Response } from 'express';
import { patientsService } from './patients.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { CheckDuplicateQuery, CreatePanelPatientBody, UpdatePanelPatientBody, CreateSelfPayEncounterBody } from './patients.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const patientsController = {
  checkDuplicate: async (req: Request, res: Response) => {
    res.json({ data: await patientsService.checkDuplicate(req.query as unknown as CheckDuplicateQuery) });
  },

  listPanelPatients: async (req: Request, res: Response) => {
    res.json({ data: await patientsService.listPanelPatients(req.query.search as string | undefined) });
  },
  createPanelPatient: async (req: Request, res: Response) => {
    res.status(201).json({ data: await patientsService.createPanelPatient(req.body as CreatePanelPatientBody, actorId(req)) });
  },
  updatePanelPatient: async (req: Request, res: Response) => {
    res.json({ data: await patientsService.updatePanelPatient(req.params.id as string, req.body as UpdatePanelPatientBody) });
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
