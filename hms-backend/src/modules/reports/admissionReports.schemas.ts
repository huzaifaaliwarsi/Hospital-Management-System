import { z } from 'zod';

const dateRangeSchema = z.object({
  preset: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'custom']).default('today'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const admissionDailySummaryQuerySchema = dateRangeSchema.extend({
  departmentId: z.string().uuid().optional(),
});
export type AdmissionDailySummaryQuery = z.infer<typeof admissionDailySummaryQuerySchema>;

export const admissionRegisterQuerySchema = dateRangeSchema.extend({
  departmentId: z.string().uuid().optional(),
  doctorStaffId: z.string().uuid().optional(),
  wardId: z.string().uuid().optional(),
  status: z.enum(['PLANNED', 'CONFIRMED', 'ACTIVE', 'DISCHARGE_PENDING', 'DISCHARGED', 'CANCELLED']).optional(),
  payerType: z.enum(['PANEL', 'SELF_PAY']).optional(),
});
export type AdmissionRegisterQuery = z.infer<typeof admissionRegisterQuerySchema>;

export const inpatientCensusQuerySchema = z.object({
  asOf: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  wardId: z.string().uuid().optional(),
});
export type InpatientCensusQuery = z.infer<typeof inpatientCensusQuerySchema>;

export const bedOccupancyQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  wardId: z.string().uuid().optional(),
});
export type BedOccupancyQuery = z.infer<typeof bedOccupancyQuerySchema>;

export const bedTransferHistoryQuerySchema = dateRangeSchema.extend({
  admissionRecordId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
});
export type BedTransferHistoryQuery = z.infer<typeof bedTransferHistoryQuerySchema>;

export const lengthOfStayQuerySchema = dateRangeSchema.extend({
  departmentId: z.string().uuid().optional(),
  doctorStaffId: z.string().uuid().optional(),
  status: z.enum(['PLANNED', 'CONFIRMED', 'ACTIVE', 'DISCHARGE_PENDING', 'DISCHARGED', 'CANCELLED']).optional(),
});
export type LengthOfStayQuery = z.infer<typeof lengthOfStayQuerySchema>;

export const admissionRecordIdParamsSchema = z.object({ admissionRecordId: z.string().uuid() });

export const serviceConsumptionQuerySchema = dateRangeSchema.extend({
  departmentId: z.string().uuid().optional(),
});
export type ServiceConsumptionQuery = z.infer<typeof serviceConsumptionQuerySchema>;

export const inpatientOutstandingQuerySchema = dateRangeSchema.extend({
  departmentId: z.string().uuid().optional(),
  payerType: z.enum(['PANEL', 'SELF_PAY']).optional(),
  status: z.enum(['PLANNED', 'CONFIRMED', 'ACTIVE', 'DISCHARGE_PENDING', 'DISCHARGED', 'CANCELLED']).optional(),
});
export type InpatientOutstandingQuery = z.infer<typeof inpatientOutstandingQuerySchema>;

export const dischargeClearanceQuerySchema = dateRangeSchema.extend({
  departmentId: z.string().uuid().optional(),
  wardId: z.string().uuid().optional(),
});
export type DischargeClearanceQuery = z.infer<typeof dischargeClearanceQuerySchema>;
