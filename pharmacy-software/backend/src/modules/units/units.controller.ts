import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { unitsService } from './units.service';
import type { CreateUnitBody, UpdateUnitBody, ListUnitsQuery } from './units.schemas';

export const unitsController = {
  async list(req: Request, res: Response) {
    const data = await unitsService.list(req.query as unknown as ListUnitsQuery);
    res.json({ data });
  },
  async create(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await unitsService.create(req.body as CreateUnitBody, req.user.sub);
    res.status(201).json({ data });
  },
  async update(req: Request, res: Response) {
    const data = await unitsService.update(req.params.id as string, req.body as UpdateUnitBody);
    res.json({ data });
  },
};
