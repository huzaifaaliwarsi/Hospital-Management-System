import { z } from 'zod';

export const idParamsSchema = z.object({ id: z.string().uuid() });

export const createExpenseBodySchema = z.object({
  category: z.string().min(1).max(80),
  date: z.coerce.date(),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(['CASH', 'CARD', 'ONLINE']),
  payeeOrVendor: z.string().max(150).optional(),
  description: z.string().min(1).max(500),
  referenceNo: z.string().max(100).optional(),
  attachmentUrl: z.string().url().optional(),
});
export type CreateExpenseBody = z.infer<typeof createExpenseBodySchema>;

export const listExpensesQuerySchema = z.object({
  category: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;

export const approveExpenseBodySchema = z.object({});
