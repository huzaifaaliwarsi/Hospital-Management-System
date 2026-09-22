import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const { tx, api } = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }, tx: {
  hospitalDayClose: { findUnique: vi.fn(), create: vi.fn() },
  admissionRecord: { findMany: vi.fn() },
  admissionRoomChargeLog: { findUnique: vi.fn(), create: vi.fn() },
  serviceRate: { findFirst: vi.fn() },
  invoiceLineItem: { create: vi.fn() },
  hospitalInvoice: { update: vi.fn() },
} }));
vi.mock('@/db/client', () => ({ prisma: { $transaction: (fn: any) => fn(tx) } }));
vi.mock('../../ch-sharif-and-saeed-hospital---hms/src/services/apiClient', () => ({ default: api }));
vi.mock('../../ch-sharif-and-saeed-hospital---hms/src/services/departmentService', () => ({ DepartmentService: {} }));
import { WardsRoomsBedsService } from '../../ch-sharif-and-saeed-hospital---hms/src/services/wardsRoomsBedsService';
import { admissionService } from '../src/modules/admission/admission.service';
import { createBedSchema, updateBedSchema, createRoomSchema, createWardSchema } from '../src/modules/setup/setup.schemas';

beforeEach(() => {
  vi.resetAllMocks();
  tx.hospitalDayClose.create.mockImplementation(async ({ data }) => data);
  tx.invoiceLineItem.create.mockImplementation(async ({ data }) => ({ id: 'line', ...data }));
  tx.serviceRate.findFirst.mockResolvedValue({ id: 'room-charge' });
  api.get.mockResolvedValue({ data: { data: { wards: [], standaloneRooms: [] } } });
  api.post.mockResolvedValue({ data: { data: { id: 'bed' } } });
});

describe('bed pricing is disabled', () => {
  it('does not duplicate an intake room charge when closing the same business day', async () => {
    tx.admissionRecord.findMany.mockResolvedValue([{
      id: 'admission', bed: { room: { dailyRoomRate: new Decimal(1500) } },
    }]);
    tx.admissionRoomChargeLog.findUnique.mockResolvedValue({ id: 'intake-room-charge' });
    const result = await admissionService.closeHospitalDay({ businessDate: '2026-09-22' }, 'actor');
    expect(result.admissionsCharged).toBe(0);
    expect(tx.invoiceLineItem.create).not.toHaveBeenCalled();
  });
  const wardId = '11111111-1111-4111-8111-111111111111';
  it('omits legacy bed rates from frontend create, batch and edit requests', async () => {
    const values = { code: 'BED', bedNumber: '1', roomId: '', wardId, bedType: 'Standard',
      operationalStatus: 'Active', occupancyStatus: 'Available', dailyBedRate: 2000, dailyRate: 3000 } as any;
    await WardsRoomsBedsService.createBed(values);
    await WardsRoomsBedsService.createBedsBatch([values]);
    await WardsRoomsBedsService.updateBed('bed', values);
    for (const [, payload] of [...api.post.mock.calls, ...api.patch.mock.calls]) {
      expect(payload).not.toHaveProperty('dailyRate');
      expect(payload).not.toHaveProperty('dailyBedRate');
    }
  });
  it.each([{ wardId }, { roomId: wardId }, { wardId, roomId: wardId }])('does not accept a separate rate for bed structure %j', (location) => {
    const bed = createBedSchema.parse({ ...location, bedNumber: '1', dailyRate: 2000 });
    expect(bed).not.toHaveProperty('dailyRate');
    expect(updateBedSchema.parse({ dailyRate: 4000 })).not.toHaveProperty('dailyRate');
  });
  it('allows ward and room pricing to be omitted or zero', () => {
    expect(createWardSchema.safeParse({ departmentId: wardId, name: 'Ward' }).success).toBe(true);
    expect(createWardSchema.safeParse({ departmentId: wardId, name: 'Ward', fixedPrice: 0 }).success).toBe(true);
    expect(createRoomSchema.safeParse({ name: 'Room' }).success).toBe(true);
    expect(createRoomSchema.safeParse({ name: 'Room', dailyRoomRate: 0 }).success).toBe(true);
  });
  it.each([null, { dailyRoomRate: null }, { dailyRoomRate: new Decimal(0) }])(
    'never falls back to a legacy bed rate when room pricing is %j', async (room) => {
      tx.admissionRecord.findMany.mockResolvedValue([{ id: 'admission', bed: { dailyRate: new Decimal(9000), room } }]);
      const result = await admissionService.closeHospitalDay({ businessDate: '2026-09-22' }, 'actor');
      expect(result.admissionsCharged).toBe(0);
      expect(result.totalAmountPosted.toNumber()).toBe(0);
      expect(tx.invoiceLineItem.create).not.toHaveBeenCalled();
    },
  );
  it.each([null, wardId])('charges only the configured room rate, with parent ward %s', async (roomWardId) => {
    tx.admissionRecord.findMany.mockResolvedValue([{
      id: 'admission', departmentId: 'department', panelPatient: null,
      bed: { dailyRate: new Decimal(9000), room: { wardId: roomWardId, dailyRoomRate: new Decimal(750) } },
      hospitalInvoices: [{ id: 'invoice', lines: [], paidTotal: new Decimal(0) }],
    }]);
    const result = await admissionService.closeHospitalDay({ businessDate: '2026-09-22' }, 'actor');
    expect(result.admissionsCharged).toBe(1);
    expect(result.totalAmountPosted.toNumber()).toBe(750);
    expect(tx.invoiceLineItem.create.mock.calls[0][0].data.lineGross.toNumber()).toBe(750);
  });
});
