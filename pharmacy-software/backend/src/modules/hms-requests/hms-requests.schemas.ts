import { z } from 'zod';

export const idParamsSchema = z.object({ id: z.string().uuid() });

const requestLineSchema = z.object({
  medicineId: z.string().uuid(),
  requestedQuantity: z.coerce.number().positive(),
  notes: z.string().max(300).optional(),
});

/**
 * pharmacy.md §15 HMS -> Pharmacy data contract. In production this is called
 * by HMS's own backend; until that live integration exists (deferred per
 * project decision), Pharmacy staff can log a request here as a stand-in —
 * same shape, same validation, same downstream flow either way.
 */
export const createRequestBodySchema = z.object({
  externalAdmissionRef: z.string().min(1).max(100),
  externalRequestRef: z.string().max(100).optional(),
  patientNameSnapshot: z.string().max(150).optional(),
  urgency: z.enum(['ROUTINE', 'URGENT', 'STAT']).optional(),
  requestedByExternal: z.string().max(150).optional(),
  lines: z.array(requestLineSchema).min(1),
});
export type CreateRequestBody = z.infer<typeof createRequestBodySchema>;

export const listRequestsQuerySchema = z.object({
  status: z.enum(['REQUESTED', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'DISPENSED']).optional(),
});
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;

const fulfillLineSchema = z.object({
  requestLineId: z.string().uuid(),
  dispenseQuantity: z.coerce.number().nonnegative(),
});

/** pharmacy.md §7.1/§7.2 "Accept & Dispense" / "Partial Fulfill" — one action, quantity-driven. */
export const fulfillRequestBodySchema = z.object({
  lines: z.array(fulfillLineSchema).min(1),
});
export type FulfillRequestBody = z.infer<typeof fulfillRequestBodySchema>;

export const rejectRequestBodySchema = z.object({
  reason: z.string().min(1).max(500),
});
export type RejectRequestBody = z.infer<typeof rejectRequestBodySchema>;

export const updateSettingsBodySchema = z.object({
  highValueApprovalEnabled: z.boolean(),
  highValueThreshold: z.coerce.number().nonnegative(),
});
export type UpdateSettingsBody = z.infer<typeof updateSettingsBodySchema>;
