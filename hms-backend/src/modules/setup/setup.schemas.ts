import { z } from 'zod';

export const idParamsSchema = z.object({ id: z.string().uuid() });

// ── Hospital Profile ──────────────────────────────────────────────────
// Mirrors the full Super Admin "Hospital Overview" screen (frontend
// `types/hospital.ts`). `setup.service.ts` splits this onto the handful of
// first-class `HospitalProfile` columns plus the `billingLegalMetadata` /
// `extendedProfile` JSON blobs and reassembles the same shape on read —
// every field here is genuinely persisted, none are computed/fabricated.
const dayWorkingHoursSchema = z.object({
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  isOpen: z.boolean(),
  openTime: z.string(),
  closeTime: z.string(),
});

export const updateHospitalProfileSchema = z.object({
  name: z.string().max(200).optional(),
  shortName: z.string().max(50).optional(),
  logoUrl: z.string().optional(),
  hospitalType: z.string().max(100).optional(),
  registrationNumber: z.string().max(100).optional(),
  licenseNumber: z.string().max(100).optional(),
  accreditationBody: z.string().max(150).optional(),
  accreditationNumber: z.string().max(100).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),

  primaryPhone: z.string().max(30).optional(),
  alternatePhone: z.string().max(30).optional(),
  emergencyPhone: z.string().max(30).optional(),
  primaryEmail: z.string().email().optional().or(z.literal('')),
  secondaryEmail: z.string().email().optional().or(z.literal('')),
  website: z.string().max(200).optional(),

  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),

  currency: z.string().max(3).optional(),
  timezone: z.string().optional(),
  weekStartDay: z.string().optional(),
  workingMode: z.string().optional(),
  opdOpenTime: z.string().optional(),
  opdCloseTime: z.string().optional(),
  emergencyEnabled: z.boolean().optional(),
  emergencyMode: z.enum(['24/7', 'Custom Hours', '']).optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(),
  workingHours: z.array(dayWorkingHoursSchema).optional(),

  legalBusinessName: z.string().max(200).optional(),
  taxNumber: z.string().max(100).optional(),
  salesTaxNumber: z.string().max(100).optional(),
  billingAddress: z.string().max(300).optional(),
  invoicePhone: z.string().max(30).optional(),
  invoiceEmail: z.string().email().optional().or(z.literal('')),
  invoicePrefix: z.string().max(20).optional(),
  receiptPrefix: z.string().max(20).optional(),

  printHeaderConfig: z.record(z.string(), z.unknown()).optional(),
  printFooterConfig: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateHospitalProfileBody = z.infer<typeof updateHospitalProfileSchema>;

// ── Departments ──────────────────────────────────────────────────────
export const createDepartmentSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  headStaffId: z.string().uuid().optional(),
  departmentType: z.enum([
    'CLINICAL',
    'SURGICAL',
    'DIAGNOSTIC',
    'EMERGENCY',
    'PHARMACY',
    'ADMINISTRATIVE',
    'SUPPORT_SERVICE',
    'OTHER',
  ]),
  contactExtension: z.string().max(20).optional(),
  location: z.string().max(200).optional(),
  supportsOpd: z.boolean().optional(),
  supportsObservation: z.boolean().optional(),
  supportsEmergency: z.boolean().optional(),
  supportsAdmission: z.boolean().optional(),
  pharmacyRelated: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type CreateDepartmentBody = z.infer<typeof createDepartmentSchema>;
export const updateDepartmentSchema = createDepartmentSchema.partial();
export type UpdateDepartmentBody = z.infer<typeof updateDepartmentSchema>;

// ── Service Rates ────────────────────────────────────────────────────
export const createServiceRateSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  departmentId: z.string().uuid(),
  category: z.string().optional(),
  billingUnit: z.string().min(1).max(30),
  standardRate: z.coerce.number().nonnegative(),
  panelEligible: z.boolean().optional(),
  discountAllowed: z.boolean().optional(),
  manualRateOverrideAllowed: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type CreateServiceRateBody = z.infer<typeof createServiceRateSchema>;
export const updateServiceRateSchema = createServiceRateSchema.partial();
export type UpdateServiceRateBody = z.infer<typeof updateServiceRateSchema>;

