import { z } from 'zod';

export const upsertDeviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  brandModel: z.string().trim().max(100).optional().nullable(),
  deviceSerial: z.string().trim().regex(/^[A-Za-z0-9_-]{3,80}$/, 'Use the exact alphanumeric device serial'),
  protocol: z.enum(['HTTP_ADMS', 'CLOUD_SERVER']).default('HTTP_ADMS'),
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Invalid timezone').default('Asia/Karachi'),
  isEnabled: z.boolean().default(true),
  authMode: z.enum(['DEVICE_SERIAL', 'SHARED_SECRET']).default('DEVICE_SERIAL'),
  sharedSecret: z.string().min(24).max(256).optional(),
}).refine(v => v.protocol !== 'CLOUD_SERVER' || v.authMode === 'SHARED_SECRET', 'JSON push requires shared-secret authentication');

export type UpsertDeviceInput = z.infer<typeof upsertDeviceSchema>;
export const createStaffMappingSchema = z.object({
  staffId: z.string().uuid(),
  enrollNumber: z.string().trim().min(1).max(64),
  deviceId: z.string().uuid().optional(),
});
export type CreateStaffMappingInput = z.infer<typeof createStaffMappingSchema>;
export const punchEventSchema = z.object({
  enrollNumber: z.string().trim().min(1).max(64),
  punchTime: z.string().min(19).max(40),
  punchType: z.enum(['CHECK_IN', 'CHECK_OUT', 'BREAK_OUT', 'BREAK_IN', 'AUTO']).optional(),
  verificationType: z.enum(['FINGERPRINT', 'FACE', 'CARD', 'PASSWORD', 'OTHER']).optional(),
  deviceEventId: z.string().max(128).optional(),
  rawRecord: z.string().max(2048).optional(),
  deviceStatus: z.string().max(16).optional(),
  deviceVerify: z.string().max(16).optional(),
});
export const punchIngestSchema = z.object({
  deviceSerial: z.string().trim().min(1).max(80),
  events: z.array(punchEventSchema).min(1).max(1000),
});
export type PunchIngestInput = z.infer<typeof punchIngestSchema>;
