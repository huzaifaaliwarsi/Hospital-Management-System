import { z } from 'zod';

export const idParamsSchema = z.object({ id: z.string().uuid() });
export const batchIdParamsSchema = z.object({ id: z.string().uuid(), batchId: z.string().uuid() });
export const invoiceIdParamsSchema = z.object({ id: z.string().uuid() });

export const createMedicineBodySchema = z.object({
  code: z.string().min(1).max(40),
  barcode: z.string().max(64).optional(),
  name: z.string().min(1).max(150),
  genericName: z.string().max(150).optional(),
  category: z.string().max(80).optional(),
  unit: z.string().min(1).max(30),
  batchManaged: z.boolean().default(true),
  reorderLevel: z.coerce.number().nonnegative().default(0),
  purchaseRate: z.coerce.number().nonnegative().optional(),
  saleRate: z.coerce.number().nonnegative().default(0),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
});
export type CreateMedicineBody = z.infer<typeof createMedicineBodySchema>;

export const updateMedicineBodySchema = createMedicineBodySchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateMedicineBody = z.infer<typeof updateMedicineBodySchema>;

export const listMedicinesQuerySchema = z.object({
  search: z.string().optional(),
  stockStatus: z.enum(['LOW', 'OUT', 'NEAR_EXPIRY', 'EXPIRED']).optional(),
});
export type ListMedicinesQuery = z.infer<typeof listMedicinesQuerySchema>;

export const createBatchBodySchema = z.object({
  batchNumber: z.string().min(1).max(60),
  expiryDate: z.coerce.date(),
  costRate: z.coerce.number().nonnegative(),
  saleRate: z.coerce.number().nonnegative().optional(),
});
export type CreateBatchBody = z.infer<typeof createBatchBodySchema>;

/** Direct stock entry outside the Purchase flow — e.g. authorized opening-stock migration (pharmacy.md §9.1). */
export const openingStockBodySchema = z.object({
  quantity: z.coerce.number().positive(),
  note: z.string().max(500).optional(),
});
export type OpeningStockBody = z.infer<typeof openingStockBodySchema>;

const dispenseLineSchema = z.object({
  medicineId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  discountAmount: z.coerce.number().nonnegative().default(0),
});

const paymentInputSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'ONLINE']),
  amount: z.coerce.number().positive(),
  reference: z.string().max(100).optional(),
});

/** pharmacy.md §6 — POS direct sale. Real payment(s)/tax/discount, not hardcoded-PAID (§19.2 fix). */
export const dispenseRetailBodySchema = z.object({
  customerName: z.string().max(150).optional(),
  lines: z.array(dispenseLineSchema).min(1),
  invoiceDiscount: z.coerce.number().nonnegative().default(0),
  payments: z.array(paymentInputSchema).default([]),
});
export type DispenseRetailBody = z.infer<typeof dispenseRetailBodySchema>;

export const addPaymentBodySchema = paymentInputSchema;
export type AddPaymentBody = z.infer<typeof addPaymentBodySchema>;

export const listInvoicesQuerySchema = z.object({
  channel: z.enum(['RETAIL', 'HMS_LINKED']).optional(),
  status: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
});
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

export const stockAdjustmentBodySchema = z.object({
  medicineId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  type: z.enum(['DAMAGE', 'EXPIRY', 'COUNT_CORRECTION', 'LOSS', 'SURPLUS', 'QUARANTINE']),
  quantity: z.coerce.number().positive(),
  reason: z.string().min(1).max(500),
});
export type StockAdjustmentBody = z.infer<typeof stockAdjustmentBodySchema>;

/** pharmacy.md §9.1 SALES_RETURN_IN — controlled return against an original completed invoice line. */
export const salesReturnBodySchema = z.object({
  invoiceId: z.string().uuid(),
  lines: z.array(z.object({ invoiceLineId: z.string().uuid(), quantity: z.coerce.number().positive(), restock: z.boolean().default(true) })).min(1),
  reason: z.string().min(1).max(500),
  refundMethod: z.enum(['CASH', 'CARD', 'ONLINE']),
});
export type SalesReturnBody = z.infer<typeof salesReturnBodySchema>;

export const stockMovementsQuerySchema = z.object({
  medicineId: z.string().uuid().optional(),
  movementType: z.enum(['PURCHASE_IN', 'POS_SALE_OUT', 'HMS_DISPENSE_OUT', 'SALES_RETURN_IN', 'PURCHASE_RETURN_OUT', 'POSITIVE_ADJUSTMENT', 'NEGATIVE_ADJUSTMENT', 'OPENING_STOCK']).optional(),
});
export type StockMovementsQuery = z.infer<typeof stockMovementsQuerySchema>;
