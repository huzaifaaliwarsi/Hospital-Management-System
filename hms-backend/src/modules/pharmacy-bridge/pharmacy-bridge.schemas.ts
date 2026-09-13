import { z } from 'zod';

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createMedicineRequestSchema = z.object({
  admissionRecordId: z.string().uuid(),
  idempotencyKey: z.string().min(1).max(255),
  lines: z
    .array(
      z.object({
        medicineId: z.string().uuid(),
        requestedQuantity: z.coerce.number().positive('Requested quantity must be greater than zero'),
        notes: z.string().optional(),
      }),
    )
    .min(1, 'At least one medicine must be requested'),
});

export type CreateMedicineRequestBody = z.infer<typeof createMedicineRequestSchema>;

export const listRequestsQuerySchema = z.object({
  status: z
    .enum([
      'REQUESTED',
      'ACCEPTED',
      'PARTIALLY_FULFILLED',
      'REJECTED',
      'DISPENSING',
      'DISPENSED',
      'INVOICED',
      'CLEARANCE_SENT',
      'INTEGRATION_ERROR',
    ])
    .optional(),
  admissionRecordId: z.string().uuid().optional(),
});

export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
