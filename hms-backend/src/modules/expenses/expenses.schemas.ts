import { z } from 'zod';

/** Must match the Prisma `ExpenseCategory` enum. */
export const EXPENSE_CATEGORIES = [
  'UTILITIES',
  'RENT',
  'MAINTENANCE_REPAIRS',
  'MEDICAL_SUPPLIES',
  'OFFICE_SUPPLIES',
  'EQUIPMENT',
  'CLEANING_SANITATION',
  'FOOD_REFRESHMENTS',
  'TRANSPORT',
  'MARKETING',
  'PROFESSIONAL_FEES',
  'MISCELLANEOUS',
] as const;

const category = z.enum(EXPENSE_CATEGORIES);
const paymentMethod = z.enum(['CASH', 'CARD', 'BANK', 'ONLINE']);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const expenseBodySchema = z.object({
  expenseDate: isoDate,
  category,
  amount: z.coerce.number().positive('Amount must be greater than zero').max(999_999_999),
  paymentMethod,
  paidTo: z.string().trim().min(1, 'Paid To is required').max(150),
  reference: optionalText(100),
  description: optionalText(500),
  departmentId: z.string().uuid().optional().nullable(),
});
export type ExpenseBody = z.infer<typeof expenseBodySchema>;

export const voidExpenseBodySchema = z.object({
  reason: z.string().trim().min(3, 'A void reason is required').max(300),
});
export type VoidExpenseBody = z.infer<typeof voidExpenseBodySchema>;

export const expenseIdParamsSchema = z.object({ id: z.string().uuid() });

/** List / Expense Report filters — From/To, Category, Payment Method, Entered By, Status. */
export const listExpensesQuerySchema = z.object({
  preset: z
    .enum(['all', 'today', 'yesterday', 'this_week', 'this_month', 'custom'])
    .default('this_month'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  category: category.optional(),
  paymentMethod: paymentMethod.optional(),
  createdById: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  /** Defaults to ACTIVE — voided entries only when asked for. */
  status: z.enum(['ACTIVE', 'VOID', 'ALL']).default('ACTIVE'),
});
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
