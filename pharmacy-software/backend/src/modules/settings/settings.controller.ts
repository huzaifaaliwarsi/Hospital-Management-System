import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { settingsService } from './settings.service';
import type { UpdatePharmacySettingsBody } from './settings.schemas';

export const settingsController = {
  async get(_req: Request, res: Response) {
    const data = await settingsService.get();
    res.json({ data });
  },
  async update(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await settingsService.update(req.body as UpdatePharmacySettingsBody, req.user.sub);
    res.json({ data });
  },
};
