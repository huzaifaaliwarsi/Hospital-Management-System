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

export const deactivateStaffBodySchema = z.object({
  reason: z.string().optional(),
});
export type DeactivateStaffBody = z.infer<typeof deactivateStaffBodySchema>;
