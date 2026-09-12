import { prisma } from '@/db/client';
import { NotFoundError } from '@/shared/errors/AppError';
import { normalizeCnic, normalizePhone } from '@/shared/validators';
import type {
  CheckDuplicateQuery,
  CreatePanelPatientBody,
  UpdatePanelPatientBody,
  CreateSelfPayEncounterBody,
} from './patients.schemas';

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

  listPanelPatients(search?: string) {
    return prisma.panelPatient.findMany({
      where: search
        ? { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { mrNumber: { contains: search, mode: 'insensitive' } }] }
        : undefined,
      include: { corporatePanel: { select: { id: true, organizationName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  async createPanelPatient(body: CreatePanelPatientBody, createdById: string) {
    const mrNumber = `MR-${Date.now().toString(36).toUpperCase()}`;
    return prisma.panelPatient.create({ data: { ...body, mrNumber, createdById } });
  },

  async updatePanelPatient(id: string, body: UpdatePanelPatientBody) {
    const existing = await prisma.panelPatient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Panel patient not found');
    return prisma.panelPatient.update({ where: { id }, data: body });
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
