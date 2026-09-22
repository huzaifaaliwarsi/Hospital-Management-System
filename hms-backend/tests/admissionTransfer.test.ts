import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tx } = vi.hoisted(() => ({ tx: {
  admissionRecord: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  bed: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  bedTransferHistory: { create: vi.fn() },
  hospitalInvoice: { findFirst: vi.fn() },
  dualDischargeClearance: { createMany: vi.fn() },
} }));
vi.mock('@/db/client', () => ({ prisma: { $transaction: (fn: any) => fn(tx) } }));
import { admissionService } from '../src/modules/admission/admission.service';
import { transferBedSchema } from '../src/modules/admission/admission.schemas';
import { STANDALONE_ROOM, transferLocations } from '../../ch-sharif-and-saeed-hospital---hms/src/utils/admissionTransfer';

beforeEach(() => {
  vi.resetAllMocks();
  tx.admissionRecord.findUnique.mockResolvedValue({ id: 'admission', status: 'ACTIVE', bedId: 'old' });
  tx.admissionRecord.updateMany.mockResolvedValue({ count: 1 });
  tx.admissionRecord.update.mockImplementation(async ({ data }) => ({ id: 'admission', ...data }));
  tx.bed.findUnique.mockResolvedValue({ id: 'new', status: 'AVAILABLE', operationalStatus: 'ACTIVE' });
  tx.bed.updateMany.mockResolvedValue({ count: 1 });
  tx.bedTransferHistory.create.mockImplementation(async ({ data }) => ({ id: 'history', transferredAt: new Date(), ...data }));
});

