import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { singleFlight } from '../src/shared/singleFlight';
const { db } = vi.hoisted(() => ({ db: {
  biometricRawPunch: { findMany: vi.fn(), update: vi.fn() },
  hospitalProfile: { findFirst: vi.fn() },
  staff: { findUniqueOrThrow: vi.fn() },
} }));
vi.mock('@/db/client', () => ({ prisma: db }));
import { devicesService } from '../src/modules/devices/devices.service';

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());
describe('background jobs', () => {
  it('coalesces overlapping cron calls, releases on error, and retries without cached success', async () => {
    let reject!: (error: Error) => void;
    let calls = 0;
    const run = singleFlight(() => {
      calls++;
      return calls === 1 ? new Promise<void>((_resolve, no) => { reject = no; }) : Promise.resolve();
    });
    const first = run(); expect(run()).toBe(first);
    await Promise.resolve(); reject(new Error('retry'));
    await expect(first).rejects.toThrow('retry');
    await run(); await run(); expect(calls).toBe(3);
  });
  it('empty biometric queue performs one query and no profile/staff reads', async () => {
    db.biometricRawPunch.findMany.mockResolvedValue([]);
    expect(await devicesService.processPending()).toEqual({ processed: 0, failed: 0, scanned: 0 });
    expect(db.hospitalProfile.findFirst).not.toHaveBeenCalled();
    expect(db.staff.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  it('nonempty biometric queues retain processing errors and retry metadata', async () => {
    db.biometricRawPunch.findMany.mockResolvedValue([{ id: 'synthetic-punch', staffId: 'synthetic-staff', punchAt: new Date() }]);
    db.hospitalProfile.findFirst.mockResolvedValue({ timezone: 'Asia/Karachi' });
    db.staff.findUniqueOrThrow.mockRejectedValue(new Error('synthetic retry'));
    db.biometricRawPunch.update.mockResolvedValue({});
    expect(await devicesService.processPending()).toEqual({ processed: 0, failed: 1, scanned: 1 });
    expect(db.biometricRawPunch.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ processingStatus: 'ERROR', lastAttemptAt: expect.any(Date) }) }));
  });
  it('nonempty biometric queues still normalize each staff/day once', async () => {
    db.biometricRawPunch.findMany.mockResolvedValue([
      { id: 'p1', staffId: 'staff', punchAt: new Date('2026-11-19T04:00:00Z') },
      { id: 'p2', staffId: 'staff', punchAt: new Date('2026-11-19T12:00:00Z') },
    ]);
    db.hospitalProfile.findFirst.mockResolvedValue({ timezone: 'Asia/Karachi' });
    db.staff.findUniqueOrThrow.mockResolvedValue({ id: 'staff', weeklySchedule: [], assignedShift: { startTime: '09:00', endTime: '17:00' } });
    const normalize = vi.spyOn(devicesService, 'normalizeStaffDateAttendance').mockResolvedValue(undefined);
    expect(await devicesService.processPending()).toEqual({ processed: 1, failed: 0, scanned: 2 });
    expect(normalize).toHaveBeenCalledTimes(1);
    expect(normalize).toHaveBeenCalledWith('staff', '2026-11-19', 'Asia/Karachi');
  });
});
