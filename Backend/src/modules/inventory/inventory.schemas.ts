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

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateSupplierBody = z.infer<typeof updateSupplierSchema>;

// ── Pay Supplier (inventory.md §5.2, §9 step 12) ───────────────────────
export const paySupplierSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paymentMethod: z.enum(['PETTY_CASH', 'MANAGEMENT_DIRECT', 'ONLINE']),
  reference: z.string().optional(),
});
export type PaySupplierBody = z.infer<typeof paySupplierSchema>;

// ── Stock Item ───────────────────────────────────────────────────────
export const createStockItemSchema = z.object({
  code: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  category: z.string().optional(),
  unit: z.string().min(1).max(20),
  location: z.string().optional(),
  reorderLevel: z.coerce.number().nonnegative().default(0),
  supplierId: z.string().uuid().optional(),
  initialQuantity: z.coerce.number().nonnegative().optional(),
  unitCost: z.coerce.number().nonnegative().optional(),
});

export type CreateStockItemBody = z.infer<typeof createStockItemSchema>;

export const updateStockItemSchema = createStockItemSchema.partial().extend({
  // Activate/Deactivate row action (inventory.md §4.1) — master-field-only,
  // never touches quantity.
  isActive: z.boolean().optional(),
});
export type UpdateStockItemBody = z.infer<typeof updateStockItemSchema>;

// ── Fund Request (Petty Cash) ────────────────────────────────────────
export const createFundRequestSchema = z.object({
  amount: z.coerce.number().positive('Requested amount must be greater than zero'),
  reason: z.string().min(1, 'Reason is required'),
  recipientUserId: z.string().uuid().optional(),
});

export type CreateFundRequestBody = z.infer<typeof createFundRequestSchema>;

// ── Inventory Expenses ───────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  'UTILITIES',
  'RENT',
  'MAINTENANCE_REPAIRS',
  'MEDICAL_SUPPLIES',
  'OFFICE_SUPPLIES',
  'EQUIPMENT',
  'CLEANING_SANITATION',
  'FOOD_REFRESHMENTS',
  'TRANSPORT',
  'MARKETING',
  'PROFESSIONAL_FEES',
  'MISCELLANEOUS',
] as const;

export const createInventoryExpenseSchema = z.object({
  expenseDate: z.string().optional(), // ISO date (YYYY-MM-DD); defaults to today
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK', 'ONLINE']),
  payee: z.string().optional(),
  description: z.string().optional(),
  reference: z.string().optional(),
});

export type CreateInventoryExpenseBody = z.infer<typeof createInventoryExpenseSchema>;

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
        batchNo: z.string().optional(),
        expiryDate: z.string().optional(), // ISO date (YYYY-MM-DD)
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
  departmentRequisitionId: z.string().uuid(),
  returnedByName: z.string().optional(),
  lines: z
    .array(
      z.object({
        departmentRequisitionLineId: z.string().uuid(),
        quantity: z.coerce.number().positive('Return quantity must be greater than zero'),
        // Stock Treatment (inventory.md §4.2): USABLE goes back to available
        // stock; DAMAGED/EXPIRED does not (Adjustment/Quarantine routing is
        // §9 step 5, not yet built) but is still tracked against the line's
        // `returnedQuantity` for department accountability.
        condition: z.enum(['USABLE', 'DAMAGED', 'EXPIRED']).default('USABLE'),
      }),
    )
    .min(1, 'At least one line must be returned'),
});

export type CreateDepartmentReturnBody = z.infer<typeof createDepartmentReturnSchema>;

// ── Supplier Return ──────────────────────────────────────────────────
export const createSupplierReturnSchema = z.object({
  supplierId: z.string().uuid(),
  // Every return traces back to the purchase it came from (inventory.md
  // §5.2 "Purchase Return" button) — both ledger entries reference this PO.
  purchaseOrderId: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required'),
  // SUPPLIER_CREDIT (default): reduces/adjusts what's owed to the supplier
  // (§5 formula). CASH_REFUND: additionally credits the acting user's own
  // physical cash balance (PROJECT_MASTER_SPEC.md §4.8 Sub-flow C).
  refundMethod: z.enum(['SUPPLIER_CREDIT', 'CASH_REFUND']).default('SUPPLIER_CREDIT'),
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

export type CreateSupplierReturnBody = z.infer<typeof createSupplierReturnSchema>;

// ── Adjustment ────────────────────────────────────────────────────────
export const createAdjustmentSchema = z.object({
  stockItemId: z.string().uuid(),
  batchNo: z.string().optional(),
  type: z.enum(['DAMAGE', 'EXPIRY', 'COUNT_CORRECTION', 'LOSS', 'SURPLUS', 'QUARANTINE']),
  // DAMAGE/EXPIRY/LOSS/QUARANTINE are always DECREASE, SURPLUS always
  // INCREASE — the service enforces this; only COUNT_CORRECTION genuinely
  // needs the caller's choice.
  direction: z.enum(['INCREASE', 'DECREASE']),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  reason: z.string().min(1, 'Reason is required'),
  requiresApproval: z.boolean().optional().default(false),
  // inventory.md §5's Supplier Ledger "Add Approved Adjustment" — when set,
  // this adjustment also posts a signed ADJUSTMENT entry to that supplier's
  // ledger (valued off their most recent purchase rate for this item).
  supplierId: z.string().uuid().optional(),
});

export type CreateAdjustmentBody = z.infer<typeof createAdjustmentSchema>;