describe('transfer backend', () => {
  it.each([
    { ward: { isActive: true }, room: null },
    { ward: { isActive: true }, room: { isActive: true, ward: { isActive: true } } },
    { ward: null, room: { isActive: true, ward: null } },
  ])('transfers across supported hierarchy %j and retains history', async (location) => {
    tx.bed.findUnique.mockResolvedValue({ id: 'new', status: 'AVAILABLE', operationalStatus: 'ACTIVE', ...location });
    const result = await admissionService.transferBed('admission', { targetBedId: 'new', reason: 'Patient request' }, 'actor');
    expect(tx.bed.update).toHaveBeenCalledWith({ where: { id: 'old' }, data: { status: 'AVAILABLE' } });
    expect(tx.bed.updateMany).toHaveBeenCalledWith({ where: { id: 'new', status: 'AVAILABLE', operationalStatus: 'ACTIVE' }, data: { status: 'OCCUPIED' } });
    expect(result.admission.bedId).toBe('new');
    expect(result.transferLog).toMatchObject({ fromBedId: 'old', toBedId: 'new', reason: 'Patient request', transferredById: 'actor', transferredAt: expect.any(Date) });
  });
  it.each(['OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'])('rejects %s beds without mutations', async (status) => {
    tx.bed.findUnique.mockResolvedValue({ id: 'new', status, operationalStatus: 'ACTIVE' });
    await expect(admissionService.transferBed('admission', { targetBedId: 'new', reason: 'Move' }, 'actor')).rejects.toThrow();
    expect(tx.admissionRecord.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    { operationalStatus: 'DECOMMISSIONED' }, { operationalStatus: 'OUT_OF_SERVICE' },
    { operationalStatus: 'CLEANING' }, { operationalStatus: 'MAINTENANCE' },
    { ward: { isActive: false } }, { room: { isActive: false } },
    { room: { isActive: true, ward: { isActive: false } } },
  ])('rejects unavailable operational hierarchy %j', async (state) => {
    tx.bed.findUnique.mockResolvedValue({ id: 'new', status: 'AVAILABLE', operationalStatus: 'ACTIVE', ...state });
    await expect(admissionService.transferBed('admission', { targetBedId: 'new', reason: 'Move' }, 'actor')).rejects.toThrow('active');
    expect(tx.bed.update).not.toHaveBeenCalled();
  });
  it('rejects a target claimed concurrently before releasing the old bed', async () => {
    tx.bed.updateMany.mockResolvedValue({ count: 0 });
    await expect(admissionService.transferBed('admission', { targetBedId: 'new', reason: 'Move' }, 'actor')).rejects.toThrow('no longer available');
    expect(tx.bed.update).not.toHaveBeenCalled();
    expect(tx.bedTransferHistory.create).not.toHaveBeenCalled();
  });
  it('rejects a concurrent change to this admission', async () => {
    tx.admissionRecord.updateMany.mockResolvedValue({ count: 0 });
    await expect(admissionService.transferBed('admission', { targetBedId: 'new', reason: 'Move' }, 'actor')).rejects.toThrow('location changed');
    expect(tx.bed.updateMany).not.toHaveBeenCalled();
  });
  it('rejects selecting the current bed', async () => {
    await expect(admissionService.transferBed('admission', { targetBedId: 'old', reason: 'Move' }, 'actor')).rejects.toThrow('identical');
  });
  it('requires a nonblank transfer reason', () => {
    expect(transferBedSchema.safeParse({ targetBedId: '11111111-1111-4111-8111-111111111111', reason: '  ' }).success).toBe(false);
  });
  it('records a change from the front desk bed during check-in', async () => {
    tx.admissionRecord.findUnique.mockResolvedValue({ id: 'admission', status: 'PLANNED', bedId: 'old', dischargeClearances: [{}] });
    tx.hospitalInvoice.findFirst.mockResolvedValue({ id: 'invoice' });
    await admissionService.checkInAdmission('admission', { bedId: 'new', transferReason: 'Requested room' }, 'actor');
    expect(tx.bedTransferHistory.create).toHaveBeenCalledWith({ data: { admissionRecordId: 'admission', fromBedId: 'old', toBedId: 'new', reason: 'Requested room', transferredById: 'actor' } });
  });
});

describe('frontend transfer location filtering', () => {
  const wards = [{ id: 'ward', status: 'Active' }, { id: 'other', status: 'Active' }, { id: 'inactive', status: 'Inactive' }] as any;
  const rooms = [{ id: 'room', wardId: 'ward', status: 'Active' }, { id: 'standalone', wardId: '', status: 'Active' }, { id: 'closed', wardId: 'ward', status: 'Inactive' }] as any;
  const beds = [
    { id: 'direct', wardId: 'ward', roomId: '' }, { id: 'room-bed', wardId: 'ward', roomId: 'room' },
    { id: 'same-room-other-bed', wardId: 'ward', roomId: 'room' },
    { id: 'standalone-bed', wardId: '', roomId: 'standalone' }, { id: 'other-bed', wardId: 'other', roomId: '' },
    { id: 'closed-bed', wardId: 'ward', roomId: 'closed' },
  ].map((bed) => ({ ...bed, occupancyStatus: 'Available', operationalStatus: 'Active' })) as any;
  it('includes direct beds and room beds in the selected ward only', () => {
    expect(transferLocations(wards, rooms, beds, 'ward', '').availableBeds.map((b) => b.id)).toEqual(['direct', 'room-bed', 'same-room-other-bed']);
  });
  it('allows another bed in the same room, excluding the current bed', () => {
    expect(transferLocations(wards, rooms, beds, 'ward', 'room', 'room-bed').availableBeds.map((b) => b.id)).toEqual(['same-room-other-bed']);
  });
  it('supports standalone rooms without a ward', () => {
    expect(transferLocations(wards, rooms, beds, STANDALONE_ROOM, 'standalone').availableBeds.map((b) => b.id)).toEqual(['standalone-bed']);
  });
  it('does not keep a room or bed from a previous ward selection', () => {
    expect(transferLocations(wards, rooms, beds, 'other', 'room').availableBeds).toEqual([]);
  });
  it.each(['Occupied', 'Reserved', 'Maintenance'])('excludes %s beds', (occupancyStatus) => {
    expect(transferLocations(wards, rooms, [{ ...beds[0], occupancyStatus }], 'ward', '').availableBeds).toEqual([]);
  });
  it('supports selecting a room directly without selecting any ward', () => {
    const loc = transferLocations(wards, rooms, beds, '', 'standalone');
    expect(loc.availableRooms.map((r) => r.id)).toEqual(['room', 'standalone']);
    expect(loc.availableBeds.map((b) => b.id)).toEqual(['standalone-bed']);
  });
  it('supports selecting a ward-belonging room directly without selecting a ward first', () => {
    const loc = transferLocations(wards, rooms, beds, '', 'room');
    expect(loc.availableBeds.map((b) => b.id)).toEqual(['room-bed', 'same-room-other-bed']);
  });
});
