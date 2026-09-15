import { z } from 'zod';

export const submitSettlementSchema = z.object({
  physicalCash: z.coerce.number().nonnegative('Counted physical cash cannot be negative'),
  handoverAmount: z.coerce.number().nonnegative().optional(),
  varianceReason: z.string().optional(),
  remarks: z.string().optional(),
});

export type SubmitSettlementBody = z.infer<typeof submitSettlementSchema>;
