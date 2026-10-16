import { z } from 'zod';

export const admissionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Front Desk discretionary discount on an admission's hospital-service
 * charges — same shape/rules as `invoices.schemas.ts`'s `applyDiscountSchema`
 * (OPD/encounter invoices): strictly Hospital Services only, Pharmacy /
 * Outsourced Lab & Radiology lines are never eligible (enforced in
 * `admissionBilling.service.ts`'s `applyDiscount` via
 * `@/shared/discountEligibility`).
 */
export const applyAdmissionDiscountSchema = z
  .object({
    lineItemId: z.string().uuid().optional(), // If targeting a specific line item
    discountPercent: z.coerce.number().min(0).max(100).optional(),
    discountAmount: z.coerce.number().min(0).optional(),
    discountReason: z.string().min(1, 'Reason for discount is required'),
  })
  .refine(
    (data) =>
      (data.discountPercent !== undefined && data.discountPercent > 0) ||
      (data.discountAmount !== undefined && data.discountAmount > 0),
    { message: 'Either discountPercent or discountAmount must be greater than zero' },
  );

export type ApplyAdmissionDiscountBody = z.infer<typeof applyAdmissionDiscountSchema>;

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
