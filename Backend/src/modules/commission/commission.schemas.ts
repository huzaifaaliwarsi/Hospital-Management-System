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
  // v7.2 Doctor Commission Tax (HMS_V7.2_NEW_REQUIREMENTS.md §2.7) —
  // independent of any salary tax; effective-dated via this same rule.
  commissionTaxMethod: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  commissionTaxValue: z.coerce.number().nonnegative().optional().nullable(),
}).superRefine((v, ctx) => {
  if (v.ruleType === 'PERCENTAGE' && v.rate > 100) ctx.addIssue({ code: 'custom', path: ['rate'], message: 'Commission percentage cannot exceed 100' });
  if (v.effectiveTo && v.effectiveTo <= v.effectiveFrom) ctx.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'End must be after start' });
  if (v.commissionTaxMethod && v.commissionTaxValue == null) ctx.addIssue({ code: 'custom', path: ['commissionTaxValue'], message: 'Tax value is required' });
  if (v.commissionTaxMethod === 'PERCENTAGE' && (v.commissionTaxValue ?? 0) > 100) ctx.addIssue({ code: 'custom', path: ['commissionTaxValue'], message: 'Tax percentage cannot exceed 100' });
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

export const accrualIdParamsSchema = z.object({ id: z.string().uuid() });

export const payAccrualBodySchema = z.object({
  amount: z.coerce.number().positive().multipleOf(0.01),
  method: z.enum(['CASH', 'CARD', 'BANK', 'ONLINE']),
  reference: z.string().max(200).optional(),
});
export type PayAccrualBody = z.infer<typeof payAccrualBodySchema>;

export const financialAdjustmentSchema = z.object({
  amount: z.coerce.number().refine(v => v !== 0 && Number.isFinite(v) && Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, 'Use a nonzero amount with at most two decimal places'),
  reason: z.string().trim().min(3).max(1000),
});

export const commissionRunFiltersSchema = z.object({
  periodType: z.enum(['DAILY', 'MONTHLY', 'CUSTOM']),
  periodStart: z.coerce.date(), periodEnd: z.coerce.date(),
  departmentId: z.string().uuid().optional(), staffId: z.string().uuid().optional(), serviceRateId: z.string().uuid().optional(),
}).refine(v => v.periodEnd >= v.periodStart, 'End must not precede start')
  .refine(v => v.periodType !== 'DAILY' || v.periodStart.toISOString().slice(0, 10) === v.periodEnd.toISOString().slice(0, 10), 'Daily runs must use one date');
export type CommissionRunFilters = z.infer<typeof commissionRunFiltersSchema>;
