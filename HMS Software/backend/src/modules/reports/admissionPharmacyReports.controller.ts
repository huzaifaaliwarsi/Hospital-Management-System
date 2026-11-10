import type { Request, Response } from 'express';
import { admissionPharmacyReportsService as svc } from './admissionPharmacyReports.service';
import type {
  PharmacyRequestReportQuery,
  MedicineFulfillmentQuery,
  HighValueApprovalQuery,
  PharmacyClearanceStatusQuery,
} from './admissionPharmacyReports.schemas';

export const admissionPharmacyReportsController = {
  medicineRequests: async (req: Request, res: Response) => {
    res.json({ data: await svc.getPharmacyMedicineRequestReport(req.query as unknown as PharmacyRequestReportQuery) });
  },
  medicineFulfillment: async (req: Request, res: Response) => {
    res.json({ data: await svc.getMedicineFulfillmentReport(req.query as unknown as MedicineFulfillmentQuery) });
  },
  highValueApproval: async (req: Request, res: Response) => {
    res.json({ data: await svc.getHighValueMedicineApprovalReport(req.query as unknown as HighValueApprovalQuery) });
  },
  clearanceStatus: async (req: Request, res: Response) => {
    res.json({ data: await svc.getPharmacyClearanceStatusReport(req.query as unknown as PharmacyClearanceStatusQuery) });
  },
};
