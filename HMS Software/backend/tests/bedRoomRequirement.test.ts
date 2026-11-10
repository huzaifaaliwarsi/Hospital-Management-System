import { beforeEach, describe, expect, it, vi } from 'vitest';
const { db } = vi.hoisted(() => ({ db: {
  room: { count: vi.fn(), findUnique: vi.fn() },
  bed: { create: vi.fn() },
} }));
vi.mock('@/db/client', () => ({ prisma: db }));
import { setupService } from '../src/modules/setup/setup.service';

beforeEach(() => {
  vi.resetAllMocks();
  db.bed.create.mockImplementation(async ({ data }) => data);
});

describe('bed placement in wards with rooms', () => {
  it('rejects a direct ward bed when any room already exists', async () => {
    db.room.count.mockResolvedValue(1);
    await expect(setupService.createBed({ code: 'BED-TEST', bedNumber: '1', wardId: 'ward' }, 'actor'))
      .rejects.toThrow('Select a room');
    expect(db.room.count).toHaveBeenCalledWith({ where: { wardId: 'ward' } });
    expect(db.bed.create).not.toHaveBeenCalled();
  });
  it('allows a direct bed in a ward without rooms', async () => {
    db.room.count.mockResolvedValue(0);
    const bed = await setupService.createBed({ code: 'BED-TEST', bedNumber: '1', wardId: 'ward' }, 'actor');
    expect(bed).toMatchObject({ wardId: 'ward', roomId: null, dailyRate: 0 });
  });
  it.each(['ward', null])('allows a room bed with parent ward %s', async (wardId) => {
    db.room.findUnique.mockResolvedValue({ wardId });
    const bed = await setupService.createBed({ code: 'BED-TEST', bedNumber: '1', roomId: 'room' }, 'actor');
    expect(bed).toMatchObject({ wardId, roomId: 'room', dailyRate: 0 });
    expect(db.room.count).not.toHaveBeenCalled();
  });
});
