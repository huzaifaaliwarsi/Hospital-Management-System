import { z } from 'zod';

/** Same date-range shape as the rest of the reporting surface (`dashboard.schemas.ts`) — kept consistent on purpose. */
const dateRangeSchema = z.object({
  preset: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'custom']).default('today'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

/** `all` (default) = full live custody picture, not just today's movements — Petty Cash Oversight §2 wants total issued/spent since ever, not a day's slice. */
export const listBalanceSheetsQuerySchema = dateRangeSchema.extend({
  preset: z.enum(['all', 'today', 'yesterday', 'this_week', 'this_month', 'custom']).default('all'),
  portalUserId: z.string().uuid().optional(),
  onlyUnsettled: z.coerce.boolean().optional(),
});
export type ListBalanceSheetsQuery = z.infer<typeof listBalanceSheetsQuerySchema>;

/**
 * reporting.md §2 #8 — My Balance Sheet period: `shift` (default) is the live
 * unsettled custody the cashier settles; any other preset is a historical
 * view over every ledger entry in that range, settled or not.
 */
export const myBalanceSheetQuerySchema = z.object({
  preset: z.enum(['shift', 'today', 'yesterday', 'this_week', 'this_month', 'custom']).default('shift'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
export type MyBalanceSheetQuery = z.infer<typeof myBalanceSheetQuerySchema>;

/** reporting.md §2 #9 — My Account Settlement history: From/To + Settlement Status. `all` (default) = full history. */
export const mySettlementsQuerySchema = z.object({
  preset: z.enum(['all', 'today', 'yesterday', 'this_week', 'this_month', 'custom']).default('all'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  status: z.enum(['PREPARED', 'SUBMITTED', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'RETURNED', 'REJECTED', 'REVERSED']).optional(),
});
export type MySettlementsQuery = z.infer<typeof mySettlementsQuerySchema>;

/** Settlement register: `all` = full history, so settlements awaiting review are never hidden by the period. */
export const listSettlementsQuerySchema = dateRangeSchema.extend({
  preset: z.enum(['all', 'today', 'yesterday', 'this_week', 'this_month', 'custom']).default('all'),
  portalUserId: z.string().uuid().optional(),
  status: z.enum(['PREPARED', 'SUBMITTED', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'RETURNED', 'REJECTED', 'REVERSED']).optional(),
});
export type ListSettlementsQuery = z.infer<typeof listSettlementsQuerySchema>;

export const financeKpisQuerySchema = dateRangeSchema;
export type FinanceKpisQuery = z.infer<typeof financeKpisQuerySchema>;

export const settlementIdParamsSchema = z.object({ id: z.string().uuid() });

export const reviewSettlementBodySchema = z
  .object({
    action: z.enum(['ACCEPT', 'PARTIALLY_ACCEPT', 'RETURN', 'REJECT']),
    remarks: z.string().optional(),
  })
  .refine((body) => (body.action === 'RETURN' || body.action === 'REJECT' ? !!body.remarks?.trim() : true), {
    message: 'Remarks are required when returning or rejecting a settlement.',
    path: ['remarks'],
  });
export type ReviewSettlementBody = z.infer<typeof reviewSettlementBodySchema>;

export const reverseSettlementBodySchema = z.object({
  reason: z.string().min(1, 'A reversal reason is required.'),
});
export type ReverseSettlementBody = z.infer<typeof reverseSettlementBodySchema>;

/**
 * Super Admin "Issue Petty Cash" (opening float / top-up) to a cash-handling
 * staff user — Finance Control oversight, not a self-service cashier action.
 * `issueType` is a UI-facing distinction only; both post as the same
 * `CashCategory.PETTY_CASH_ISSUE` row (`financeControl.service.ts`
 * `issuePettyCash`) so `cash.service.ts`'s existing "Petty Cash Received"
 * total keeps working unchanged.
 */
export const issuePettyCashBodySchema = z.object({
  portalUserId: z.string().uuid(),
  amount: z.coerce.number().positive('Amount must be greater than zero.'),
  issueType: z.enum(['OPENING_FLOAT', 'TOP_UP']),
  note: z.string().trim().min(1, 'Purpose / note is required.'),
});
export type IssuePettyCashBody = z.infer<typeof issuePettyCashBodySchema>;
