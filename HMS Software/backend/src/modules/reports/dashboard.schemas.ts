import { z } from 'zod';

export const getSuperAdminDashboardQuerySchema = z.object({
  preset: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'custom']).default('today'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export type GetSuperAdminDashboardQuery = z.infer<typeof getSuperAdminDashboardQuerySchema>;
