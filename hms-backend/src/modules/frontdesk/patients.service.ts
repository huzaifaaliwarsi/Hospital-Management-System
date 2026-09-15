import { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { NotFoundError, ConflictError } from '@/shared/errors/AppError';
import { normalizeCnic, normalizePhone } from '@/shared/validators';
import { actorSelect, formatActorFromRelation, type ActorRelation } from '@/shared/actorLabel';
import type {
  CheckDuplicateQuery,
  CreatePanelPatientBody,
  UpdatePanelPatientBody,
  CreateSelfPayEncounterBody,
  ListPanelPatientsQuery,
} from './patients.schemas';

const panelPatientInclude = {
  corporatePanel: { select: { id: true, organizationName: true } },
  createdByUser: actorSelect,
  updatedByUser: actorSelect,
} satisfies Prisma.PanelPatientInclude;

function decoratePanelPatient(
  row: Record<string, unknown> & { createdByUser: ActorRelation | null; updatedByUser: ActorRelation | null },
) {
  return {
    ...row,
    createdByLabel: formatActorFromRelation(row.createdByUser),
    updatedByLabel: formatActorFromRelation(row.updatedByUser),
  };
}

import { generateMrNumber } from '@/shared/idGenerator';

/**
 * §4.6 Patient identity model — Panel Patient (permanent master) vs.
 * Self-Pay Encounter (temporary, per-visit identity), D16 p.7.
 */
export const patientsService = {
  /** Checks both identity tables — a self-pay visitor may already have a
   *  matching CNIC/phone from a prior encounter or an existing panel
   *  record, which front desk staff should be shown before registering
   *  a new one. */
  async checkDuplicate(query: CheckDuplicateQuery) {
    const cnic = query.cnic ? normalizeCnic(query.cnic) : undefined;
    const phone = query.phone ? normalizePhone(query.phone) : undefined;

    const or = [
      ...(cnic ? [{ cnicOrPassport: cnic }] : []),
      ...(phone ? [{ phone }] : []),
    ];
    if (or.length === 0) return { panelPatients: [], selfPayEncounters: [] };

    const [panelPatients, selfPayEncounters] = await Promise.all([
      prisma.panelPatient.findMany({ where: { OR: or }, take: 10 }),
      prisma.selfPayEncounter.findMany({ where: { OR: or }, take: 10 }),
    ]);

    return { panelPatients, selfPayEncounters, isDuplicate: panelPatients.length > 0 || selfPayEncounters.length > 0 };
  },

  async listPanelPatients(query: ListPanelPatientsQuery) {
    const where: Prisma.PanelPatientWhereInput = {};
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { mrNumber: { contains: query.search, mode: 'insensitive' } },
        { cnicOrPassport: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.corporatePanelId) where.corporatePanelId = query.corporatePanelId;

    const [rows, totalItems] = await prisma.$transaction([
      prisma.panelPatient.findMany({
        where,
        include: panelPatientInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.panelPatient.count({ where }),
    ]);

    return {
      rows: rows.map((r) => decoratePanelPatient(r as any)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
      },
    };
  },

  async createPanelPatient(body: CreatePanelPatientBody, createdById: string) {
    const mrNumber = await generateMrNumber();
    try {
      const created = await prisma.panelPatient.create({
        data: {
          ...body,
          mrNumber,
          isActive: body.status !== 'INACTIVE' && body.status !== 'DECEASED',
          createdById,
          updatedById: createdById,
        } as Prisma.PanelPatientUncheckedCreateInput,
        include: panelPatientInclude,
      });
      return decoratePanelPatient(created as any);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('A panel patient with this MR number already exists — please retry.');
      }
      throw error;
    }
  },

  async updatePanelPatient(id: string, body: UpdatePanelPatientBody, updatedById: string) {
    const existing = await prisma.panelPatient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Panel patient not found');

    const data: Prisma.PanelPatientUncheckedUpdateInput = { ...body, updatedById };
    if (body.status !== undefined) {
      data.isActive = body.status === 'ACTIVE';
    }

    const updated = await prisma.panelPatient.update({ where: { id }, data, include: panelPatientInclude });
    return decoratePanelPatient(updated as any);
  },

  listSelfPayEncounters(search?: string) {
    return prisma.selfPayEncounter.findMany({
      where: search ? { fullName: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  createSelfPayEncounter(body: CreateSelfPayEncounterBody, createdById: string) {
    return prisma.selfPayEncounter.create({ data: { ...body, createdById } });
  },
};
