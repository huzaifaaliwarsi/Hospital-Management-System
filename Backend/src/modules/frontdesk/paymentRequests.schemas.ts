import { z } from 'zod';

export const paymentRequestIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listPaymentRequestsQuerySchema = z.object({
  status: z.enum(['PENDING', 'FULFILLED', 'PARTIALLY_FULFILLED', 'CANCELLED']).optional(),
});

export type ListPaymentRequestsQuery = z.infer<typeof listPaymentRequestsQuerySchema>;

export const collectPaymentRequestSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK', 'ONLINE']).default('CASH'),
  reference: z.string().optional(),
});

export type CollectPaymentRequestBody = z.infer<typeof collectPaymentRequestSchema>;
