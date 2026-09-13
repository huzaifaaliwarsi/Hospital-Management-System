import { z } from 'zod';

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

// ── Supplier ────────────────────────────────────────────────────────
export const createSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  contact: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  terms: z.string().optional(),
});

export type CreateSupplierBody = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierBody = z.infer<typeof updateSupplierSchema>;

// ── Stock Item ───────────────────────────────────────────────────────
export const createStockItemSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  category: z.string().optional(),
  unit: z.string().min(1).max(20),
  reorderLevel: z.coerce.number().nonnegative().default(0),
});

export type CreateStockItemBody = z.infer<typeof createStockItemSchema>;

export const updateStockItemSchema = createStockItemSchema.partial();
export type UpdateStockItemBody = z.infer<typeof updateStockItemSchema>;

// ── Fund Request (Petty Cash) ────────────────────────────────────────
export const createFundRequestSchema = z.object({
  amount: z.coerce.number().positive('Requested amount must be greater than zero'),
  reason: z.string().min(1, 'Reason is required'),
});

export type CreateFundRequestBody = z.infer<typeof createFundRequestSchema>;

// ── Purchase Order / Goods Receipt ───────────────────────────────────
export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  invoiceReference: z.string().optional(),
  paymentMethod: z.enum(['PETTY_CASH', 'MANAGEMENT_DIRECT', 'ONLINE', 'CREDIT']),
  lines: z
    .array(
      z.object({
        stockItemId: z.string().uuid(),
        quantity: z.coerce.number().positive('Quantity must be greater than zero'),
        rate: z.coerce.number().positive('Rate must be greater than zero'),
      }),
    )
    .min(1, 'At least one line item is required'),
});

export type CreatePurchaseBody = z.infer<typeof createPurchaseSchema>;

// ── Department Requisition & Issue ───────────────────────────────────
export const createDepartmentIssueSchema = z.object({
  departmentId: z.string().uuid(),
  receivedByName: z.string().optional(),
  lines: z
    .array(
      z.object({
        stockItemId: z.string().uuid(),
        quantity: z.coerce.number().positive('Quantity must be greater than zero'),
      }),
    )
    .min(1, 'At least one item must be issued'),
});

export type CreateDepartmentIssueBody = z.infer<typeof createDepartmentIssueSchema>;

export const createDepartmentReturnSchema = z.object({
  requisitionId: z.string().uuid(),
  lines: z
    .array(
      z.object({
        stockItemId: z.string().uuid(),
        returnedQuantity: z.coerce.number().positive(),
      }),
    )
    .min(1),
});

export type CreateDepartmentReturnBody = z.infer<typeof createDepartmentReturnSchema>;
