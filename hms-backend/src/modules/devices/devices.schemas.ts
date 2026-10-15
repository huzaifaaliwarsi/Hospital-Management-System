import { z } from 'zod';

export const upsertDeviceSchema = z.object({
  name: z.string().trim().min(2, 'Device name is required (min 2 characters)'),
  brandModel: z.string().trim().optional().nullable(),
  deviceSerial: z.string().trim().min(3, 'Device serial number is required'),
  protocol: z.string().default('HTTP_ADMS'),
  timezone: z.string().default('Asia/Karachi'),
  isEnabled: z.boolean().default(true),
  authMode: z.string().default('DEVICE_SERIAL'),
  sharedSecret: z.string().trim().optional().nullable(),
});

export type UpsertDeviceInput = z.infer<typeof upsertDeviceSchema>;

export const createStaffMappingSchema = z.object({
  staffId: z.string().uuid('Valid Staff ID is required'),
  enrollNumber: z.string().trim().min(1, 'Biometric enroll number is required'),
  deviceId: z.string().uuid().optional(),
});

export type CreateStaffMappingInput = z.infer<typeof createStaffMappingSchema>;

export const punchEventSchema = z.object({
  enrollNumber: z.string().trim().min(1, 'Enroll number is required'),
  punchTime: z.string().datetime({ offset: true }).or(z.string().min(10)),
  punchType: z.enum(['CHECK_IN', 'CHECK_OUT', 'BREAK_OUT', 'BREAK_IN', 'AUTO']).optional(),
  verificationType: z.enum(['FINGERPRINT', 'FACE', 'CARD', 'PASSWORD', 'OTHER']).optional(),
  deviceEventId: z.string().optional(),
});

export const punchIngestSchema = z.object({
  deviceSerial: z.string().trim().min(1, 'Device serial is required'),
  events: z.array(punchEventSchema).min(1, 'At least one punch event is required'),
});

export type PunchIngestInput = z.infer<typeof punchIngestSchema>;
