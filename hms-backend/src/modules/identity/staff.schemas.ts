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

const cnicSchema = z
  .string()
  .trim()
  .regex(/^\d{5}-\d{7}-\d{1}$/, 'CNIC must follow format xxxxx-xxxxxxx-x');

/** staff.md §2 — the fixed Staff Category list. Still a plain string column, not a DB enum. */
export const STAFF_CATEGORIES = [
  'Doctor',
  'RMO',
  'Front Desk / Billing',
  'Admission',
  'Inventory Management',
  'Nurse',
  'Technician',
  'Other Staff',
] as const;

const uniqueUuidArray = (label: string) =>
  z
    .array(z.string().uuid())
    .refine((arr) => new Set(arr).size === arr.length, { message: `Duplicate ${label} in the same request` });

/**
 * §4.1 Staff Master fields, rebuilt to the short-form contract (staff.md §2).
 * `employeeId` is intentionally absent — always system-generated.
 * Only fullName / fatherGuardianName / cnic / dateOfBirth / category / phone
 * are mandatory; everything else is optional and deferred to Staff 360.
 */
export const createStaffBodySchema = z
  .object({
    fullName: z.string().min(1).max(150),
    fatherGuardianName: z.string().min(1).max(150),
    cnic: cnicSchema,
    dateOfBirth: z.coerce.date(),
    category: z.enum(STAFF_CATEGORIES),
    phone: phoneSchema,

    // Doctor-only, mandatory when category === 'Doctor' (enforced below).
    departmentIds: uniqueUuidArray('department').optional(),
    serviceIds: uniqueUuidArray('service').optional(),

    // Everything below is optional / deferred to Staff 360.
    designation: z.string().max(100).optional(),
    alternatePhone: z.string().max(30).optional(),
    email: z.string().email().optional(),
    joiningDate: z.coerce.date().optional(),
    notes: z.string().optional(),
    assignedShiftId: z.string().uuid().optional(),
    doctorSponsoredDiscountTrackingEnabled: z.boolean().optional(),
    availableForOpd: z.boolean().optional(),
    availableForObservation: z.boolean().optional(),
    availableForEmergency: z.boolean().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.category === 'Doctor') {
      if (!body.departmentIds || body.departmentIds.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Doctor requires at least one Clinical Department', path: ['departmentIds'] });
      }
      if (!body.serviceIds || body.serviceIds.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Doctor requires at least one Assigned Service', path: ['serviceIds'] });
      }
    }
  });
export type CreateStaffBody = z.infer<typeof createStaffBodySchema>;

const updateStaffBaseSchema = z.object({
  fullName: z.string().min(1).max(150).optional(),
  fatherGuardianName: z.string().min(1).max(150).optional(),
  cnic: cnicSchema.optional(),
  dateOfBirth: z.coerce.date().optional(),
  category: z.enum(STAFF_CATEGORIES).optional(),
  phone: phoneSchema.optional(),
  departmentIds: uniqueUuidArray('department').optional(),
  serviceIds: uniqueUuidArray('service').optional(),
  designation: z.string().max(100).optional(),
  alternatePhone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  joiningDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  assignedShiftId: z.string().uuid().nullable().optional(),
  doctorSponsoredDiscountTrackingEnabled: z.boolean().optional(),
  availableForOpd: z.boolean().optional(),
  availableForObservation: z.boolean().optional(),
  availableForEmergency: z.boolean().optional(),
  isActive: z.boolean().optional(),
  employmentStatus: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional(),
});
export const updateStaffBodySchema = updateStaffBaseSchema.superRefine((body, ctx) => {
  if (body.category === 'Doctor') {
    if (body.departmentIds && body.departmentIds.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Doctor requires at least one Clinical Department', path: ['departmentIds'] });
    }
    if (body.serviceIds && body.serviceIds.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Doctor requires at least one Assigned Service', path: ['serviceIds'] });
    }
  }
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
// staff.md §9 — the guide's 4 required Salary Types. "+ Commission" is a
// label only — commission itself is always calculated separately and
// automatically from DoctorCommissionRule, never folded into this figure.
export const SALARY_BASIS_VALUES = ['MONTHLY', 'MONTHLY_COMMISSION', 'PER_DAY', 'PER_DAY_COMMISSION'] as const;

export const createSalaryProfileBodySchema = z.object({
  salaryTemplateId: z.string().uuid().optional().nullable(),
  salaryBasis: z.enum(SALARY_BASIS_VALUES),
  baseAmount: z.coerce.number().nonnegative(),
  payrollDivisor: z.coerce.number().int().positive().optional(),
  // Independent of Commission Tax on DoctorCommissionRule — see §2.7.
  salaryTaxMethod: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  salaryTaxValue: z.coerce.number().nonnegative().optional().nullable(),
  effectiveFrom: z.coerce.date(),
});
export type CreateSalaryProfileBody = z.infer<typeof createSalaryProfileBodySchema>;
