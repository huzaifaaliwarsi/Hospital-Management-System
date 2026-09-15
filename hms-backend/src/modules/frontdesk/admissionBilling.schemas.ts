import { z } from 'zod';

export const admissionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const collectAdmissionPaymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK', 'ONLINE']).default('CASH'),
  reference: z.string().optional(),
  /**
   * Explicit per-department-invoice allocation (v7.2 §2.11). When omitted,
   * the amount is auto-allocated proportionally to each invoice's current
   * outstanding balance.
   */
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().uuid(),
        amount: z.coerce.number().positive(),
      }),
    )
    .optional(),
});

export type CollectAdmissionPaymentBody = z.infer<typeof collectAdmissionPaymentSchema>;
