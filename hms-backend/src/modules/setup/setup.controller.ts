import type { Request, Response } from 'express';
import { setupService } from './setup.service';
import { AuthenticationError } from '@/shared/errors/AppError';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const setupController = {
  // Hospital Profile
  getHospitalProfile: async (_req: Request, res: Response) => {
    res.json({ data: await setupService.getHospitalProfile() });
  },
  updateHospitalProfile: async (req: Request, res: Response) => {
    res.json({ data: await setupService.updateHospitalProfile(req.body, actorId(req)) });
  },

  // Departments
  listDepartments: async (req: Request, res: Response) => {
    res.json({ data: await setupService.listDepartments(req.query.activeOnly === 'true') });
  },
  createDepartment: async (req: Request, res: Response) => {
    res.status(201).json({ data: await setupService.createDepartment(req.body, actorId(req)) });
  },
  updateDepartment: async (req: Request, res: Response) => {
    res.json({ data: await setupService.updateDepartment(req.params.id as string, req.body, actorId(req)) });
  },
  deactivateDepartment: async (req: Request, res: Response) => {
    res.json({ data: await setupService.deactivateDepartment(req.params.id as string) });
  },

  // Service Rates
  listServiceRates: async (req: Request, res: Response) => {
    res.json({ data: await setupService.listServiceRates(req.query.activeOnly === 'true') });
  },
  createServiceRate: async (req: Request, res: Response) => {
    res.status(201).json({ data: await setupService.createServiceRate(req.body, actorId(req)) });
  },
  updateServiceRate: async (req: Request, res: Response) => {
    res.json({ data: await setupService.updateServiceRate(req.params.id as string, req.body) });
  },
  deactivateServiceRate: async (req: Request, res: Response) => {
    res.json({ data: await setupService.deactivateServiceRate(req.params.id as string) });
  },

  // Wards / Rooms / Beds
  listWardHierarchy: async (_req: Request, res: Response) => {
    res.json({ data: await setupService.listWardHierarchy() });
  },
  createWard: async (req: Request, res: Response) => {
    res.status(201).json({ data: await setupService.createWard(req.body, actorId(req)) });
  },
  updateWard: async (req: Request, res: Response) => {
    res.json({ data: await setupService.updateWard(req.params.id as string, req.body) });
  },
  createRoom: async (req: Request, res: Response) => {
    res.status(201).json({ data: await setupService.createRoom(req.body, actorId(req)) });
  },
  updateRoom: async (req: Request, res: Response) => {
    res.json({ data: await setupService.updateRoom(req.params.id as string, req.body) });
  },
  createBed: async (req: Request, res: Response) => {
    res.status(201).json({ data: await setupService.createBed(req.body, actorId(req)) });
  },
  updateBed: async (req: Request, res: Response) => {
    res.json({ data: await setupService.updateBed(req.params.id as string, req.body) });
  },

  // Corporate Panels
  listCorporatePanels: async (req: Request, res: Response) => {
    res.json({ data: await setupService.listCorporatePanels(req.query.activeOnly === 'true') });
  },
  createCorporatePanel: async (req: Request, res: Response) => {
    res.status(201).json({ data: await setupService.createCorporatePanel(req.body, actorId(req)) });
  },
  updateCorporatePanel: async (req: Request, res: Response) => {
    res.json({ data: await setupService.updateCorporatePanel(req.params.id as string, req.body) });
  },
  replaceDiscountRules: async (req: Request, res: Response) => {
    res.json({ data: await setupService.replaceDiscountRules(req.params.id as string, req.body) });
  },
};
