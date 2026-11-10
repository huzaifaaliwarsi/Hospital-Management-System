import { z } from 'zod';

export const idParamsSchema = z.object({ id: z.string().uuid() });

/** pharmacy.md §11.1 — Admin issues petty cash to a Sales user (or Super Admin to Admin). */
export const issuePettyCashBodySchema = z.object({
  toUserId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  note: z.string().max(300).optional(),
});
export type IssuePettyCashBody = z.infer<typeof issuePettyCashBodySchema>;

export const balanceSheetQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  userId: z.string().uuid().optional(),
});
export type BalanceSheetQuery = z.infer<typeof balanceSheetQuerySchema>;

/** pharmacy.md §11.2 — user enters Physical Cash; Expected Cash is system-calculated. */
export const submitSettlementBodySchema = z.object({
  periodFrom: z.coerce.date(),
  periodTo: z.coerce.date(),
  physicalCash: z.coerce.number().nonnegative(),
  varianceReason: z.string().max(500).optional(),
});
export type SubmitSettlementBody = z.infer<typeof submitSettlementBodySchema>;

export const reviewSettlementBodySchema = z.object({
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  note: z.string().max(500).optional(),
});
export type ReviewSettlementBody = z.infer<typeof reviewSettlementBodySchema>;

export const listSettlementsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  status: z.enum(['SUBMITTED', 'ACCEPTED', 'REJECTED']).optional(),
});
export type ListSettlementsQuery = z.infer<typeof listSettlementsQuerySchema>;
