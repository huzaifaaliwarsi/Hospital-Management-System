import { z } from 'zod';

export const idParamsSchema = z.object({ id: z.string().uuid() });

export const createUnitBodySchema = z.object({
  name: z.string().min(1).max(40),
  shortCode: z.string().max(10).optional(),
});
export type CreateUnitBody = z.infer<typeof createUnitBodySchema>;

export const updateUnitBodySchema = z.object({
  shortCode: z.string().max(10).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUnitBody = z.infer<typeof updateUnitBodySchema>;

export const listUnitsQuerySchema = z.object({
  includeInactive: z.coerce.boolean().default(false),
});
export type ListUnitsQuery = z.infer<typeof listUnitsQuerySchema>;
