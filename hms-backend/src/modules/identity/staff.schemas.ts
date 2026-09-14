import { z } from 'zod';
import { normalizePhone } from '@/shared/validators';
import { paginationQuerySchema } from '@/shared/pagination';

const phoneSchema = z.string().transform((val, ctx) => {
  const normalized = normalizePhone(val);
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Phone must be a valid Pakistani mobile number (e.g. 0300-1234567)',
    });
    return z.NEVER;
  }
  return normalized;
});

/**
 * §4.1 Staff Master fields. `employeeId` is intentionally absent — it is
 * always system-generated (§16 Q-01), never client-supplied.
 */
export const createStaffBodySchema = z.object({
  fullName: z.string().min(1).max(150),
  fatherGuardianName: z.string().max(150).optional(),
  cnic: z.string().max(20).optional(),
  category: z.string().min(1).max(50),
  departmentId: z.string().uuid(),
  designation: z.string().min(1).max(100),
  phone: phoneSchema,
  alternatePhone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  joiningDate: z.coerce.date(),
  notes: z.string().optional(),
  // v7.2 (HMS_V7.2_NEW_REQUIREMENTS.md §2.3/§3.1) — only meaningful for Doctor-category staff.
  doctorSponsoredDiscountTrackingEnabled: z.boolean().optional(),
});
export type CreateStaffBody = z.infer<typeof createStaffBodySchema>;

export const updateStaffBodySchema = createStaffBodySchema.partial().extend({
  isActive: z.boolean().optional(),
  employmentStatus: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional(),
});
export type UpdateStaffBody = z.infer<typeof updateStaffBodySchema>;

export const listStaffQuerySchema = paginationQuerySchema.extend({
  departmentId: z.string().uuid().optional(),
  category: z.string().optional(),
  employmentStatus: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional(),
  search: z.string().optional(), // matches fullName / employeeId
});
export type ListStaffQuery = z.infer<typeof listStaffQuerySchema>;

export const staffIdParamsSchema = z.object({ id: z.string().uuid() });

export const deactivateStaffBodySchema = z
  .object({
    reason: z.string().optional(),
  })
  .optional()
  .default({});
export type DeactivateStaffBody = z.infer<typeof deactivateStaffBodySchema>;

// ── v7.2 Doctor Clinical Discharge Authorization (HMS_V7.2_NEW_REQUIREMENTS.md
// §2.4) — deliberately separate credential from portal login; a doctor may
// be "Staff Record Only" and still hold discharge authorization.
export const setClinicalAuthBodySchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, hyphens and underscores'),
  password: z.string().min(8).max(100),
});
export type SetClinicalAuthBody = z.infer<typeof setClinicalAuthBodySchema>;

export const resetClinicalAuthPasswordBodySchema = z.object({
  password: z.string().min(8).max(100),
});
export type ResetClinicalAuthPasswordBody = z.infer<typeof resetClinicalAuthPasswordBodySchema>;

// ── Salary Profile (Doctor financial setup, HMS_V7.2_NEW_REQUIREMENTS.md §2.7) ──
// Creating a new profile automatically closes out the previous current one
// (effectiveTo = new effectiveFrom) — same effective-dated-history pattern
// as `StaffEmploymentHistory`/`DoctorCommissionRule`.
export const createSalaryProfileBodySchema = z.object({
  salaryTemplateId: z.string().uuid().optional().nullable(),
  salaryBasis: z.enum(['MONTHLY', 'PER_DAY']),
  baseAmount: z.coerce.number().nonnegative(),
  payrollDivisor: z.coerce.number().int().positive().optional(),
  // Independent of Commission Tax on DoctorCommissionRule — see §2.7.
  salaryTaxMethod: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  salaryTaxValue: z.coerce.number().nonnegative().optional().nullable(),
  effectiveFrom: z.coerce.date(),
});
export type CreateSalaryProfileBody = z.infer<typeof createSalaryProfileBodySchema>;
