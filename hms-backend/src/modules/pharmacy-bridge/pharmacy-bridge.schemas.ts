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
      'AUTHORIZATION_REQUIRED',
    ])
    .optional(),
  admissionRecordId: z.string().uuid().optional(),
});

export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;

export const dispensedCallbackSchema = z.object({
  dispenseEventId: z.string().optional().nullable(),
  externalAdmissionRef: z.string().min(1),
  externalRequestRef: z.string().optional().nullable(),
  patientMrNumber: z.string().optional().nullable(),
  pharmacyInvoiceId: z.string().optional().nullable(),
  pharmacyInvoiceNumber: z.string().min(1),
  subtotal: z.coerce.number().nonnegative(),
  taxTotal: z.coerce.number().nonnegative(),
  discountTotal: z.coerce.number().nonnegative(),
  totalAmount: z.coerce.number().positive(),
  deltaAmount: z.coerce.number().optional().nullable(),
  dispensedBy: z.string().optional().nullable(),
  dispensedAt: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        dispenseEventId: z.string().optional().nullable(),
        externalRequestRef: z.string().optional().nullable(),
        medicineName: z.string(),
        batchNumber: z.string().optional().nullable(),
        quantity: z.coerce.number(),
        rate: z.coerce.number(),
        lineNet: z.coerce.number(),
      }),
    )
    .optional(),
});
export type DispensedCallbackBody = z.infer<typeof dispensedCallbackSchema>;

export const settlementRequestSchema = z.object({
  settlementNumber: z.string().min(1),
  pharmacyInvoiceNumber: z.string().min(1),
  requestedAmount: z.coerce.number().positive(),
  requestedBy: z.string().optional().nullable(),
  remarks: z.string().max(500).optional(),
});
export type SettlementRequestBody = z.infer<typeof settlementRequestSchema>;

export const releaseSettlementSchema = z.object({
  releasedAmount: z.coerce.number().positive(),
  paymentMethod: z.enum(['CASH', 'BANK', 'ONLINE']).optional().default('BANK'),
  paymentReference: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});
export type ReleaseSettlementBody = z.infer<typeof releaseSettlementSchema>;
