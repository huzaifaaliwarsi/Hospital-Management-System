import { z } from 'zod';

export const idParamsSchema = z.object({ id: z.string().uuid() });

export const createVendorBodySchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(150),
  contactPerson: z.string().max(150).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  paymentTermsDays: z.coerce.number().int().nonnegative().default(0),
});
export type CreateVendorBody = z.infer<typeof createVendorBodySchema>;

export const updateVendorBodySchema = createVendorBodySchema.partial().extend({ isActive: z.boolean().optional() });
export type UpdateVendorBody = z.infer<typeof updateVendorBodySchema>;

export const payVendorBodySchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(['CASH', 'CARD', 'ONLINE']),
  reference: z.string().max(100).optional(),
});
export type PayVendorBody = z.infer<typeof payVendorBodySchema>;

const purchaseLineSchema = z.object({
  medicineId: z.string().uuid(),
  batchNumber: z.string().min(1).max(60),
  expiryDate: z.coerce.date(),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative(),
  discountAmount: z.coerce.number().nonnegative().default(0),
  taxAmount: z.coerce.number().nonnegative().default(0),
});

/** pharmacy.md §10.1 — Purchase / Stock In. */
export const createPurchaseBodySchema = z.object({
  vendorId: z.string().uuid(),
  purchaseDate: z.coerce.date(),
  vendorInvoiceNo: z.string().max(100).optional(),
  paymentType: z.enum(['CASH', 'CARD', 'ONLINE']).optional(),
  notes: z.string().max(500).optional(),
  lines: z.array(purchaseLineSchema).min(1),
  paidNow: z.coerce.number().nonnegative().default(0),
  post: z.boolean().default(true),
});
export type CreatePurchaseBody = z.infer<typeof createPurchaseBodySchema>;

/** pharmacy.md §9.1 PURCHASE_RETURN_OUT. */
export const purchaseReturnBodySchema = z.object({
  vendorId: z.string().uuid(),
  lines: z.array(z.object({ medicineId: z.string().uuid(), batchId: z.string().uuid().optional(), quantity: z.coerce.number().positive(), unitCost: z.coerce.number().nonnegative() })).min(1),
  reason: z.string().min(1).max(500),
});
export type PurchaseReturnBody = z.infer<typeof purchaseReturnBodySchema>;
