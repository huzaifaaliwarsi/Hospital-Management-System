import { z } from 'zod';

export const idParamsSchema = z.object({ id: z.string().uuid() });

// ── Hospital Profile ──────────────────────────────────────────────────
export const updateHospitalProfileSchema = z.object({
  name: z.string().max(200).optional(),
  contactPhone: z.string().max(30).optional(),
  contactEmail: z.string().email().optional(),
  address: z.string().optional(),
  workingHours: z.string().optional(),
  logoUrl: z.string().url().optional(),
  billingLegalMetadata: z.record(z.string(), z.unknown()).optional(), // NTN, license no., etc.
  printHeaderConfig: z.record(z.string(), z.unknown()).optional(),
  printFooterConfig: z.record(z.string(), z.unknown()).optional(),
  currencyCode: z.string().length(3).optional(),
  roundingMode: z.string().optional(),
  timezone: z.string().optional(),
});
export type UpdateHospitalProfileBody = z.infer<typeof updateHospitalProfileSchema>;

// ── Departments ──────────────────────────────────────────────────────
export const createDepartmentSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
  headStaffId: z.string().uuid().optional(),
  departmentType: z.enum(['CLINICAL', 'ADMINISTRATIVE']),
  supportsOpd: z.boolean().optional(),
  supportsAdmission: z.boolean().optional(),
});
export type CreateDepartmentBody = z.infer<typeof createDepartmentSchema>;
export const updateDepartmentSchema = createDepartmentSchema.partial();
export type UpdateDepartmentBody = z.infer<typeof updateDepartmentSchema>;

// ── Service Rates ────────────────────────────────────────────────────
export const createServiceRateSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
  departmentId: z.string().uuid(),
  category: z.string().optional(),
  billingUnit: z.string().min(1).max(30),
  standardRate: z.coerce.number().nonnegative(),
  panelEligible: z.boolean().optional(),
  discountAllowed: z.boolean().optional(),
  manualRateOverrideAllowed: z.boolean().optional(),
});
export type CreateServiceRateBody = z.infer<typeof createServiceRateSchema>;
export const updateServiceRateSchema = createServiceRateSchema.partial();
export type UpdateServiceRateBody = z.infer<typeof updateServiceRateSchema>;

// ── Wards / Rooms / Beds ─────────────────────────────────────────────
export const createWardSchema = z.object({
  departmentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  wardType: z.string().optional(),
});
export type CreateWardBody = z.infer<typeof createWardSchema>;
export const updateWardSchema = createWardSchema.partial();

export const createRoomSchema = z.object({
  wardId: z.string().uuid(),
  name: z.string().min(1).max(100),
  roomType: z.string().optional(),
});
export type CreateRoomBody = z.infer<typeof createRoomSchema>;
export const updateRoomSchema = createRoomSchema.partial();

export const createBedSchema = z.object({
  roomId: z.string().uuid(),
  bedNumber: z.string().min(1).max(20),
  dailyRate: z.coerce.number().nonnegative().optional(),
});
export type CreateBedBody = z.infer<typeof createBedSchema>;
export const updateBedSchema = z.object({
  bedNumber: z.string().min(1).max(20).optional(),
  dailyRate: z.coerce.number().nonnegative().optional(),
  // AVAILABLE / RESERVED / OCCUPIED / OUT_OF_SERVICE ("Under Maintenance")
  status: z.enum(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'OUT_OF_SERVICE']).optional(),
});
export type UpdateBedBody = z.infer<typeof updateBedSchema>;

// ── Corporate Panels ─────────────────────────────────────────────────
export const createCorporatePanelSchema = z.object({
  organizationName: z.string().min(1).max(200),
  contact: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  creditLimit: z.coerce.number().nonnegative().optional(),
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