// ── Wards / Rooms / Beds ─────────────────────────────────────────────
export const createWardSchema = z.object({
  code: z.string().max(20).optional(),
  departmentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  wardType: z.string().optional(),
  genderPolicy: z.string().optional(),
  floor: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});
export type CreateWardBody = z.infer<typeof createWardSchema>;
export const updateWardSchema = createWardSchema.partial();
export type UpdateWardBody = z.infer<typeof updateWardSchema>;

export const createRoomSchema = z.object({
  code: z.string().max(20).optional(),
  wardId: z.string().uuid(),
  roomNumber: z.string().max(20).optional(),
  name: z.string().min(1).max(100),
  roomType: z.string().optional(),
  floor: z.string().max(50).optional(),
  capacity: z.coerce.number().int().nonnegative().optional(),
  dailyRoomRate: z.coerce.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});
export type CreateRoomBody = z.infer<typeof createRoomSchema>;
export const updateRoomSchema = createRoomSchema.partial();
export type UpdateRoomBody = z.infer<typeof updateRoomSchema>;

export const createBedSchema = z.object({
  code: z.string().max(20).optional(),
  roomId: z.string().uuid(),
  bedNumber: z.string().min(1).max(20),
  bedType: z.string().optional(),
  dailyRate: z.coerce.number().nonnegative().optional(),
  operationalStatus: z.enum(['ACTIVE', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE', 'DECOMMISSIONED']).optional(),
});
export type CreateBedBody = z.infer<typeof createBedSchema>;
export const updateBedSchema = z.object({
  code: z.string().max(20).optional(),
  bedNumber: z.string().min(1).max(20).optional(),
  bedType: z.string().optional(),
  dailyRate: z.coerce.number().nonnegative().optional(),
  // AVAILABLE / RESERVED / OCCUPIED / OUT_OF_SERVICE ("Under Maintenance") — occupancy, owned by Admission workflow.
  status: z.enum(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'OUT_OF_SERVICE']).optional(),
  // Orthogonal: whether the bed itself is fit for use right now.
  operationalStatus: z.enum(['ACTIVE', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE', 'DECOMMISSIONED']).optional(),
});
export type UpdateBedBody = z.infer<typeof updateBedSchema>;

// ── Corporate Panels ─────────────────────────────────────────────────
export const createCorporatePanelSchema = z.object({
  code: z.string().max(20).optional(),
  organizationName: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
  discountAgreement: z.string().max(300).optional(),
  contact: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  creditLimit: z.coerce.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});
export type CreateCorporatePanelBody = z.infer<typeof createCorporatePanelSchema>;
export const updateCorporatePanelSchema = createCorporatePanelSchema.partial();
export type UpdateCorporatePanelBody = z.infer<typeof updateCorporatePanelSchema>;

export const discountRuleSchema = z.object({
  serviceRateId: z.string().uuid(),
  discountPercent: z.coerce.number().min(0).max(100),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
});
export const replaceDiscountRulesSchema = z.object({
  rules: z.array(discountRuleSchema),
});
export type ReplaceDiscountRulesBody = z.infer<typeof replaceDiscountRulesSchema>;

// ── Shifts (Shift Master) ────────────────────────────────────────────
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeSchema = z.string().regex(TIME_REGEX, 'Time must be in HH:mm 24-hour format');
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export const createShiftSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  departmentId: z.string().uuid(),
  shiftType: z.enum(['MORNING', 'EVENING', 'NIGHT', 'CUSTOM']).default('CUSTOM'),
  startTime: timeSchema,
  endTime: timeSchema,
  breakMinutes: z.coerce.number().int().min(0).default(0),
  defaultArrivalGraceMinutes: z.coerce.number().int().min(0).default(0),
  defaultEarlyExitToleranceMinutes: z.coerce.number().int().min(0).default(0),
  defaultWeeklyOffDays: z.array(z.enum(WEEKDAYS)).default([]),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type CreateShiftBody = z.infer<typeof createShiftSchema>;
export const updateShiftSchema = createShiftSchema.partial();
export type UpdateShiftBody = z.infer<typeof updateShiftSchema>;
