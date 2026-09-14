import type { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';
import type { GetSuperAdminDashboardQuery } from './dashboard.schemas';

export const dashboardController = {
  async getSuperAdminDashboard(req: Request, res: Response) {
    const query = req.query as unknown as GetSuperAdminDashboardQuery;
    const data = await dashboardService.getSuperAdminDashboard(query);
    res.json({ data });
  },
};
