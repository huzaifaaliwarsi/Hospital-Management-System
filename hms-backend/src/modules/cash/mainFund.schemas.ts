import { z } from 'zod';

/** Same date-range shape as the rest of the reporting surface, `all` (default) — the fund's full lifetime ledger. */
const dateRangeSchema = z.object({
  preset: z.enum(['all', 'today', 'yesterday', 'this_week', 'this_month', 'custom']).default('all'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const listMainFundEntriesQuerySchema = dateRangeSchema.extend({
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'PETTY_CASH_ISSUE', 'SETTLEMENT_RETURN']).optional(),
});
export type ListMainFundEntriesQuery = z.infer<typeof listMainFundEntriesQuerySchema>;

/** Body for both `deposit` (money IN) and `withdraw` (money OUT) — same shape, different endpoint/direction. */
export const mainFundTransactionBodySchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero.'),
  note: z.string().trim().min(1, 'Note is required.'),
});
export type MainFundTransactionBody = z.infer<typeof mainFundTransactionBodySchema>;
