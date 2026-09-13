import type { Request, Response } from 'express';
import { staffService } from './staff.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { CreateStaffBody, UpdateStaffBody, ListStaffQuery } from './staff.schemas';

export const staffController = {
  async list(req: Request, res: Response) {
    const { rows, meta } = await staffService.list(req.query as unknown as ListStaffQuery);
    res.json({ data: rows, meta: { pagination: meta } });
  },

  async getById(req: Request, res: Response) {
    const staff = await staffService.getById(req.params.id as string);
    res.json({ data: staff });
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const staff = await staffService.create(req.body as CreateStaffBody, req.user.sub);
    res.status(201).json({ data: staff });
  },

  async update(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const staff = await staffService.update(req.params.id as string, req.body as UpdateStaffBody, req.user.sub);
    res.json({ data: staff });
  },

  async deactivate(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const staff = await staffService.deactivate(req.params.id as string, req.user.sub);
    res.json({ data: staff });
  },

  async getFullProfile(req: Request, res: Response) {
    const profile = await staffService.getFullProfile(req.params.id as string);
    res.json({ data: profile });
  },
};
