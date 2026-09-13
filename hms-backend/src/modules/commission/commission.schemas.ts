import { z } from 'zod';

export const commissionRuleIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createCommissionRuleSchema = z.object({
  staffId: z.string().uuid(),
  serviceRateId: z.string().uuid().optional().nullable(),
  ruleType: z.enum(['FIXED_PER_SERVICE', 'PERCENTAGE']),
  rate: z.coerce.number().positive(),
  basis: z.enum(['GROSS', 'NET']).default('NET'),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

export type CreateCommissionRuleBody = z.infer<typeof createCommissionRuleSchema>;

export const listCommissionRulesQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
  serviceRateId: z.string().uuid().optional(),
});

export type ListCommissionRulesQuery = z.infer<typeof listCommissionRulesQuerySchema>;

export const listAccrualsQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
  status: z.enum(['ACCRUED', 'GENERATED', 'APPROVED', 'PARTIALLY_PAID', 'PAID']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type ListAccrualsQuery = z.infer<typeof listAccrualsQuerySchema>;
