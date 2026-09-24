import type { Request, Response } from 'express';
import { NotFoundError } from '@/shared/errors/AppError';
import { admissionReportsService as svc } from './admissionReports.service';
import type {
  AdmissionDailySummaryQuery,
  AdmissionRegisterQuery,
  InpatientCensusQuery,
  BedOccupancyQuery,
  BedTransferHistoryQuery,
  LengthOfStayQuery,
  ServiceConsumptionQuery,
  InpatientOutstandingQuery,
  DischargeClearanceQuery,
} from './admissionReports.schemas';

export const admissionReportsController = {
  dailySummary: async (req: Request, res: Response) => {
    res.json({ data: await svc.getAdmissionDailySummary(req.query as unknown as AdmissionDailySummaryQuery) });
  },
  register: async (req: Request, res: Response) => {
    res.json({ data: await svc.getAdmissionRegister(req.query as unknown as AdmissionRegisterQuery) });
  },
  census: async (req: Request, res: Response) => {
    res.json({ data: await svc.getInpatientCensus(req.query as unknown as InpatientCensusQuery) });
  },
  bedOccupancy: async (req: Request, res: Response) => {
    res.json({ data: await svc.getBedOccupancyReport(req.query as unknown as BedOccupancyQuery) });
  },
  bedTransferHistory: async (req: Request, res: Response) => {
    res.json({ data: await svc.getBedTransferHistory(req.query as unknown as BedTransferHistoryQuery) });
  },
  lengthOfStay: async (req: Request, res: Response) => {
    res.json({ data: await svc.getLengthOfStayReport(req.query as unknown as LengthOfStayQuery) });
  },
  runningHospitalBill: async (req: Request, res: Response) => {
    const result = await svc.getRunningHospitalBill(req.params.admissionRecordId as string);
    if (!result) throw new NotFoundError('Admission not found');
    res.json({ data: result });
  },
  serviceConsumption: async (req: Request, res: Response) => {
    res.json({ data: await svc.getServiceConsumptionReport(req.query as unknown as ServiceConsumptionQuery) });
  },
  inpatientOutstanding: async (req: Request, res: Response) => {
    res.json({ data: await svc.getInpatientOutstandingBalance(req.query as unknown as InpatientOutstandingQuery) });
  },
  dischargeClearance: async (req: Request, res: Response) => {
    res.json({ data: await svc.getDischargeClearanceReport(req.query as unknown as DischargeClearanceQuery) });
  },
};
