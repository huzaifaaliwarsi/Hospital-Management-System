import { z } from 'zod';
import { PORTAL_ROLES } from '@/config/constants';

export const createUserBodySchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Letters, numbers, dot, hyphen, underscore only'),
  email: z.string().email().optional(),
  fullName: z.string().min(1).max(150),
  phone: z.string().max(30).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(PORTAL_ROLES),
});
export type CreateUserBody = z.infer<typeof createUserBodySchema>;

export const updateUserStatusBodySchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']),
});
export type UpdateUserStatusBody = z.infer<typeof updateUserStatusBodySchema>;

export const resetPasswordBodySchema = z.object({
  newPassword: z.string().min(8),
});
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

export const userIdParamsSchema = z.object({ id: z.string().uuid() });
