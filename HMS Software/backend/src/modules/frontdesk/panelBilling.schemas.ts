import { z } from 'zod';

export const panelPatientIdParamsSchema = z.object({
  panelPatientId: z.string().uuid(),
});

export const corporatePanelIdParamsSchema = z.object({
  corporatePanelId: z.string().uuid(),
});

export const contractResolutionQuerySchema = z.object({
  panelPatientId: z.string().uuid(),
  serviceRateId: z.string().uuid(),
  quantity: z.coerce.number().positive().default(1),
});
export type ContractResolutionQuery = z.infer<typeof contractResolutionQuerySchema>;

export const panelStatementQuerySchema = z.object({
  panelPatientId: z.string().uuid().optional(),
});
export type PanelStatementQuery = z.infer<typeof panelStatementQuerySchema>;

export const recordPanelRemittanceSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE']),
  reference: z.string().max(100).optional(),
  remarks: z.string().max(1000).optional(),
  receivedAt: z.coerce.date().optional(),
  /**
   * Explicit per-department-invoice allocation (mirrors admission billing's
   * §2.11 payment allocation). When omitted, the amount is auto-allocated
   * proportionally to each invoice's current outstanding panel receivable.
   */
  allocations: z
    .array(
      z.object({
        hospitalInvoiceId: z.string().uuid(),
        amount: z.coerce.number().positive(),
      }),
    )
    .optional(),
});
export type RecordPanelRemittanceBody = z.infer<typeof recordPanelRemittanceSchema>;
