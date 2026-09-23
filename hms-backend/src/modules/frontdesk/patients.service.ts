import { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { membershipSnapshot, validateMembershipDetails } from '@/shared/panelMembership';
import { NotFoundError, ConflictError, ValidationError } from '@/shared/errors/AppError';
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
  /**
   * Checks both identity tables — a self-pay visitor may already have a
   * matching CNIC/phone from a prior encounter or an existing panel
   * record, which front desk staff should be shown before registering a
   * new one. Server-side and authoritative (panel.md §17 backlog item 3):
   * the frontend previously ran this scan itself over a client-side
   * page-200 cache, silently missing anything registered beyond that
   * window or by another session. Tiered like a credit check, most
   * certain first — MRN, external member ID and CNIC are hard identity
   * anchors (STRONG_EXACT); name+DOB is a strong but not certain match
   * (HIGH_WARNING); a shared phone or bare name alone is a likely-match
   * signal for a dependent/family member, not necessarily the same person
   * (WEAK_WARNING, per §4.4) — so it warns rather than blocks.
   */
  async checkDuplicate(query: CheckDuplicateQuery) {
    const cnic = query.cnic ? normalizeCnic(query.cnic) : undefined;
    const phone = query.phone ? normalizePhone(query.phone) : undefined;
    const mrNumber = query.mrNumber?.trim();
    const panelMemberId = query.panelMemberId?.trim();
    const fullName = query.fullName?.trim();
    const dob = query.dob;
    const excludeId = query.excludePatientId;

    const lookup = async (
      panelWhere: Prisma.PanelPatientWhereInput | null,
      selfPayWhere: Prisma.SelfPayEncounterWhereInput | null = null,
    ) => {
      const [panelPatients, selfPayEncounters] = await Promise.all([
        panelWhere
          ? prisma.panelPatient.findMany({
              where: { ...panelWhere, ...(excludeId ? { id: { not: excludeId } } : {}) },
              include: { corporatePanel: { select: { id: true, organizationName: true } } },
              take: 10,
            })
          : Promise.resolve([]),
        selfPayWhere
          ? prisma.selfPayEncounter.findMany({
              where: { ...selfPayWhere, ...(excludeId ? { id: { not: excludeId } } : {}) },
              take: 10,
            })
          : Promise.resolve([]),
      ]);
      return { panelPatients, selfPayEncounters };
    };

    const found = (
      severity: 'STRONG_EXACT' | 'HIGH_WARNING' | 'WEAK_WARNING',
      matchType: string,
      reason: string,
      matches: Awaited<ReturnType<typeof lookup>>,
    ) => ({ severity, matchType, reason, ...matches, isDuplicate: true });

    // Tier 1 — STRONG_EXACT: hard identity anchors (self-pay has no MRN/member ID).
    if (mrNumber) {
      const matches = await lookup({ mrNumber });
      if (matches.panelPatients.length) {
        return found('STRONG_EXACT', 'EXACT_MRN', `Existing registered patient found with MR number ${mrNumber}. Registration blocked to prevent duplicate identity.`, matches);
      }
    }
    if (panelMemberId) {
      const matches = await lookup({ panelMemberId });
      if (matches.panelPatients.length) {
        return found(
          'STRONG_EXACT',
          'EXACT_MEMBER_ID',
          `Existing registered patient found with member/employee ID ${panelMemberId}. A shared family/principal policy ID can belong to a dependent — confirm before reusing.`,
          matches,
        );
      }
    }
    if (cnic) {
      const matches = await lookup({ cnicOrPassport: cnic }, { cnicOrPassport: cnic });
      if (matches.panelPatients.length || matches.selfPayEncounters.length) {
        return found('STRONG_EXACT', 'EXACT_CNIC', `Existing registered patient found with identical CNIC (${cnic}). Registration blocked to prevent duplicate identity.`, matches);
      }
    }

    // Tier 2 — HIGH_WARNING: strong but not certain (possible twins/namesakes).
    if (fullName && dob) {
      const nameFilter = { fullName: { equals: fullName, mode: 'insensitive' as const } };
      const matches = await lookup({ ...nameFilter, dob }, { ...nameFilter, dob });
      if (matches.panelPatients.length || matches.selfPayEncounters.length) {
        return found('HIGH_WARNING', 'NAME_DOB', 'High probability duplicate: matched an existing patient with identical full name and date of birth.', matches);
      }
    }

    // Tier 3 — WEAK_WARNING: a likely-match signal, not proof (§4.4) — a shared
    // family phone or a common name alone can legitimately belong to a
    // different, real dependent, so this warns instead of blocking.
    if (phone) {
      const matches = await lookup({ phone }, { phone });
      if (matches.panelPatients.length || matches.selfPayEncounters.length) {
        return found('WEAK_WARNING', 'PHONE_ONLY', 'Shared contact warning: another registered patient shares this primary phone number.', matches);
      }
    }
    if (fullName && fullName.length >= 4) {
      const nameFilter = { fullName: { equals: fullName, mode: 'insensitive' as const } };
      const matches = await lookup(nameFilter, nameFilter);
      if (matches.panelPatients.length || matches.selfPayEncounters.length) {
        return found('WEAK_WARNING', 'NAME_ONLY', 'Name match warning: an existing patient shares this full name.', matches);
      }
    }

    return { severity: 'NONE' as const, matchType: 'NONE', reason: '', panelPatients: [], selfPayEncounters: [], isDuplicate: false };
  },

  async listPanelPatients(query: ListPanelPatientsQuery) {
    const where: Prisma.PanelPatientWhereInput = {};
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { mrNumber: { contains: query.search, mode: 'insensitive' } },
        { panelMemberId: { contains: query.search, mode: 'insensitive' } },
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
    const company = await prisma.corporatePanel.findUnique({ where: { id: body.corporatePanelId } });
    if (!company?.isActive) throw new ValidationError('Panel patients can only be registered under an active company');
    validateMembershipDetails(body, company);
    const mrNumber = await generateMrNumber();
    try {
      const created = await prisma.panelPatient.create({
        data: {
          ...body,
          mrNumber,
          isActive: body.status !== 'INACTIVE' && body.status !== 'DECEASED',
          createdById,
          updatedById: createdById,
          membershipHistory: { create: { snapshot: membershipSnapshot(body), recordedById: createdById } },
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
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM panel_patients WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.panelPatient.findUnique({ where: { id }, include: { corporatePanel: true } });
      if (!existing) throw new NotFoundError('Panel patient not found');

      // Controlled company transfer (panel.md §14 backlog item 1): now safe
      // because every HospitalInvoice freezes its own corporatePanelId at
      // posting time — an old receivable stays on the books of the company
      // that was actually billed, so moving the patient's live membership
      // forward can no longer misattribute or hide past debt. The new
      // company must be active and satisfy its own membership requirements;
      // the transfer itself is recorded as an ordinary membership-history
      // revision below (the snapshot already carries corporatePanelId), plus
      // an explicit marker so the audit trail reads as a transfer, not a
      // same-company edit.
      const isCompanyTransfer = body.corporatePanelId !== undefined && body.corporatePanelId !== existing.corporatePanelId;
      let targetCompany = existing.corporatePanel;
      if (isCompanyTransfer) {
        const newCompany = await tx.corporatePanel.findUnique({ where: { id: body.corporatePanelId } });
        if (!newCompany) throw new NotFoundError('Target company not found');
        if (!newCompany.isActive) throw new ValidationError('Cannot transfer a patient to an inactive company');
        targetCompany = newCompany;
      }

      const merged = { ...existing, ...body };
      const snapshot = membershipSnapshot(merged);
      const membershipChanged = JSON.stringify(snapshot) !== JSON.stringify(membershipSnapshot(existing));
      // An unrelated demographic edit must remain possible for an expired membership.
      if (membershipChanged) validateMembershipDetails(merged, targetCompany);
      const data: Prisma.PanelPatientUncheckedUpdateInput = { ...body, updatedById };
      if (body.status !== undefined) {
        data.isActive = body.status === 'ACTIVE';
      }

      if (membershipChanged) {
        await tx.panelMembershipHistory.create({
          data: {
            panelPatientId: id,
            snapshot: isCompanyTransfer
              ? { ...snapshot, transferredFromCorporatePanelId: existing.corporatePanelId }
              : snapshot,
            recordedById: updatedById,
          },
        });
      }
      const updated = await tx.panelPatient.update({ where: { id }, data, include: panelPatientInclude });
      return decoratePanelPatient(updated as any);
    });
  },

  async membershipHistory(id: string, page: number, pageSize: number) {
    if (!await prisma.panelPatient.findUnique({ where: { id }, select: { id: true } })) throw new NotFoundError('Panel patient not found');
    const [rows, totalItems] = await prisma.$transaction([
      prisma.panelMembershipHistory.findMany({ where: { panelPatientId: id }, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.panelMembershipHistory.count({ where: { panelPatientId: id } }),
    ]);
    const actors = await prisma.portalUser.findMany({ where: { id: { in: [...new Set(rows.flatMap(row => row.recordedById ? [row.recordedById] : []))] } }, select: { id: true, ...actorSelect.select } });
    return { rows: rows.map(row => ({ ...row, recordedByLabel: formatActorFromRelation(actors.find(actor => actor.id === row.recordedById) ?? null) })), meta: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) } };
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
