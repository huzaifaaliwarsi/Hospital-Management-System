import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
const { db } = vi.hoisted(() => ({ db: {
  $queryRaw: vi.fn(),
  hospitalProfile: { findFirst: vi.fn() },
  admissionRecord: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  bed: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  bedTransferHistory: { findFirst: vi.fn(), create: vi.fn() },
  hospitalInvoice: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  invoiceLineItem: { create: vi.fn() },
  admissionRoomChargeLog: { findFirst: vi.fn(), create: vi.fn() },
  hospitalDayClose: { upsert: vi.fn(), findUnique: vi.fn() },
  serviceRate: { findFirst: vi.fn() },
} }));
vi.mock('@/db/client', () => ({ prisma: { ...db, $transaction: (fn: any) => fn(db) } }));
import { admissionService } from '../src/modules/admission/admission.service';
import { hospitalClock, postingTimeMinutes } from '../src/shared/hospitalClock';

let admission: any, invoice: any, bed: any, logs: any[];
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T11:00:00Z')); // 4 PM Karachi
  process.env.IPD_BILLING_SYSTEM_ACTOR_ID = 'system';
  admission = { id: 'ADM-1001', departmentId: 'dept', status: 'ACTIVE', bedId: 'bed', dischargeClearances: [{}] };
  invoice = { id: 'HINV-001', lines: [], paidTotal: new Decimal(0), total: new Decimal(0) };
  bed = { id: 'bed', bedNumber: 'B1', status: 'OCCUPIED', room: { id: 'room', name: 'Private Room', dailyRoomRate: new Decimal(500) } };
  logs = [];
  db.admissionRecord.findUnique.mockImplementation(async () => admission);
  db.admissionRecord.findMany.mockImplementation(async () => admission.status === 'ACTIVE' ? [admission] : []);
  db.admissionRecord.update.mockImplementation(async ({ data }) => Object.assign(admission, data));
  db.admissionRecord.updateMany.mockImplementation(async ({ data }) => { Object.assign(admission, data); return { count: 1 }; });
  db.bed.updateMany.mockResolvedValue({ count: 1 });
  db.bedTransferHistory.create.mockResolvedValue({ id: 'transfer' });
  db.bed.findUnique.mockImplementation(async () => bed);
  db.hospitalProfile.findFirst.mockResolvedValue({ extendedProfile: { ipdDailyRoomBedPostingTime: '11:00 AM' } });
  db.hospitalInvoice.findFirst.mockImplementation(async () => invoice);
  db.hospitalInvoice.findUniqueOrThrow.mockImplementation(async () => ({ ...invoice, lines: [...invoice.lines] }));
  db.hospitalInvoice.update.mockImplementation(async ({ data }) => Object.assign(invoice, data));
  db.invoiceLineItem.create.mockImplementation(async ({ data }) => { const line = { id: 'line-' + invoice.lines.length, ...data }; invoice.lines.push(line); return line; });
  db.admissionRoomChargeLog.findFirst.mockImplementation(async ({ where }) => logs.find(l => !where.businessDate || l.businessDate.getTime() === where.businessDate.getTime()));
  db.admissionRoomChargeLog.create.mockImplementation(async ({ data }) => { logs.push(data); return data; });
});
afterEach(() => { vi.useRealTimers(); delete process.env.IPD_BILLING_SYSTEM_ACTOR_ID; });

