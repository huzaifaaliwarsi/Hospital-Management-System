import { prisma } from '@/db/client';
import type { UpdatePharmacySettingsBody } from './settings.schemas';

/** Same singleton row the HMS high-value gate reads (pharmacy.md §7.3) — this module just exposes the full policy set the Settings screen owns. */
async function getOrCreate() {
  const existing = await prisma.pharmacySettings.findFirst();
  if (existing) return existing;
  return prisma.pharmacySettings.create({ data: {} });
}

export const settingsService = {
  async get() {
    return getOrCreate();
  },

  async update(body: UpdatePharmacySettingsBody, actorId: string) {
    const settings = await getOrCreate();
    return prisma.pharmacySettings.update({ where: { id: settings.id }, data: { ...body, updatedById: actorId } });
  },
};
