import { z } from 'zod';

export const admissionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createPlannedAdmissionSchema = z.object({
  panelPatientId: z.string().uuid().optional(),
  selfPayEncounterId: z.string().uuid().optional(),
  newSelfPayPatient: z
    .object({
      fullName: z.string().min(1).max(150),
      guardianName: z.string().max(150).optional(),
      gender: z.string().optional(),
      dob: z.coerce.date().optional(),
      cnicOrPassport: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  departmentId: z.string().uuid(),
  doctorStaffId: z.string().uuid(),
  preferredBedId: z.string().uuid().optional(),
  expectedAt: z.coerce.date().optional(),
  diagnosis: z.string().optional(),
  estimatedAmount: z.coerce.number().nonnegative().optional(),
  medicationMode: z.enum(['SELF', 'HOSPITAL_MANAGED']).default('SELF'),
  notes: z.string().optional(),
}).refine(
  (data) => data.panelPatientId || data.selfPayEncounterId || data.newSelfPayPatient,
  { message: 'Either panelPatientId, selfPayEncounterId, or newSelfPayPatient is required' },
);

export type CreatePlannedAdmissionBody = z.infer<typeof createPlannedAdmissionSchema>;

export const updatePlannedAdmissionSchema = z.object({
  departmentId: z.string().uuid().optional(),
  doctorStaffId: z.string().uuid().optional(),
  expectedAt: z.coerce.date().optional(),
  diagnosis: z.string().optional(),
  estimatedAmount: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export type UpdatePlannedAdmissionBody = z.infer<typeof updatePlannedAdmissionSchema>;

export const checkInAdmissionSchema = z.object({
  bedId: z.string().uuid(),
  notes: z.string().optional(),
});

export type CheckInAdmissionBody = z.infer<typeof checkInAdmissionSchema>;

export const requestPaymentSchema = z.object({
  requestType: z.enum(['ADVANCE', 'PARTIAL', 'FINAL']).default('ADVANCE'),
  requestedAmount: z.coerce.number().positive('Requested amount must be greater than zero'),
  notes: z.string().optional(),
});

export type RequestPaymentBody = z.infer<typeof requestPaymentSchema>;

export const transferBedSchema = z.object({
  targetBedId: z.string().uuid(),
  reason: z.string().min(1, 'Reason for bed transfer is required'),
});

export type TransferBedBody = z.infer<typeof transferBedSchema>;

export const addAdmissionServiceSchema = z.object({
  serviceRateId: z.string().uuid(),
  quantity: z.coerce.number().positive().default(1),
  notes: z.string().optional(),
  performedByStaffId: z.string().uuid().optional(),
});

export type AddAdmissionServiceBody = z.infer<typeof addAdmissionServiceSchema>;

export const changeMedicationModeSchema = z.object({
  mode: z.enum(['SELF', 'HOSPITAL_MANAGED']),
  reason: z.string().min(1, 'Reason for medication mode change is required'),
});

export type ChangeMedicationModeBody = z.infer<typeof changeMedicationModeSchema>;

export const createPharmacyRequestSchema = z.object({
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        medicineId: z.string().uuid(),
        requestedQuantity: z.coerce.number().positive('Quantity must be greater than zero'),
        notes: z.string().optional(),
      }),
    )
    .min(1, 'At least one medicine item must be requested'),
});

export type CreatePharmacyRequestBody = z.infer<typeof createPharmacyRequestSchema>;

export const grantClearanceSchema = z.object({
  clearanceType: z.enum(['CLINICAL', 'HOSPITAL_BILLING', 'PHARMACY']),
  notes: z.string().optional(),
});

export type GrantClearanceBody = z.infer<typeof grantClearanceSchema>;

export const listAdmissionsQuerySchema = z.object({
  status: z
    .enum(['PLANNED', 'CONFIRMED', 'ACTIVE', 'DISCHARGE_PENDING', 'DISCHARGED', 'CANCELLED'])
    .optional(),
  departmentId: z.string().uuid().optional(),
  doctorStaffId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type ListAdmissionsQuery = z.infer<typeof listAdmissionsQuerySchema>;
