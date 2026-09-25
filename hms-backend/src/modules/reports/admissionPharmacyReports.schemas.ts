import { z } from 'zod';

const dateRangeSchema = z.object({
  preset: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'custom']).default('today'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const pharmacyRequestReportQuerySchema = dateRangeSchema.extend({
  admissionRecordId: z.string().uuid().optional(),
  medicineId: z.string().uuid().optional(),
  status: z
    .enum(['REQUESTED', 'ACCEPTED', 'PARTIALLY_FULFILLED', 'REJECTED', 'DISPENSING', 'DISPENSED', 'INVOICED', 'CLEARANCE_SENT', 'INTEGRATION_ERROR', 'AUTHORIZATION_REQUIRED'])
    .optional(),
});
export type PharmacyRequestReportQuery = z.infer<typeof pharmacyRequestReportQuerySchema>;

export const medicineFulfillmentQuerySchema = dateRangeSchema.extend({
  medicineId: z.string().uuid().optional(),
  admissionRecordId: z.string().uuid().optional(),
});
export type MedicineFulfillmentQuery = z.infer<typeof medicineFulfillmentQuerySchema>;

export const highValueApprovalQuerySchema = dateRangeSchema.extend({
  admissionRecordId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'AUTHORIZED', 'REJECTED']).optional(),
});
export type HighValueApprovalQuery = z.infer<typeof highValueApprovalQuerySchema>;

export const pharmacyClearanceStatusQuerySchema = dateRangeSchema.extend({
  departmentId: z.string().uuid().optional(),
});
export type PharmacyClearanceStatusQuery = z.infer<typeof pharmacyClearanceStatusQuerySchema>;
