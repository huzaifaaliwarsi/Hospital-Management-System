import { z } from 'zod';

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export const batchIdParamsSchema = z.object({
  id: z.string().uuid(),
  batchId: z.string().uuid(),
});

// ── Medicine Master ────────────────────────────────────────────────────────
export const createMedicineSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  category: z.string().optional(),
  unit: z.string().min(1).max(20),
  batchManaged: z.boolean().default(true),
  purchaseRate: z.coerce.number().positive().optional(),
  saleRate: z.coerce.number().positive().optional(),
});

export type CreateMedicineBody = z.infer<typeof createMedicineSchema>;

export const updateMedicineSchema = createMedicineSchema.partial();
export type UpdateMedicineBody = z.infer<typeof updateMedicineSchema>;

// ── Batches ───────────────────────────────────────────────────────────────
export const createBatchSchema = z.object({
  batchNumber: z.string().min(1).max(100),
  expiryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid expiryDate date string required',
  }),
  costRate: z.coerce.number().positive('Cost rate must be greater than zero'),
});

export type CreateBatchBody = z.infer<typeof createBatchSchema>;

export const receiveBatchStockSchema = z.object({
  quantity: z.coerce.number().positive('Received quantity must be positive'),
  referenceInvoice: z.string().optional(),
});

export type ReceiveBatchStockBody = z.infer<typeof receiveBatchStockSchema>;

// ── Retail FEFO Dispensing ────────────────────────────────────────────────
export const dispenseRetailSchema = z.object({
  customerName: z.string().optional(),
  panelPatientId: z.string().uuid().optional(),
  selfPayEncounterId: z.string().uuid().optional(),
  lines: z
    .array(
      z.object({
        medicineId: z.string().uuid(),
        quantity: z.coerce.number().positive('Quantity must be greater than zero'),
        discountAmount: z.coerce.number().nonnegative().optional(),
      }),
    )
    .min(1, 'At least one medicine must be dispensed'),
});

export type DispenseRetailBody = z.infer<typeof dispenseRetailSchema>;
