import { z } from 'zod';
import { EXPENSE_CATEGORIES } from '@/modules/inventory/inventory.schemas';

/** Same date-range shape as every other report module — kept consistent app-wide.
 * `all` = full history, no date filter (needed e.g. so Supplier Return can find
 * ANY past purchase to return against, not just this month's). */
const dateRangeSchema = z.object({
  preset: z.enum(['all', 'today', 'yesterday', 'this_week', 'this_month', 'custom']).default('this_month'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const inventorySummaryQuerySchema = dateRangeSchema.extend({
  category: z.string().optional(),
  nearExpiryDays: z.coerce.number().int().positive().default(30),
});
export type InventorySummaryQuery = z.infer<typeof inventorySummaryQuerySchema>;

export const stockMovementReportQuerySchema = dateRangeSchema.extend({
  movementType: z
    .enum([
      'PURCHASE_RECEIPT',
      'DEPARTMENT_RETURN',
      'TRANSFER_IN',
      'POSITIVE_ADJUSTMENT',
      'DEPARTMENT_ISSUE',
      'SUPPLIER_RETURN',
      'TRANSFER_OUT',
      'NEGATIVE_ADJUSTMENT',
    ])
    .optional(),
  stockItemId: z.string().uuid().optional(),
  category: z.string().optional(),
  actorId: z.string().uuid().optional(),
});
export type StockMovementReportQuery = z.infer<typeof stockMovementReportQuerySchema>;

export const purchaseReportQuerySchema = dateRangeSchema.extend({
  supplierId: z.string().uuid().optional(),
  paymentMethod: z.enum(['PETTY_CASH', 'MANAGEMENT_DIRECT', 'ONLINE', 'CREDIT']).optional(),
  createdById: z.string().uuid().optional(),
});
export type PurchaseReportQuery = z.infer<typeof purchaseReportQuerySchema>;

export const departmentIssueReturnReportQuerySchema = dateRangeSchema.extend({
  departmentId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_RETURNED', 'CLOSED']).optional(),
  issuedById: z.string().uuid().optional(),
});
export type DepartmentIssueReturnReportQuery = z.infer<typeof departmentIssueReturnReportQuerySchema>;

export const supplierReportQuerySchema = dateRangeSchema.extend({
  supplierId: z.string().uuid().optional(),
  transactionType: z.enum(['PURCHASE_CREDIT', 'PAYMENT', 'RETURN', 'CREDIT_NOTE']).optional(),
});
export type SupplierReportQuery = z.infer<typeof supplierReportQuerySchema>;

export const inventoryExpenseReportQuerySchema = dateRangeSchema.extend({
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK', 'ONLINE']).optional(),
  createdById: z.string().uuid().optional(),
});
export type InventoryExpenseReportQuery = z.infer<typeof inventoryExpenseReportQuerySchema>;

export const stockStatusReportQuerySchema = z.object({
  category: z.string().optional(),
  stockItemId: z.string().uuid().optional(),
  status: z.enum(['LOW', 'OUT', 'NORMAL']).optional(),
  expiryWindowDays: z.coerce.number().int().positive().optional(),
});
export type StockStatusReportQuery = z.infer<typeof stockStatusReportQuerySchema>;

export const cashSettlementReportQuerySchema = dateRangeSchema.extend({
  status: z.enum(['PREPARED', 'SUBMITTED', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'RETURNED', 'REJECTED', 'REVERSED']).optional(),
});
export type CashSettlementReportQuery = z.infer<typeof cashSettlementReportQuerySchema>;
