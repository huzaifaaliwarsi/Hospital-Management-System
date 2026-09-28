import type { Request, Response } from 'express';
import { inventoryReportsService } from './inventoryReports.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type {
  InventorySummaryQuery,
  StockMovementReportQuery,
  PurchaseReportQuery,
  DepartmentIssueReturnReportQuery,
  SupplierReportQuery,
  InventoryExpenseReportQuery,
  StockStatusReportQuery,
  CashSettlementReportQuery,
} from './inventoryReports.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const inventoryReportsController = {
  summary: async (req: Request, res: Response) => {
    const data = await inventoryReportsService.getInventorySummary(req.query as unknown as InventorySummaryQuery);
    res.json({ data });
  },

  stockMovement: async (req: Request, res: Response) => {
    const data = await inventoryReportsService.getStockMovementReport(req.query as unknown as StockMovementReportQuery);
    res.json({ data });
  },

  purchases: async (req: Request, res: Response) => {
    const data = await inventoryReportsService.getPurchaseReport(req.query as unknown as PurchaseReportQuery);
    res.json({ data });
  },

  departmentIssueReturn: async (req: Request, res: Response) => {
    const data = await inventoryReportsService.getDepartmentIssueReturnReport(
      req.query as unknown as DepartmentIssueReturnReportQuery,
    );
    res.json({ data });
  },

  supplierReport: async (req: Request, res: Response) => {
    const data = await inventoryReportsService.getSupplierReport(req.query as unknown as SupplierReportQuery);
    res.json({ data });
  },

  expenseReport: async (req: Request, res: Response) => {
    const data = await inventoryReportsService.getInventoryExpenseReport(
      req.query as unknown as InventoryExpenseReportQuery,
    );
    res.json({ data });
  },

  stockStatus: async (req: Request, res: Response) => {
    const data = await inventoryReportsService.getStockStatusReport(req.query as unknown as StockStatusReportQuery);
    res.json({ data });
  },

  cashSettlement: async (req: Request, res: Response) => {
    const data = await inventoryReportsService.getCashSettlementReport(
      actorId(req),
      req.query as unknown as CashSettlementReportQuery,
    );
    res.json({ data });
  },
};