describe('daily IPD accommodation', () => {
  it('posts the first day immediately, three days on the same invoice, preserves payment, and stops after discharge', async () => {
    admission.status = 'PLANNED';
    await admissionService.checkInAdmission('ADM-1001', { bedId: 'bed' }, 'actor');
    expect(invoice.total.toNumber()).toBe(500);
    await admissionService.runScheduledRoomCharges();
    expect(invoice.lines).toHaveLength(1);
    vi.setSystemTime(new Date('2026-10-16T05:59:00Z'));
    await admissionService.runScheduledRoomCharges();
    expect(invoice.lines).toHaveLength(1);
    vi.setSystemTime(new Date('2026-10-16T06:00:00Z'));
    for (let i = 0; i < 4; i++) await admissionService.runScheduledRoomCharges();
    expect(invoice.total.toNumber()).toBe(1000);
    invoice.paidTotal = new Decimal(1000);
    vi.setSystemTime(new Date('2026-10-17T06:00:00Z'));
    await admissionService.runScheduledRoomCharges();
    expect(invoice.total.toNumber()).toBe(1500);
    expect(invoice.paidTotal.toNumber()).toBe(1000);
    expect(invoice.total.minus(invoice.paidTotal).toNumber()).toBe(500);
    expect(invoice.lines.every((l: any) => l.hospitalInvoiceId === 'HINV-001' && l.billingSource === 'ROOM_BED')).toBe(true);
    expect(logs.map(l => l.businessDate.toISOString().slice(0, 10))).toEqual(['2026-10-15', '2026-10-16', '2026-10-17']);
    admission.status = 'DISCHARGED';
    vi.setSystemTime(new Date('2026-10-18T06:00:00Z'));
    await admissionService.runScheduledRoomCharges();
    expect(invoice.lines).toHaveLength(3);
  });
  it('preserves snapshots and uses the current room tariff on the next date', async () => {
    admission.status = 'PLANNED';
    await admissionService.checkInAdmission('ADM-1001', { bedId: 'bed' }, 'actor');
    bed.room.dailyRoomRate = new Decimal(600);
    await admissionService.runScheduledRoomCharges();
    expect(invoice.lines).toHaveLength(1);
    vi.setSystemTime(new Date('2026-10-16T06:00:00Z'));
    await admissionService.runScheduledRoomCharges();
    expect(invoice.lines.map((l: any) => l.rateSnapshot.toNumber())).toEqual([500, 600]);
    expect(logs[0]).toMatchObject({ bedId: 'bed', roomId: 'room', postedBy: 'actor', bedAssignmentId: 'ADM-1001:initial:bed' });
  });
  it('retains the charged tariff on transfer and waits for the next posting time', async () => {
    admission.status = 'PLANNED';
    await admissionService.checkInAdmission('ADM-1001', { bedId: 'bed' }, 'actor');
    vi.setSystemTime(new Date('2026-10-16T04:00:00Z'));
    bed = { ...bed, id: 'bed2', bedNumber: 'B2', status: 'AVAILABLE', operationalStatus: 'ACTIVE', room: { id: 'room2', name: 'Executive', dailyRoomRate: new Decimal(600) } };
    await admissionService.transferBed('ADM-1001', { targetBedId: 'bed2', reason: 'Requested' }, 'actor');
    expect(invoice.lines).toHaveLength(1);
    expect(db.bedTransferHistory.create).toHaveBeenCalled();
    vi.setSystemTime(new Date('2026-10-16T06:00:00Z'));
    db.bedTransferHistory.findFirst.mockResolvedValue({ id: 'transfer' });
    await admissionService.runScheduledRoomCharges();
    expect(invoice.lines.map((l: any) => l.rateSnapshot.toNumber())).toEqual([500, 600]);
    expect(logs[1]).toMatchObject({ bedId: 'bed2', roomId: 'room2', bedAssignmentId: 'transfer' });
  });
  it('charges a first billable assignment immediately when transferring from a free bed', async () => {
    bed = { ...bed, id: 'bed2', status: 'AVAILABLE', operationalStatus: 'ACTIVE' };
    vi.setSystemTime(new Date('2026-10-15T04:00:00Z'));
    await admissionService.transferBed('ADM-1001', { targetBedId: 'bed2', reason: 'Upgrade from free ward' }, 'actor');
    expect(invoice.total.toNumber()).toBe(500);
  });
  it('uses Karachi date across UTC midnight and validates posting times', () => {
    expect(hospitalClock(new Date('2026-10-15T19:01:00Z'))).toEqual({ date: '2026-10-16', minutes: 1 });
    expect(postingTimeMinutes('11:00 AM')).toBe(660);
    expect(postingTimeMinutes('23:59')).toBe(1439);
    expect(postingTimeMinutes('12:00 AM')).toBe(0);
    expect(() => postingTimeMinutes('25:00')).toThrow();
  });
  it('rejects backdated/future manual billing', async () => {
    await expect(admissionService.closeHospitalDay({ businessDate: '2026-10-14' }, 'actor')).rejects.toThrow('Only today');
    await expect(admissionService.closeHospitalDay({ businessDate: '2026-10-16' }, 'actor')).rejects.toThrow('Only today');
    expect(db.invoiceLineItem.create).not.toHaveBeenCalled();
  });
  it('rechecks status after locking so a discharged candidate cannot be charged', async () => {
    db.admissionRecord.findMany.mockResolvedValue([{ id: admission.id }]);
    admission.status = 'DISCHARGED';
    await admissionService.runScheduledRoomCharges();
    expect(db.invoiceLineItem.create).not.toHaveBeenCalled();
  });
});

