
import type { Request, Response } from 'express';
import { managementReportsService as svc } from './managementReports.service';
import type {
  ManagementSummaryQuery,
  BillingCollectionQuery,
  OutstandingPanelQuery,
  BalanceSettlementsQuery,
  StaffPayrollQuery,
  InventoryPharmacyQuery,
  IncomeExpenseLedgerQuery,
} from './managementReports.schemas';

export const managementReportsController = {
  summary: async (req: Request, res: Response) => {
    res.json({ data: await svc.getSummary(req.query as unknown as ManagementSummaryQuery) });
  },
  incomeExpenseLedger: async (req: Request, res: Response) => {
    res.json({
      data: await svc.getIncomeExpenseLedger(req.query as unknown as IncomeExpenseLedgerQuery),
    });
  },
  billingCollection: async (req: Request, res: Response) => {
    res.json({
      data: await svc.getBillingCollection(req.query as unknown as BillingCollectionQuery),
    });
  },
  outstandingPanel: async (req: Request, res: Response) => {
    res.json({
      data: await svc.getOutstandingPanel(req.query as unknown as OutstandingPanelQuery),
    });
  },
  balanceSettlements: async (req: Request, res: Response) => {
    res.json({
      data: await svc.getBalanceSettlements(req.query as unknown as BalanceSettlementsQuery),
    });
  },
  staffPayrollCommission: async (req: Request, res: Response) => {
    res.json({
      data: await svc.getStaffPayrollCommission(req.query as unknown as StaffPayrollQuery),
    });
  },
  inventoryPharmacy: async (req: Request, res: Response) => {
    res.json({
      data: await svc.getInventoryPharmacy(req.query as unknown as InventoryPharmacyQuery),
    });
  },
  operatingProfit: async (req: Request, res: Response) => {
    res.json({
      data: await svc.getOperatingProfit(req.query as unknown as ManagementSummaryQuery),
    });
  },
  detailedExpenses: async (req: Request, res: Response) => {
    res.json({
      data: await svc.getDetailedExpenses(req.query as unknown as ManagementSummaryQuery),
    });
  },
  filterOptions: async (_req: Request, res: Response) => {
    res.json({ data: await svc.getFilterOptions() });
  },
};
