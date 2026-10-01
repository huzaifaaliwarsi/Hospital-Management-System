import { z } from 'zod';

/** pharmacy.md §3 Settings screen — tax/discount, receipt, stock/expiry window, high-value approval. */
export const updatePharmacySettingsBodySchema = z.object({
  highValueApprovalEnabled: z.boolean().optional(),
  highValueThreshold: z.coerce.number().min(0).optional(),
  defaultTaxPercent: z.coerce.number().min(0).max(100).optional(),
  maxDiscountPercent: z.coerce.number().min(0).max(100).optional(),
  nearExpiryWindowDays: z.coerce.number().int().min(1).max(3650).optional(),
  receiptHeaderText: z.string().max(200).optional(),
  receiptFooterText: z.string().max(200).optional(),
});
export type UpdatePharmacySettingsBody = z.infer<typeof updatePharmacySettingsBodySchema>;
