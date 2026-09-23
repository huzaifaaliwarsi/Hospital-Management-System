import { z } from 'zod';
import { normalizeCnic, normalizePhone } from '@/shared/validators';

const cnicSchema = z.string().transform((val, ctx) => {
  const normalized = normalizeCnic(val);
  if (!normalized) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CNIC must be a valid 13-digit number (XXXXX-XXXXXXX-X)' });
    return z.NEVER;
  }
  return normalized;
});

const phoneSchema = z.string().transform((val, ctx) => {
  const normalized = normalizePhone(val);
  if (!normalized) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Phone must be a valid Pakistani mobile number (03XX-XXXXXXX)' });
    return z.NEVER;
  }
  return normalized;
});

export const checkDuplicateQuerySchema = z
  .object({
    cnic: z.string().optional(),
    phone: z.string().optional(),
  })
  .refine((v) => v.cnic || v.phone, { message: 'Provide at least one of cnic or phone' });
export type CheckDuplicateQuery = z.infer<typeof checkDuplicateQuerySchema>;

/** Permanent, reusable identity — always tied to a Corporate Panel (D16 p.7). */
export const createPanelPatientSchema = z.object({
  fullName: z.string().min(1).max(150),
  guardianName: z.string().optional(),
  guardianRelation: z.string().optional(),
  gender: z.string().optional(),
  dob: z.coerce.date().optional(),
  cnicOrPassport: cnicSchema.optional(),
  phone: phoneSchema.optional(),
  alternatePhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECEASED']).optional(),
  corporatePanelId: z.string().uuid(),
  panelMemberId: z.string().trim().max(150).nullable().optional(),
  membershipStatus: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
  membershipValidFrom: z.string().date().transform(value => new Date(value)).nullable().optional(),
  membershipValidTo: z.string().date().transform(value => new Date(value)).nullable().optional(),
  policyNumber: z.string().trim().max(150).nullable().optional(),
  planName: z.string().trim().max(150).nullable().optional(),
  principalMemberName: z.string().trim().max(150).nullable().optional(),
  memberRelationship: z.string().trim().max(100).nullable().optional(),
});
export type CreatePanelPatientBody = z.infer<typeof createPanelPatientSchema>;
export const updatePanelPatientSchema = createPanelPatientSchema.partial();
export type UpdatePanelPatientBody = z.infer<typeof updatePanelPatientSchema>;

export const listPanelPatientsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECEASED']).optional(),
  corporatePanelId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export type ListPanelPatientsQuery = z.infer<typeof listPanelPatientsQuerySchema>;

/** Temporary, per-visit identity — never reused for future visits (D16 p.7). */
export const createSelfPayEncounterSchema = z.object({
  fullName: z.string().min(1).max(150),
  guardianName: z.string().optional(),
  gender: z.string().optional(),
  dob: z.coerce.date().optional(),
  cnicOrPassport: cnicSchema.optional(),
  phone: phoneSchema.optional(),
  address: z.string().optional(),
});
export type CreateSelfPayEncounterBody = z.infer<typeof createSelfPayEncounterSchema>;

export const idParamsSchema = z.object({ id: z.string().uuid() });
