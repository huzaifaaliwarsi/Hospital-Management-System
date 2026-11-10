import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
  async management(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await dashboardService.getManagementSummary(req.user.sub);
    res.json({ data });
  },
  async sales(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await dashboardService.getSalesSummary(req.user.sub);
    res.json({ data });
  },
};
