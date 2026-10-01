import { prisma } from '@/db/client';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/AppError';
import type { CreateUnitBody, UpdateUnitBody, ListUnitsQuery } from './units.schemas';

/** Global reusable unit catalog (medicine-packaging-plan) — Box/Strip/Tablet/... plus user-added custom units. */
export const unitsService = {
  async list(query: ListUnitsQuery) {
    return prisma.unit.findMany({
      where: query.includeInactive ? undefined : { isActive: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  },

  async create(body: CreateUnitBody, actorId: string) {
    const existing = await prisma.unit.findFirst({ where: { name: { equals: body.name.trim(), mode: 'insensitive' } } });
    if (existing) throw new ConflictError(`Unit "${body.name}" already exists`);
    return prisma.unit.create({ data: { name: body.name.trim(), shortCode: body.shortCode, isSystem: false, createdById: actorId } });
  },

  async update(id: string, body: UpdateUnitBody) {
    const unit = await prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundError('Unit not found');
    if (body.isActive === false) {
      const inUse = await prisma.medicineMaster.count({ where: { baseUnitId: id } });
      if (inUse > 0) throw new ValidationError(`Cannot deactivate — ${inUse} medicine(s) use this as their base unit`);
    }
    return prisma.unit.update({ where: { id }, data: body });
  },
};
