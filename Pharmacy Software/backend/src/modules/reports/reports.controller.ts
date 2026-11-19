import type { Request, Response } from 'express';
import { AuthorizationError } from '@/shared/errors/AppError';
import { reportsService } from './reports.service';
import type { ReportQuery } from './reports.schemas';

export const reportsController = {
  async run(req: Request, res: Response) {
    const query = { ...(req.query as unknown as ReportQuery) };
    if (req.user?.role === 'SALES_DISPENSING') {
      // Company-wide management reports are strictly restricted to Super Admin and Admin
      if (query.type !== 'SALES_COLLECTION') {
        throw new AuthorizationError('Access denied: Company-wide reports are restricted to administrators');
      }
      // Mandatory scope: bind cashierId to authenticated user ID. Do not trust frontend-supplied cashierId.
      query.cashierId = req.user.sub;
      if (req.query) (req.query as any).cashierId = req.user.sub;
    }
    const data = await reportsService.run(query);
    res.json({ data });
  },
};
