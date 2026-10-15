import { createHash } from 'crypto';
import { prisma } from '@/db/client';
import { NotFoundError, BadRequestError } from '@/shared/errors/AppError';
import { logger } from '@/shared/logger';
import type { UpsertDeviceInput, CreateStaffMappingInput, PunchIngestInput } from './devices.schemas';

export class DevicesService {
  /**
   * Fetch primary biometric device overview with operational aggregates.
   */
  async getDeviceOverview() {
    const device = await prisma.biometricDevice.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            staffMappings: true,
            rawPunches: true,
          },
        },
      },
    });

    const totalStaffCount = await prisma.staff.count({
      where: { isActive: true },
    });

    const unmappedPunchesCount = await prisma.biometricRawPunch.count({
      where: { processingStatus: 'UNMAPPED' },
    });

    const recentPunches = await prisma.biometricRawPunch.findMany({
      take: 10,
      orderBy: { punchAt: 'desc' },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeId: true,
          },
        },
      },
    });

    if (!device) {
      return {
        device: null,
        counts: {
          totalStaff: totalStaffCount,
          mappedStaff: 0,
          unmappedPunches: unmappedPunchesCount,
        },
        recentPunches: [],
        derivedStatus: 'NEVER_CONNECTED' as const,
      };
    }

    // Determine derived operational health status
    let derivedStatus: 'ONLINE' | 'STALE' | 'NEVER_CONNECTED' | 'DISABLED' = 'NEVER_CONNECTED';
    if (!device.isEnabled) {
      derivedStatus = 'DISABLED';
    } else if (!device.lastPushAt && !device.lastSeenAt) {
      derivedStatus = 'NEVER_CONNECTED';
    } else {
      const lastActivity = device.lastPushAt || device.lastSeenAt;
      const minutesAgo = (Date.now() - new Date(lastActivity!).getTime()) / (1000 * 60);
      derivedStatus = minutesAgo <= 60 ? 'ONLINE' : 'STALE';
    }

    return {
      device,
      counts: {
        totalStaff: totalStaffCount,
        mappedStaff: device._count.staffMappings,
        totalPunches: device._count.rawPunches,
        unmappedPunches: unmappedPunchesCount,
      },
      recentPunches,
      derivedStatus,
    };
  }

  /**
   * Register or update the biometric terminal settings.
   */
  async upsertDevice(input: UpsertDeviceInput) {
    const existing = await prisma.biometricDevice.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const updated = await prisma.biometricDevice.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          brandModel: input.brandModel || null,
          deviceSerial: input.deviceSerial,
          protocol: input.protocol,
          timezone: input.timezone,
          isEnabled: input.isEnabled,
          authMode: input.authMode,
          sharedSecretEncrypted: input.sharedSecret || null,
        },
      });
      return updated;
    }

    const created = await prisma.biometricDevice.create({
      data: {
        name: input.name,
        brandModel: input.brandModel || null,
        deviceSerial: input.deviceSerial,
        protocol: input.protocol,
        timezone: input.timezone,
        isEnabled: input.isEnabled,
        authMode: input.authMode,
        sharedSecretEncrypted: input.sharedSecret || null,
      },
    });
    return created;
  }

  /**
   * List explicit staff ↔ biometric enroll mappings.
   */
  async listMappings(deviceId?: string) {
    const where: any = {};
    if (deviceId) where.deviceId = deviceId;

    const mappings = await prisma.staffBiometricIdentity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeId: true,
            designation: true,
            isActive: true,
          },
        },
        device: {
          select: {
            id: true,
            name: true,
            deviceSerial: true,
          },
        },
      },
    });

    return mappings;
  }

  /**
   * Create or update explicit Staff ↔ Enroll mapping.
   */
  async createOrUpdateMapping(input: CreateStaffMappingInput) {
    let deviceId = input.deviceId;
    if (!deviceId) {
      const device = await prisma.biometricDevice.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      if (!device) {
        throw new BadRequestError('No biometric device registered yet. Please register a device first.');
      }
      deviceId = device.id;
    }

    const staff = await prisma.staff.findUnique({
      where: { id: input.staffId },
      select: { id: true, fullName: true, employeeId: true },
    });
    if (!staff) {
      throw new NotFoundError('Staff member not found.');
    }

    // Upsert explicit mapping
    const mapping = await prisma.staffBiometricIdentity.upsert({
      where: {
        deviceId_enrollNumber: {
          deviceId,
          enrollNumber: input.enrollNumber,
        },
      },
      update: {
        staffId: input.staffId,
        isActive: true,
      },
      create: {
        deviceId,
        staffId: input.staffId,
        enrollNumber: input.enrollNumber,
        isActive: true,
      },
      include: {
        staff: true,
        device: true,
      },
    });

    // Auto-resolve any previous UNMAPPED punches with this enrollNumber
    const unmappedPunches = await prisma.biometricRawPunch.findMany({
      where: {
        enrollNumber: input.enrollNumber,
        staffId: null,
      },
      select: { id: true, punchAt: true },
    });

    if (unmappedPunches.length > 0) {
      await prisma.biometricRawPunch.updateMany({
        where: {
          enrollNumber: input.enrollNumber,
          staffId: null,
        },
        data: {
          staffId: input.staffId,
          processingStatus: 'RECEIVED',
        },
      });

      // Group punch dates and normalize
      const dates = new Set<string>();
      for (const p of unmappedPunches) {
        dates.add(p.punchAt.toISOString().slice(0, 10));
      }
      for (const dateStr of dates) {
        await this.normalizeStaffDateAttendance(input.staffId, new Date(dateStr)).catch(err =>
          logger.error('Error normalizing re-mapped attendance', { err, staffId: input.staffId, dateStr }),
        );
      }
    }

    return mapping;
  }

  /**
   * Delete an existing mapping.
   */
  async deleteMapping(mappingId: string) {
    const mapping = await prisma.staffBiometricIdentity.findUnique({
      where: { id: mappingId },
    });
    if (!mapping) {
      throw new NotFoundError('Biometric mapping not found.');
    }

    await prisma.staffBiometricIdentity.delete({
      where: { id: mappingId },
    });

    return { success: true };
  }

  /**
   * Fetch unmapped raw punches for administrative review.
   */
  async getUnmappedPunches() {
    const unmapped = await prisma.biometricRawPunch.findMany({
      where: { processingStatus: 'UNMAPPED' },
      orderBy: { punchAt: 'desc' },
      take: 100,
    });
    return unmapped;
  }

  /**
   * Core HTTP Ingestion Engine (POST /api/v1/attendance/punch-ingest).
   * Validates device, hashes event for idempotency, maps staff, stores raw, and triggers normalization.
   */
  async ingestPunches(input: PunchIngestInput) {
    const device = await prisma.biometricDevice.findUnique({
      where: { deviceSerial: input.deviceSerial },
    });

    if (!device) {
      throw new NotFoundError(`Device with serial ${input.deviceSerial} is not registered.`);
    }

    if (!device.isEnabled) {
      throw new BadRequestError(`Device ${device.name} (${device.deviceSerial}) is disabled in HMS.`);
    }

    let accepted = 0;
    let duplicates = 0;
    const affectedStaffDates = new Map<string, Set<string>>();

    for (const evt of input.events) {
      const punchDate = new Date(evt.punchTime);
      if (isNaN(punchDate.getTime())) {
        continue;
      }

      const punchType = evt.punchType || 'AUTO';
      const eventHash = createHash('sha256')
        .update(`${input.deviceSerial}:${evt.enrollNumber}:${punchDate.toISOString()}:${punchType}`)
        .digest('hex');

      // Check idempotency
      const existing = await prisma.biometricRawPunch.findUnique({
        where: { eventHash },
        select: { id: true },
      });

      if (existing) {
        duplicates++;
        continue;
      }

      // Check explicit staff mapping
      const mapping = await prisma.staffBiometricIdentity.findUnique({
        where: {
          deviceId_enrollNumber: {
            deviceId: device.id,
            enrollNumber: evt.enrollNumber,
          },
        },
        select: { staffId: true, isActive: true },
      });

      const staffId = mapping && mapping.isActive ? mapping.staffId : null;
      const processingStatus = staffId ? 'RECEIVED' : 'UNMAPPED';

      await prisma.biometricRawPunch.create({
        data: {
          deviceId: device.id,
          deviceSerial: input.deviceSerial,
          enrollNumber: evt.enrollNumber,
          staffId,
          deviceSource: 'HTTP_ADMS',
          punchAt: punchDate,
          punchType,
          verificationType: evt.verificationType || 'FINGERPRINT',
          rawPayload: evt as any,
          eventHash,
          processingStatus,
        },
      });

      accepted++;

      if (staffId) {
        const dateStr = punchDate.toISOString().slice(0, 10);
        if (!affectedStaffDates.has(staffId)) {
          affectedStaffDates.set(staffId, new Set<string>());
        }
        affectedStaffDates.get(staffId)!.add(dateStr);
      }
    }

    // Update device health timestamps
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        lastPushAt: new Date(),
        lastPushStatus: 'SUCCESS',
        lastPushMessage: `Received ${input.events.length} punches (${accepted} accepted, ${duplicates} duplicates)`,
      },
    });

    // Run shift normalization for all affected staff members
    for (const [staffId, dates] of affectedStaffDates.entries()) {
      for (const d of dates) {
        await this.normalizeStaffDateAttendance(staffId, new Date(d)).catch(err =>
          logger.error('Failed to normalize biometric attendance', { err, staffId, date: d }),
        );
      }
    }

    return {
      success: true,
      totalReceived: input.events.length,
      accepted,
      duplicates,
      unmapped: input.events.length - accepted - duplicates,
    };
  }

  /**
   * Step 8: Punch-to-Attendance Normalization Engine.
   * Calculates actualIn, actualOut, lateMinutes, earlyExitMinutes, and AttendanceStatus.
   */
  async normalizeStaffDateAttendance(staffId: string, targetDate: Date) {
    const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));

    // Fetch all punches for this staff member today
    const punches = await prisma.biometricRawPunch.findMany({
      where: {
        staffId,
        punchAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { punchAt: 'asc' },
    });

    if (punches.length === 0) return;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        assignedShift: true,
      },
    });

    if (!staff) return;

    const firstPunch = punches[0];
    const actualIn = firstPunch.punchAt;

    // Resolve timezone dynamically from device or hospital profile
    const [hospitalProfile, deviceRecord, defaultShift] = await Promise.all([
      prisma.hospitalProfile.findFirst({ select: { timezone: true } }),
      prisma.biometricDevice.findFirst({ select: { timezone: true } }),
      prisma.shift.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }).catch(() => null),
    ]);

    const targetTimezone = deviceRecord?.timezone || hospitalProfile?.timezone || 'Asia/Karachi';
    const tzOffsetMinutes = this.getTimezoneOffsetMinutes(actualIn, targetTimezone);

    // Shift timings (dynamically resolved from staff shift, hospital active shift, or operating schedule)
    const shiftStartHHMM = staff.assignedShift?.startTime || defaultShift?.startTime || '09:00';
    const shiftEndHHMM = staff.assignedShift?.endTime || defaultShift?.endTime || '17:00';
    const graceMinutes = staff.assignedShift?.graceMinutesIn ?? defaultShift?.graceMinutesIn ?? 15;
    const toleranceMinutes = staff.assignedShift?.toleranceMinutesOut ?? defaultShift?.toleranceMinutesOut ?? 15;

    let actualOut: Date | null = null;
    if (punches.length > 1) {
      const lastPunch = punches[punches.length - 1];
      const diffMs = lastPunch.punchAt.getTime() - actualIn.getTime();
      // Ensure it's not a double-bounce scan within 5 minutes
      if (diffMs >= 5 * 60 * 1000) {
        actualOut = lastPunch.punchAt;
      }
    }

    // Calculate Late Minutes dynamically
    const actualInLocalMinutes = actualIn.getUTCHours() * 60 + actualIn.getUTCMinutes() + tzOffsetMinutes;
    const [startH, startM] = shiftStartHHMM.split(':').map(Number);
    const [endH, endM] = shiftEndHHMM.split(':').map(Number);
    const scheduledStartMinutes = (startH || 9) * 60 + (startM || 0);

    let lateMinutes = 0;
    if (actualInLocalMinutes > scheduledStartMinutes + graceMinutes) {
      lateMinutes = actualInLocalMinutes - scheduledStartMinutes;
    }

    // Calculate Early Exit Minutes dynamically
    let earlyExitMinutes = 0;
    if (actualOut) {
      const actualOutLocalMinutes = actualOut.getUTCHours() * 60 + actualOut.getUTCMinutes() + tzOffsetMinutes;
      const scheduledEndMinutes = (endH || 17) * 60 + (endM || 0);
      if (actualOutLocalMinutes < scheduledEndMinutes - toleranceMinutes) {
        earlyExitMinutes = scheduledEndMinutes - actualOutLocalMinutes;
      }
    }

    // Determine status
    let status: 'PRESENT' | 'HALF_DAY' | 'MISSING_PUNCH' = 'PRESENT';
    if (!actualOut) {
      status = 'MISSING_PUNCH';
    } else {
      const workedHours = (actualOut.getTime() - actualIn.getTime()) / (1000 * 60 * 60);
      if (workedHours < 4) {
        status = 'HALF_DAY';
      }
    }

    // Check if AttendanceRecord already exists for this date
    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: {
        staffId,
        attendanceDate: startOfDay,
      },
    });

    if (existingRecord) {
      // If already manually marked by admin, do not overwrite manual status unless it was DEVICE
      if (existingRecord.source === 'DEVICE' || existingRecord.status === 'MISSING_PUNCH') {
        await prisma.attendanceRecord.update({
          where: { id: existingRecord.id },
          data: {
            actualIn,
            actualOut: actualOut || existingRecord.actualOut,
            lateMinutes,
            earlyExitMinutes,
            status,
            source: 'DEVICE',
          },
        });
      }
    } else {
      await prisma.attendanceRecord.create({
        data: {
          staffId,
          attendanceDate: startOfDay,
          shiftName: staff.assignedShift?.name || defaultShift?.name || 'Standard Day Shift',
          shiftStart: new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), startH || 9, startM || 0)),
          shiftEnd: new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), endH || 17, endM || 0)),
          actualIn,
          actualOut,
          lateMinutes,
          earlyExitMinutes,
          status,
          source: 'DEVICE',
        },
      });
    }

    // Update raw punches processing status to NORMALIZED
    await prisma.biometricRawPunch.updateMany({
      where: {
        id: { in: punches.map(p => p.id) },
      },
      data: {
        processingStatus: 'NORMALIZED',
      },
    });
  }

  private getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(date);
      const p: Record<string, string> = {};
      for (const part of parts) {
        p[part.type] = part.value;
      }
      const localDate = new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute, +p.second));
      return Math.round((localDate.getTime() - date.getTime()) / 60000);
    } catch {
      return 300;
    }
  }
}

export const devicesService = new DevicesService();
