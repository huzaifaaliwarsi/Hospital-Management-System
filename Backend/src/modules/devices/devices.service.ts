import { createHash, timingSafeEqual } from 'crypto';
import type { BiometricDevice, Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { AuthenticationError, ConflictError, NotFoundError, ValidationError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger';
import { attendanceDay, dateOffset, parseDeviceTime, shiftForDate } from './deviceTime';
import type { UpsertDeviceInput, CreateStaffMappingInput, PunchIngestInput } from './devices.schemas';

export type DeviceCredentials = { secret?: string; ip?: string };
const hashSecret = (secret: string) => 'sha256:' + createHash('sha256').update(secret).digest('hex');
function publicDevice(device: BiometricDevice) {
  const { sharedSecretEncrypted, ...safe } = device;
  return { ...safe, hasSharedSecret: !!sharedSecretEncrypted };
}
function allowedIps() {
  return (process.env.BIOMETRIC_ALLOWED_IPS ?? '').split(',').map(s => s.trim().replace(/^::ffff:/, '')).filter(Boolean);
}

export class DevicesService {
  async authenticateDevice(serial: string, credentials: DeviceCredentials, protocol?: string) {
    const device = await prisma.biometricDevice.findUnique({ where: { deviceSerial: serial } });
    if (!device?.isEnabled) throw new AuthenticationError('Unknown or disabled biometric terminal');
    if (protocol && device.protocol !== protocol) throw new AuthenticationError('Device protocol does not match configuration');
    if (device.authMode === 'SHARED_SECRET') {
      const saved = device.sharedSecretEncrypted;
      if (!saved || !credentials.secret) throw new AuthenticationError('Device shared secret required');
      const expected = saved.startsWith('sha256:') ? saved : hashSecret(saved);
      const actual = hashSecret(credentials.secret);
      if (actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new AuthenticationError('Invalid device credentials');
    } else if (device.authMode === 'DEVICE_SERIAL' && device.protocol === 'HTTP_ADMS') {
      const ip = credentials.ip?.replace(/^::ffff:/, '');
      if (!ip || !allowedIps().includes(ip)) throw new AuthenticationError('ADMS source IP is not allowlisted');
    } else throw new AuthenticationError('Configure supported device authentication');
    return device;
  }

  async getDeviceOverview() {
    const device = await prisma.biometricDevice.findFirst({ orderBy: { createdAt: 'desc' } });
    const where = { deviceId: device?.id ?? '__none__' };
    const [totalStaff, mappedStaff, totalPunches, unmappedPunches, pendingPunches, errorPunches, recentPunches] = await Promise.all([
      prisma.staff.count({ where: { isActive: true } }),
      prisma.staffBiometricIdentity.count({ where: { ...where, isActive: true } }),
      prisma.biometricRawPunch.count({ where }),
      prisma.biometricRawPunch.count({ where: { ...where, processingStatus: 'UNMAPPED' } }),
      prisma.biometricRawPunch.count({ where: { ...where, processingStatus: 'RECEIVED' } }),
      prisma.biometricRawPunch.count({ where: { ...where, processingStatus: 'ERROR' } }),
      prisma.biometricRawPunch.findMany({ where, take: 10, orderBy: { receivedAt: 'desc' }, include: { staff: { select: { id: true, fullName: true, employeeId: true } } } }),
    ]);
    const lastActivity = Math.max(device?.lastPushAt?.getTime() ?? 0, device?.lastSeenAt?.getTime() ?? 0);
    const derivedStatus = !device ? 'NEVER_CONNECTED' : !device.isEnabled ? 'DISABLED' : !lastActivity ? 'NEVER_CONNECTED' : Date.now() - lastActivity <= 10 * 60000 ? 'ONLINE' : 'STALE';
    return {
      device: device ? publicDevice(device) : null,
      counts: { totalStaff, mappedStaff, totalPunches, unmappedPunches, pendingPunches, errorPunches },
      recentPunches, derivedStatus,
      connection: { admsPath: '/iclock/cdata', jsonPath: '/api/v1/attendance/punch-ingest', serialIpAllowlistConfigured: allowedIps().length > 0 },
    };
  }

  async upsertDevice(input: UpsertDeviceInput) {
    const existing = input.id
      ? await prisma.biometricDevice.findUnique({ where: { id: input.id } })
      : await prisma.biometricDevice.findUnique({ where: { deviceSerial: input.deviceSerial } });
    if (input.id && !existing) throw new NotFoundError('Device not found');
    if (existing && existing.deviceSerial !== input.deviceSerial && await prisma.biometricRawPunch.count({ where: { deviceId: existing.id } })) {
      throw new ConflictError('A terminal with punch history cannot change serial number; register a new terminal');
    }
    const previousSecret = existing?.sharedSecretEncrypted;
    const savedSecret = input.sharedSecret ? hashSecret(input.sharedSecret) : previousSecret ? (previousSecret.startsWith('sha256:') ? previousSecret : hashSecret(previousSecret)) : null;
    if (input.authMode === 'SHARED_SECRET' && !savedSecret) throw new ValidationError('Set a shared secret of at least 24 characters');
    const data = { name: input.name, brandModel: input.brandModel || null, deviceSerial: input.deviceSerial,
      protocol: input.protocol, timezone: input.timezone, isEnabled: input.isEnabled,
      authMode: input.authMode, sharedSecretEncrypted: savedSecret ?? null };
    return publicDevice(existing
      ? await prisma.biometricDevice.update({ where: { id: existing.id }, data })
      : await prisma.biometricDevice.create({ data }));
  }

  async listMappings(deviceId?: string) {
    return prisma.staffBiometricIdentity.findMany({
      where: { deviceId, isActive: true }, orderBy: { createdAt: 'desc' },
      include: { staff: { select: { id: true, fullName: true, employeeId: true, designation: true, isActive: true } },
        device: { select: { id: true, name: true, deviceSerial: true } } },
    });
  }

  async createOrUpdateMapping(input: CreateStaffMappingInput) {
    const device = input.deviceId ? await prisma.biometricDevice.findUnique({ where: { id: input.deviceId } })
      : await prisma.biometricDevice.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!device) throw new NotFoundError('Register a device first');
    const staff = await prisma.staff.findUnique({ where: { id: input.staffId }, select: { id: true, isActive: true } });
    if (!staff?.isActive) throw new ValidationError('Select an active staff member');
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM biometric_devices WHERE id = ${device.id} FOR UPDATE`;
      const existing = await tx.staffBiometricIdentity.findUnique({ where: { deviceId_enrollNumber: { deviceId: device.id, enrollNumber: input.enrollNumber } } });
      if (existing && existing.staffId !== staff.id) throw new ConflictError('Enrollment number already belongs to another staff member; do not reuse historical enrollment IDs');
      const mapping = await tx.staffBiometricIdentity.upsert({
        where: { deviceId_enrollNumber: { deviceId: device.id, enrollNumber: input.enrollNumber } },
        create: { deviceId: device.id, staffId: staff.id, enrollNumber: input.enrollNumber }, update: { isActive: true, effectiveTo: null },
        include: { staff: { select: { id: true, fullName: true, employeeId: true, isActive: true } }, device: { select: { id: true, name: true, deviceSerial: true } } },
      });
      await tx.biometricRawPunch.updateMany({ where: { deviceId: device.id, enrollNumber: input.enrollNumber, staffId: null },
        data: { staffId: staff.id, processingStatus: 'RECEIVED', errorMessage: null } });
      return mapping;
    });
    await this.processPending(device.id);
    return result;
  }

  async deleteMapping(mappingId: string) {
    const mapping = await prisma.staffBiometricIdentity.findUnique({ where: { id: mappingId } });
    if (!mapping) throw new NotFoundError('Biometric mapping not found');
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM biometric_devices WHERE id = ${mapping.deviceId} FOR UPDATE`;
      await tx.staffBiometricIdentity.update({ where: { id: mappingId }, data: { isActive: false, effectiveTo: new Date() } });
    });
    return { success: true };
  }
  async getUnmappedPunches(deviceId?: string) {
    return prisma.biometricRawPunch.findMany({ where: { deviceId, processingStatus: 'UNMAPPED' }, orderBy: { punchAt: 'desc' }, take: 100 });
  }
  async heartbeat(device: BiometricDevice) {
    await prisma.biometricDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  }

  async ingestPunches(input: PunchIngestInput, device: BiometricDevice) {
    if (device.deviceSerial !== input.deviceSerial) throw new AuthenticationError('Device identity mismatch');
    const parsed = input.events.map(event => {
      const punchAt = parseDeviceTime(event.punchTime, device.timezone);
      if (punchAt.getTime() > Date.now() + 10 * 60000) throw new ValidationError('Device clock is ahead of server time; correct the terminal clock');
      const punchType = event.punchType ?? 'AUTO';
      const eventHash = createHash('sha256').update(`${device.deviceSerial}:${event.enrollNumber}:${punchAt.toISOString()}:${punchType}`).digest('hex');
      return { event, punchAt, punchType, eventHash };
    });
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM biometric_devices WHERE id = ${device.id} FOR UPDATE`;
      const current = await tx.biometricDevice.findUniqueOrThrow({ where: { id: device.id } });
      if (!current.isEnabled) throw new AuthenticationError('Device disabled');
      const mappings = await tx.staffBiometricIdentity.findMany({ where: { deviceId: device.id, enrollNumber: { in: parsed.map(p => p.event.enrollNumber) }, isActive: true, staff: { isActive: true } } });
      const existing = await tx.biometricRawPunch.findMany({ where: { eventHash: { in: parsed.map(p => p.eventHash) } }, select: { eventHash: true } });
      const seen = new Set(existing.map(p => p.eventHash));
      const rows: Prisma.BiometricRawPunchCreateManyInput[] = [];
      let unmapped = 0;
      for (const p of parsed) {
        if (seen.has(p.eventHash)) continue;
        seen.add(p.eventHash);
        const mapping = mappings.find(m => m.enrollNumber === p.event.enrollNumber && (!m.effectiveFrom || p.punchAt >= m.effectiveFrom) && (!m.effectiveTo || p.punchAt <= m.effectiveTo));
        if (!mapping) unmapped++;
        rows.push({ deviceId: device.id, deviceSerial: device.deviceSerial, enrollNumber: p.event.enrollNumber,
          staffId: mapping?.staffId, deviceSource: device.protocol, punchAt: p.punchAt, punchType: p.punchType,
          verificationType: p.event.verificationType ?? 'OTHER', rawPayload: p.event,
          eventHash: p.eventHash, processingStatus: mapping ? 'RECEIVED' : 'UNMAPPED' });
      }
      const created = rows.length ? await tx.biometricRawPunch.createMany({ data: rows, skipDuplicates: true }) : { count: 0 };
      await tx.biometricDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date(), lastPushAt: new Date(), lastPushStatus: 'SUCCESS',
        lastPushMessage: `${created.count} stored, ${input.events.length - created.count} duplicate, ${unmapped} unmapped` } });
      return { accepted: created.count, duplicates: input.events.length - created.count, unmapped };
    }, { timeout: 15000 });
    // Acknowledge durable raw events even when a later normalization attempt fails.
    try { await this.processPending(device.id); } catch { logger.error('Biometric queue will retry pending punches', { deviceId: device.id }); }
    return { success: true, totalReceived: input.events.length, ...result };
  }

  async processPending(deviceId?: string) {
    const rows = await prisma.biometricRawPunch.findMany({
      where: { deviceId, staffId: { not: null }, processingStatus: { in: ['RECEIVED', 'ERROR'] } },
      orderBy: [{ lastAttemptAt: { sort: 'asc', nulls: 'first' } }, { receivedAt: 'asc' }, { id: 'asc' }], take: 100, select: { id: true, staffId: true, punchAt: true },
    });
    const profile = await prisma.hospitalProfile.findFirst({ select: { timezone: true } });
    const timezone = profile?.timezone || 'Asia/Karachi';
    let processed = 0, failed = 0;
    const seen = new Set<string>();
    const deadline = Date.now() + 20000;
    for (const row of rows) {
      if (!row.staffId || Date.now() > deadline) break;
      try {
        const staff = await prisma.staff.findUniqueOrThrow({ where: { id: row.staffId }, include: { assignedShift: true, weeklySchedule: true } });
        const date = attendanceDay(row.punchAt, staff, timezone);
        const key = staff.id + ':' + date;
        if (seen.has(key)) continue;
        seen.add(key);
        await this.normalizeStaffDateAttendance(staff.id, date, timezone);
        processed++;
      } catch (error) {
        failed++;
        await prisma.biometricRawPunch.update({ where: { id: row.id }, data: { processingStatus: 'ERROR',
          errorMessage: error instanceof ValidationError ? error.message : 'Attendance processing failed; retry or contact administrator',
          lastAttemptAt: new Date() } });
        logger.error('Biometric normalization failed', { punchId: row.id, staffId: row.staffId });
      }
    }
    return { processed, failed, scanned: rows.length };
  }

  async normalizeStaffDateAttendance(staffId: string, date: string, timezone: string) {
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM staff WHERE id = ${staffId} FOR UPDATE`;
      const staff = await tx.staff.findUniqueOrThrow({ where: { id: staffId }, include: { assignedShift: true, weeklySchedule: true } });
      if (!staff.isActive) throw new ValidationError('Staff member is inactive');
      const window = shiftForDate(staff, date, timezone);
      const candidates = await tx.biometricRawPunch.findMany({ where: { staffId, punchAt: {
        gte: parseDeviceTime(date + ' 00:00:00', timezone), lt: parseDeviceTime(dateOffset(date, 2) + ' 00:00:00', timezone),
      } }, orderBy: [{ punchAt: 'asc' }, { id: 'asc' }] });
      const punches = candidates.filter(p => {
        try { return attendanceDay(p.punchAt, staff, timezone) === date; } catch { return false; }
      });
      if (!punches.length) return;
      if (!window) throw new ValidationError('Punches fall on a non-working day; review attendance manually');
      const attendanceDate = new Date(date + 'T00:00:00Z');
      const existing = await tx.attendanceRecord.findUnique({ where: { staffId_attendanceDate: { staffId, attendanceDate } } });
      if (existing && (existing.source !== 'DEVICE' || existing.isApproved)) {
        await tx.biometricRawPunch.updateMany({ where: { id: { in: punches.map(p => p.id) } }, data: { processingStatus: 'NORMALIZED', errorMessage: 'Manual or approved attendance preserved; punches retained for review', lastAttemptAt: new Date() } });
        return;
      }
      const first = punches.find(p => p.punchType === 'CHECK_IN' || p.punchType === 'AUTO' || !p.punchType);
      if (!first) throw new ValidationError('Check-out received without check-in; awaiting earlier punch');
      const outs = punches.filter(p => p.punchAt > first.punchAt && (p.punchType === 'CHECK_OUT' || p.punchType === 'AUTO' || !p.punchType));
      const last = outs[outs.length - 1];
      const actualIn = first.punchAt;
      const actualOut = last && (last.punchType === 'CHECK_OUT' || last.punchAt.getTime() - actualIn.getTime() >= 5 * 60000) ? last.punchAt : null;
      let breakMinutes = 0, breakStart: Date | null = null;
      for (const punch of punches) {
        if (punch.punchAt < actualIn || (actualOut && punch.punchAt > actualOut)) continue;
        if (punch.punchType === 'BREAK_OUT' && !breakStart) breakStart = punch.punchAt;
        if (punch.punchType === 'BREAK_IN' && breakStart) { breakMinutes += (punch.punchAt.getTime() - breakStart.getTime()) / 60000; breakStart = null; }
      }
      if (breakStart && actualOut) breakMinutes += (actualOut.getTime() - breakStart.getTime()) / 60000;
      const workedMinutes = actualOut ? Math.max(0, Math.floor((actualOut.getTime() - actualIn.getTime()) / 60000 - breakMinutes)) : 0;
      const data = {
        actualIn, actualOut, workedMinutes, status: !actualOut ? 'MISSING_PUNCH' : workedMinutes < 240 ? 'HALF_DAY' : 'PRESENT', source: 'DEVICE' as const,
        shiftName: existing?.shiftName ?? window.name, shiftStart: existing?.shiftStart ?? window.start, shiftEnd: existing?.shiftEnd ?? window.end,
        lateMinutes: Math.max(0, Math.floor((actualIn.getTime() - (existing?.shiftStart ?? window.start).getTime()) / 60000) - window.grace),
        earlyExitMinutes: actualOut ? Math.max(0, Math.floor(((existing?.shiftEnd ?? window.end).getTime() - actualOut.getTime()) / 60000) - window.tolerance) : 0,
      } satisfies Prisma.AttendanceRecordUpdateInput;
      if (existing) {
        const updated = await tx.attendanceRecord.updateMany({
          where: { id: existing.id, source: 'DEVICE', isApproved: false, updatedAt: existing.updatedAt }, data,
        });
        if (updated.count !== 1) throw new ConflictError('Attendance changed during normalization; retry with the latest record');
      } else await tx.attendanceRecord.create({ data: { ...data, staffId, attendanceDate } });
      await tx.biometricRawPunch.updateMany({ where: { id: { in: punches.map(p => p.id) } }, data: { processingStatus: 'NORMALIZED', errorMessage: null, lastAttemptAt: new Date() } });
    }, { timeout: 15000 });
  }
}
export const devicesService = new DevicesService();
