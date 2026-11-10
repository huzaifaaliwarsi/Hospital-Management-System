import { z } from 'zod';

export const loginBodySchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
