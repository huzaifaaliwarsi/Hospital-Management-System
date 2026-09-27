import { z } from 'zod';

/**
 * Admin / Super Admin management reports (Super Admin_Admin Reporting.pdf,
 * reporting.md §8.3). Same date-range shape as every other report.
 */
const dateRangeSchema = z.object({
  preset: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'custom']).default('today'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

const uuid = z.string().uuid().optional();
const payerType = z.enum(['PANEL', 'SELF_PAY']).optional();
export const cashPortalEnum = z.enum(['BILLING', 'INVENTORY', 'PHARMACY']);

/** #1 Management Summary — From/To, Department, Portal/User. */
export const managementSummaryQuerySchema = dateRangeSchema.extend({
  departmentId: uuid,
  portalUserId: uuid,
});
export type ManagementSummaryQuery = z.infer<typeof managementSummaryQuerySchema>;

/** #2 Billing & Collection — From/To, Department, User/Cashier, Payment Method, Payment Status, Panel. */
export const billingCollectionQuerySchema = dateRangeSchema.extend({
  departmentId: uuid,
  collectedById: uuid,
  method: z.enum(['CASH', 'CARD', 'BANK', 'ONLINE']).optional(),
  status: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOID']).optional(),
  corporatePanelId: uuid,
});
export type BillingCollectionQuery = z.infer<typeof billingCollectionQuerySchema>;

/** #3 Outstanding / Panel — From/To, Payer Type, Panel, Department, Status. */
export const outstandingPanelQuerySchema = dateRangeSchema.extend({
  payerType,
  corporatePanelId: uuid,
  departmentId: uuid,
  status: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
});
export type OutstandingPanelQuery = z.infer<typeof outstandingPanelQuerySchema>;

/** #6 Balance Sheet & Account Settlements — From/To, Portal, User, Settlement Status. */
export const balanceSettlementsQuerySchema = dateRangeSchema.extend({
  portal: cashPortalEnum.optional(),
  portalUserId: uuid,
  settlementStatus: z
    .enum([
      'NONE',
      'SUBMITTED',
      'ACCEPTED',
      'PARTIALLY_ACCEPTED',
      'RETURNED',
      'REJECTED',
      'REVERSED',
    ])
    .optional(),
});
export type BalanceSettlementsQuery = z.infer<typeof balanceSettlementsQuerySchema>;

/** #7 Staff / Payroll / Doctor Commission — Payroll Period (month), Department, Staff/Doctor, Status. */
export const staffPayrollQuerySchema = z.object({
  /** YYYY-MM; defaults to the current month. */
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  departmentId: uuid,
  staffId: uuid,
  status: z
    .enum(['NOT_GENERATED', 'DRAFT', 'GENERATED', 'APPROVED', 'PARTIALLY_PAID', 'PAID'])
    .optional(),
});
export type StaffPayrollQuery = z.infer<typeof staffPayrollQuerySchema>;

/** #8 Inventory / Pharmacy Summary — From/To, Category/Department, Status. */
export const inventoryPharmacyQuerySchema = dateRangeSchema.extend({
  category: z.string().trim().max(100).optional(),
  /** ALERTS = only figures that need attention (low stock, expiry, pending requests). */
  status: z.enum(['ALERTS']).optional(),
});
export type InventoryPharmacyQuery = z.infer<typeof inventoryPharmacyQuerySchema>;
