import { z } from 'zod';

export const idParamsSchema = z.object({ id: z.string().uuid() });

const purchaseOrderLineInputSchema = z.object({
  medicineId: z.string().uuid(),
  requiredUnitId: z.string().uuid(),
  requiredQty: z.coerce.number().positive(),
  lineNotes: z.string().max(200).optional(),
});

export const createPurchaseOrderBodySchema = z.object({
  vendorId: z.string().uuid(),
  orderDate: z.coerce.date(),
  isUrgent: z.boolean().default(false),
  notes: z.string().max(500).optional(),
  lines: z.array(purchaseOrderLineInputSchema).min(1, 'At least one medicine line is required'),
});
export type CreatePurchaseOrderBody = z.infer<typeof createPurchaseOrderBodySchema>;

export const listPurchaseOrdersQuerySchema = z.object({
  status: z.enum(['OPEN', 'CONVERTED', 'CANCELLED']).optional(),
});
export type ListPurchaseOrdersQuery = z.infer<typeof listPurchaseOrdersQuerySchema>;
