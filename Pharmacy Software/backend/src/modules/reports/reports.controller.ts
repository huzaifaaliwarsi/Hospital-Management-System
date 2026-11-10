import type { Request, Response } from 'express';
import { reportsService } from './reports.service';
import type { ReportQuery } from './reports.schemas';

export const reportsController = {
  async run(req: Request, res: Response) {
    const data = await reportsService.run(req.query as unknown as ReportQuery);
    res.json({ data });
  },
};
