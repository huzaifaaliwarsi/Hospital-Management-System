import { z } from 'zod';
import { PORTAL_ROLES } from '@/config/constants';
import { paginationQuerySchema } from '@/shared/pagination';

const usernameSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores');

const passwordSchema = z.string().min(8).max(100);

/**
 * Portal (login) account provisioning — deliberately separate from the HR
 * `Staff` record (`staff.schemas.ts`). `staffId` is optional: a login can
 * exist standalone (e.g. a root Super Admin with no HR record) or be
 * attached to an existing Staff member, mirroring `PortalUser.staffId`
 * being nullable in the schema.
 */
export const createPortalUserBodySchema = z.object({
  staffId: z.string().uuid().optional(),
  fullName: z.string().min(1).max(150),
  phone: z.string().max(30).optional(),
  username: usernameSchema,
  email: z.string().email().optional(),
  password: passwordSchema,
  role: z.enum(PORTAL_ROLES),
  isCashHandling: z.boolean().optional(),
});
export type CreatePortalUserBody = z.infer<typeof createPortalUserBodySchema>;

// Username is intentionally not editable post-creation — it is the audit
// trail / login identity anchor across every `createdBy`/`updatedBy` string
// elsewhere in the system.
export const updatePortalUserBodySchema = z.object({
  fullName: z.string().min(1).max(150).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  role: z.enum(PORTAL_ROLES).optional(),
  isCashHandling: z.boolean().optional(),
});
export type UpdatePortalUserBody = z.infer<typeof updatePortalUserBodySchema>;

export const resetPortalUserPasswordBodySchema = z.object({
  newPassword: passwordSchema,
});
export type ResetPortalUserPasswordBody = z.infer<typeof resetPortalUserPasswordBodySchema>;

export const updatePortalUserStatusBodySchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.string().optional(),
});
export type UpdatePortalUserStatusBody = z.infer<typeof updatePortalUserStatusBodySchema>;

export const listPortalUsersQuerySchema = paginationQuerySchema.extend({
  // Comma-separated role filter, e.g. `roles=SUPER_ADMIN,ADMIN` for the
  // "Admin Users" screen vs the remaining operational roles for "Staff Users".
  roles: z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (!val) return undefined;
      const parsed = val.split(',').map((r) => r.trim());
      const invalid = parsed.filter((r) => !PORTAL_ROLES.includes(r as (typeof PORTAL_ROLES)[number]));
      if (invalid.length > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown role(s): ${invalid.join(', ')}` });
        return z.NEVER;
      }
      return parsed as (typeof PORTAL_ROLES)[number][];
    }),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  search: z.string().optional(), // matches username / email / linked staff full name
});
export type ListPortalUsersQuery = z.infer<typeof listPortalUsersQuerySchema>;

export const portalUserIdParamsSchema = z.object({ id: z.string().uuid() });
