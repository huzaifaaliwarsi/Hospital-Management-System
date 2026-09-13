import { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { NotFoundError, ConflictError } from '@/shared/errors/AppError';
import { actorSelect, resolveActorLabel, formatActorFromRelation, type ActorRelation } from '@/shared/actorLabel';
import type {
  UpdateHospitalProfileBody,
  CreateDepartmentBody,
  UpdateDepartmentBody,
  CreateServiceRateBody,
  UpdateServiceRateBody,
  CreateWardBody,
  UpdateWardBody,
  CreateRoomBody,
  UpdateRoomBody,
  CreateBedBody,
  UpdateBedBody,
  CreateCorporatePanelBody,
  UpdateCorporatePanelBody,
  ReplaceDiscountRulesBody,
  CreateShiftBody,
  UpdateShiftBody,
} from './setup.schemas';

/**
 * §4.2 Hospital Setup & Master Data. Kept as a single service file for this
 * phase (routes → controller → service, no separate repository layer) —
 * each sub-resource here is a thin CRUD wrapper around one Prisma model.
 */
// Fields that live in the `billingLegalMetadata` JSON blob (tax/legal/invoice identity).
const BILLING_LEGAL_KEYS = [
  'registrationNumber',
  'licenseNumber',
  'accreditationBody',
  'accreditationNumber',
  'legalBusinessName',
  'taxNumber',
  'salesTaxNumber',
  'billingAddress',
  'invoicePhone',
  'invoiceEmail',
  'invoicePrefix',
  'receiptPrefix',
] as const;

// Everything else the Hospital Overview screen shows that isn't a
// first-class column and isn't billing/legal — grouped identity, contact,
// address, and operational-hours fields.
const EXTENDED_PROFILE_KEYS = [
  'shortName',
  'hospitalType',
  'status',
  'alternatePhone',
  'emergencyPhone',
  'secondaryEmail',
  'website',
  'addressLine1',
  'addressLine2',
  'city',
  'province',
  'postalCode',
  'country',
  'weekStartDay',
  'workingMode',
  'opdOpenTime',
  'opdCloseTime',
  'emergencyEnabled',
  'emergencyMode',
  'dateFormat',
  'timeFormat',
  'workingHours',
] as const;

function pickKeys<T extends Record<string, unknown>>(source: T, keys: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

/** Reassembles the flat frontend `HospitalProfile` shape from columns + JSON blobs. */
function toClientProfile(row: Awaited<ReturnType<typeof prisma.hospitalProfile.findFirst>>) {
  if (!row) return null;
  const billing = (row.billingLegalMetadata as Record<string, unknown>) ?? {};
  const extended = (row.extendedProfile as Record<string, unknown>) ?? {};
  return {
    id: row.id,
    name: row.name ?? '',
    logo: row.logoUrl ?? null,
    primaryPhone: row.contactPhone ?? '',
    primaryEmail: row.contactEmail ?? '',
    currency: row.currencyCode,
    timezone: row.timezone,
    createdAt: row.createdAt,
    createdBy: row.createdBy ?? '',
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy ?? '',
    ...billing,
    ...extended,
  };
}

export const setupService = {
  // ── Hospital Profile (singleton) ────────────────────────────────────
  async getHospitalProfile() {
    const existing = await prisma.hospitalProfile.findFirst();
    // Unconfigured fields render "Not configured" client-side rather than
    // being fabricated here — an empty singleton is a valid response.
    const row = existing ?? (await prisma.hospitalProfile.create({ data: {} }));
    return toClientProfile(row);
  },

  async updateHospitalProfile(body: UpdateHospitalProfileBody, updatedByPortalUserId: string) {
    const existing = await prisma.hospitalProfile.findFirst();
    const row = existing ?? (await prisma.hospitalProfile.create({ data: {} }));

    const billingPatch = pickKeys(body as Record<string, unknown>, BILLING_LEGAL_KEYS);
    const extendedPatch = pickKeys(body as Record<string, unknown>, EXTENDED_PROFILE_KEYS);
    const updatedBy = await resolveActorLabel(updatedByPortalUserId);

    const data: Prisma.HospitalProfileUpdateInput = { updatedBy };
    if (!row.createdBy) data.createdBy = updatedBy;
    if (body.name !== undefined) data.name = body.name;
    if (body.primaryPhone !== undefined) data.contactPhone = body.primaryPhone;
    if (body.primaryEmail !== undefined) data.contactEmail = body.primaryEmail;
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
    if (body.currency !== undefined) data.currencyCode = body.currency;
    if (body.timezone !== undefined) data.timezone = body.timezone;
    if (body.printHeaderConfig !== undefined) data.printHeaderConfig = body.printHeaderConfig as Prisma.InputJsonValue;
    if (body.printFooterConfig !== undefined) data.printFooterConfig = body.printFooterConfig as Prisma.InputJsonValue;
    if (Object.keys(billingPatch).length > 0) {
      data.billingLegalMetadata = { ...(row.billingLegalMetadata as object), ...billingPatch } as Prisma.InputJsonValue;
    }
    if (Object.keys(extendedPatch).length > 0) {
      data.extendedProfile = { ...(row.extendedProfile as object), ...extendedPatch } as Prisma.InputJsonValue;
    }

    const updated = await prisma.hospitalProfile.update({ where: { id: row.id }, data });
    return toClientProfile(updated);
  },

  // ── Departments ──────────────────────────────────────────────────────
  departmentInclude: {
    headStaff: { select: { id: true, fullName: true } },
    createdByUser: actorSelect,
    updatedByUser: actorSelect,
    _count: { select: { staff: true, wards: true, serviceRates: true } },
  } satisfies Prisma.DepartmentInclude,

  /** Attaches computed doctorCount/staffCount/serviceCount/wardCount + resolved actor labels. */
  async decorateDepartments(
    rows: Array<
      Record<string, unknown> & {
        id: string;
        headStaff: { id: string; fullName: string } | null;
        createdByUser: ActorRelation | null;
        updatedByUser: ActorRelation | null;
        _count: { staff: number; wards: number; serviceRates: number };
      }
    >,
  ) {
    const departmentIds = rows.map((r) => r.id);
    const doctorCounts =
      departmentIds.length === 0
        ? []
        : await prisma.staff.groupBy({
            by: ['departmentId'],
            where: { departmentId: { in: departmentIds }, category: 'Doctor', isActive: true },
            _count: { _all: true },
          });
    const doctorCountMap = new Map(doctorCounts.map((d) => [d.departmentId, d._count._all]));

    return rows.map((row) => ({
      ...row,
      headName: row.headStaff?.fullName || 'Not Assigned',
      doctorCount: doctorCountMap.get(row.id) ?? 0,
      staffCount: row._count.staff,
      serviceCount: row._count.serviceRates,
      wardCount: row._count.wards,
      createdByLabel: formatActorFromRelation(row.createdByUser),
      updatedByLabel: formatActorFromRelation(row.updatedByUser),
    }));
  },

  async listDepartments(activeOnly = false) {
    const rows = await prisma.department.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: this.departmentInclude,
      orderBy: { name: 'asc' },
    });
    return this.decorateDepartments(rows as any);
  },

  async createDepartment(body: CreateDepartmentBody, createdById: string) {
    try {
      const created = await prisma.department.create({
        data: { ...body, createdById },
        include: this.departmentInclude,
      });
      return (await this.decorateDepartments([created as any]))[0];
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Department code "${body.code}" already exists.`);
      }
      throw error;
    }
  },

  async updateDepartment(id: string, body: UpdateDepartmentBody, updatedById: string) {
    const existing = await this.assertExists('department', id);
    const data: Prisma.DepartmentUncheckedUpdateInput = { ...body, updatedById };
    if (body.isActive !== undefined && body.isActive !== (existing as { isActive: boolean }).isActive) {
      data.statusChangedAt = new Date();
      data.statusChangedBy = await resolveActorLabel(updatedById);
    }
    try {
      const updated = await prisma.department.update({ where: { id }, data, include: this.departmentInclude });
      return (await this.decorateDepartments([updated as any]))[0];
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Department code "${body.code}" already exists.`);
      }
      throw error;
    }
  },

  async deactivateDepartment(id: string, updatedById: string) {
    await this.assertExists('department', id);
    const updated = await prisma.department.update({
      where: { id },
      data: {
        isActive: false,
        updatedById,
        statusChangedAt: new Date(),
        statusChangedBy: await resolveActorLabel(updatedById),
      },
      include: this.departmentInclude,
    });
    return (await this.decorateDepartments([updated as any]))[0];
  },

  // ── Service Rates ────────────────────────────────────────────────────
  serviceRateInclude: {
    department: { select: { id: true, name: true, code: true } },
    createdByUser: actorSelect,
    updatedByUser: actorSelect,
    _count: { select: { invoiceLines: true, panelDiscountRules: true } },
  } satisfies Prisma.ServiceRateInclude,

  decorateServiceRates(
    rows: Array<
      Record<string, unknown> & {
        createdByUser: ActorRelation | null;
        updatedByUser: ActorRelation | null;
        _count: { invoiceLines: number; panelDiscountRules: number };
      }
    >,
  ) {
    return rows.map((row) => ({
      ...row,
      linkedInvoiceCount: row._count.invoiceLines,
      linkedPanelRuleCount: row._count.panelDiscountRules,
      createdByLabel: formatActorFromRelation(row.createdByUser),
      updatedByLabel: formatActorFromRelation(row.updatedByUser),
    }));
  },

  async listServiceRates(activeOnly = false) {
    const rows = await prisma.serviceRate.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: this.serviceRateInclude,
      orderBy: { name: 'asc' },
    });
    return this.decorateServiceRates(rows as any);
  },

  async createServiceRate(body: CreateServiceRateBody, createdById: string) {
    try {
      const created = await prisma.serviceRate.create({
        data: { ...body, createdById },
        include: this.serviceRateInclude,
      });
      return this.decorateServiceRates([created as any])[0];
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Service code "${body.code}" already exists.`);
      }
      throw error;
    }
  },

  async updateServiceRate(id: string, body: UpdateServiceRateBody, updatedById: string) {
    const existing = await this.assertExists('serviceRate', id);
    const data: Prisma.ServiceRateUncheckedUpdateInput = { ...body, updatedById };
    if (body.isActive !== undefined && body.isActive !== (existing as { isActive: boolean }).isActive) {
      data.statusChangedAt = new Date();
      data.statusChangedBy = await resolveActorLabel(updatedById);
    }
    try {
      // NOTE: changing standardRate here never rewrites rate_snapshot on
      // already-posted invoice lines (D15 §15) — those are frozen at billing time.
      const updated = await prisma.serviceRate.update({ where: { id }, data, include: this.serviceRateInclude });
      return this.decorateServiceRates([updated as any])[0];
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Service code "${body.code}" already exists.`);
      }
      throw error;
    }
  },

  async deactivateServiceRate(id: string, updatedById: string) {
    await this.assertExists('serviceRate', id);
    const updated = await prisma.serviceRate.update({
      where: { id },
      data: { isActive: false, updatedById, statusChangedAt: new Date(), statusChangedBy: await resolveActorLabel(updatedById) },
      include: this.serviceRateInclude,
    });
    return this.decorateServiceRates([updated as any])[0];
  },

  // ── Wards / Rooms / Beds (Department → Ward → Room → Bed, §4.2) ─────
  wardHierarchyInclude: {
    department: { select: { id: true, name: true, code: true } },
    createdByUser: actorSelect,
    updatedByUser: actorSelect,
    rooms: {
      include: {
        createdByUser: actorSelect,
        updatedByUser: actorSelect,
        beds: { include: { createdByUser: actorSelect, updatedByUser: actorSelect } },
      },
    },
  } satisfies Prisma.WardInclude,

  /** Resolves the current occupant (if any) for a set of beds from the Admission module — never stored on Bed itself. */
  async currentOccupantsByBedId(bedIds: string[]) {
    if (bedIds.length === 0) return new Map<string, { admissionId: string; patientName: string }>();
    const activeAdmissions = await prisma.admissionRecord.findMany({
      where: { bedId: { in: bedIds }, status: 'ACTIVE' },
      select: {
        id: true,
        bedId: true,
        panelPatient: { select: { fullName: true } },
        selfPayEncounter: { select: { fullName: true } },
      },
    });
    const map = new Map<string, { admissionId: string; patientName: string }>();
    for (const admission of activeAdmissions) {
      if (!admission.bedId) continue;
      map.set(admission.bedId, {
        admissionId: admission.id,
        patientName: admission.panelPatient?.fullName || admission.selfPayEncounter?.fullName || 'Unknown Patient',
      });
    }
    return map;
  },

  async listWardHierarchy() {
    const wards = await prisma.ward.findMany({
      include: this.wardHierarchyInclude,
      orderBy: { name: 'asc' },
    });

    const allBedIds = wards.flatMap((w: any) => w.rooms.flatMap((r: any) => r.beds.map((b: any) => b.id)));
    const occupants = await this.currentOccupantsByBedId(allBedIds);

    return wards.map((ward: any) => {
      const rooms = ward.rooms.map((room: any) => {
        const beds = room.beds.map((bed: any) => {
          const occupant = occupants.get(bed.id);
          return {
            ...bed,
            currentPatientId: occupant?.admissionId,
            currentPatientName: occupant?.patientName,
            admissionId: occupant?.admissionId,
            createdByLabel: formatActorFromRelation(bed.createdByUser),
            updatedByLabel: formatActorFromRelation(bed.updatedByUser),
          };
        });
        return {
          ...room,
          beds,
          bedsConfigured: beds.length,
          availableBeds: beds.filter((b: any) => b.status === 'AVAILABLE').length,
          createdByLabel: formatActorFromRelation(room.createdByUser),
          updatedByLabel: formatActorFromRelation(room.updatedByUser),
        };
      });
      const allBeds = rooms.flatMap((r: any) => r.beds);
      return {
        ...ward,
        rooms,
        roomCount: rooms.length,
        bedCount: allBeds.length,
        availableBeds: allBeds.filter((b: any) => b.status === 'AVAILABLE').length,
        createdByLabel: formatActorFromRelation(ward.createdByUser),
        updatedByLabel: formatActorFromRelation(ward.updatedByUser),
      };
    });
  },

  async createWard(body: CreateWardBody, createdById: string) {
    try {
      return await prisma.ward.create({ data: { ...body, createdById } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Ward code "${body.code}" already exists.`);
      }
      throw error;
    }
  },

  async updateWard(id: string, body: UpdateWardBody, updatedById: string) {
    const existing = await this.assertExists('ward', id);
    const data: Prisma.WardUncheckedUpdateInput = { ...body, updatedById };
    if (body.isActive !== undefined && body.isActive !== (existing as { isActive: boolean }).isActive) {
      data.statusChangedAt = new Date();
      data.statusChangedBy = await resolveActorLabel(updatedById);
    }
    return prisma.ward.update({ where: { id }, data });
  },

  async createRoom(body: CreateRoomBody, createdById: string) {
    try {
      return await prisma.room.create({ data: { ...body, createdById } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Room code "${body.code}" already exists.`);
      }
      throw error;
    }
  },

  async updateRoom(id: string, body: UpdateRoomBody, updatedById: string) {
    const existing = await this.assertExists('room', id);
    const data: Prisma.RoomUncheckedUpdateInput = { ...body, updatedById };
    if (body.isActive !== undefined && body.isActive !== (existing as { isActive: boolean }).isActive) {
      data.statusChangedAt = new Date();
      data.statusChangedBy = await resolveActorLabel(updatedById);
    }
    return prisma.room.update({ where: { id }, data });
  },

  async createBed(body: CreateBedBody, createdById: string) {
    try {
      return await prisma.bed.create({ data: { ...body, createdById } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Bed "${body.bedNumber}" already exists in this room, or the bed code is taken.`);
      }
      throw error;
    }
  },

  async updateBed(id: string, body: UpdateBedBody, updatedById: string) {
    const existing = await this.assertExists('bed', id);
    const data: Prisma.BedUncheckedUpdateInput = { ...body, updatedById };
    if (
      body.operationalStatus !== undefined &&
      body.operationalStatus !== (existing as { operationalStatus: string }).operationalStatus
    ) {
      data.statusChangedAt = new Date();
      data.statusChangedBy = await resolveActorLabel(updatedById);
    }
    return prisma.bed.update({ where: { id }, data });
  },

  // ── Corporate Panels ─────────────────────────────────────────────────
  corporatePanelInclude: {
    discountRules: true,
    createdByUser: actorSelect,
    updatedByUser: actorSelect,
    _count: { select: { panelPatients: true } },
  } satisfies Prisma.CorporatePanelInclude,

  decorateCorporatePanel(
    row: Record<string, unknown> & {
      createdByUser: ActorRelation | null;
      updatedByUser: ActorRelation | null;
      _count: { panelPatients: number };
    },
  ) {
    return {
      ...row,
      activePatientsCount: row._count.panelPatients,
      createdByLabel: formatActorFromRelation(row.createdByUser),
      updatedByLabel: formatActorFromRelation(row.updatedByUser),
    };
  },

  async listCorporatePanels(activeOnly = false) {
    const rows = await prisma.corporatePanel.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: this.corporatePanelInclude,
      orderBy: { organizationName: 'asc' },
    });
    return rows.map((r) => this.decorateCorporatePanel(r as any));
  },

  async createCorporatePanel(body: CreateCorporatePanelBody, createdById: string) {
    try {
      const created = await prisma.corporatePanel.create({ data: { ...body, createdById }, include: this.corporatePanelInclude });
      return this.decorateCorporatePanel(created as any);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Corporate panel code "${body.code}" already exists.`);
      }
      throw error;
    }
  },

  async updateCorporatePanel(id: string, body: UpdateCorporatePanelBody, updatedById: string) {
    await this.assertExists('corporatePanel', id);
    try {
      const updated = await prisma.corporatePanel.update({
        where: { id },
        data: { ...body, updatedById },
        include: this.corporatePanelInclude,
      });
      return this.decorateCorporatePanel(updated as any);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Corporate panel code "${body.code}" already exists.`);
      }
      throw error;
    }
  },

  async replaceDiscountRules(corporatePanelId: string, body: ReplaceDiscountRulesBody) {
    await this.assertExists('corporatePanel', corporatePanelId);
    return prisma.$transaction(async (tx) => {
      await tx.panelDiscountRule.deleteMany({ where: { corporatePanelId } });
      if (body.rules.length === 0) return [];
      await tx.panelDiscountRule.createMany({
        data: body.rules.map((rule) => ({ ...rule, corporatePanelId })),
      });
      return tx.panelDiscountRule.findMany({ where: { corporatePanelId } });
    });
  },

  // ── Shifts (Shift Master, Super Admin "Shift Management") ───────────
  shiftInclude: {
    department: { select: { id: true, name: true, code: true } },
    createdByUser: actorSelect,
    updatedByUser: actorSelect,
  } satisfies Prisma.ShiftInclude,

  decorateShift(row: Record<string, unknown> & { createdByUser: ActorRelation | null; updatedByUser: ActorRelation | null }) {
    return {
      ...row,
      createdByLabel: formatActorFromRelation(row.createdByUser),
      updatedByLabel: formatActorFromRelation(row.updatedByUser),
    };
  },

  async listShifts(filters: { departmentId?: string; shiftType?: string; isActive?: boolean; search?: string } = {}) {
    const where: Prisma.ShiftWhereInput = {};
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.shiftType) where.shiftType = filters.shiftType as Prisma.EnumShiftTypeFilter['equals'];
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const rows = await prisma.shift.findMany({ where, include: this.shiftInclude, orderBy: { name: 'asc' } });
    return rows.map((r) => this.decorateShift(r as any));
  },

  async createShift(body: CreateShiftBody, createdById: string) {
    try {
      const created = await prisma.shift.create({ data: { ...body, createdById }, include: this.shiftInclude });
      return this.decorateShift(created as any);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Shift code "${body.code}" already exists.`);
      }
      throw error;
    }
  },

  async updateShift(id: string, body: UpdateShiftBody, updatedById: string) {
    const existing = await this.assertExists('shift', id);
    const data: Prisma.ShiftUncheckedUpdateInput = { ...body, updatedById };
    if (body.isActive !== undefined && body.isActive !== (existing as { isActive: boolean }).isActive) {
      data.statusChangedAt = new Date();
      data.statusChangedBy = await resolveActorLabel(updatedById);
    }
    try {
      const updated = await prisma.shift.update({ where: { id }, data, include: this.shiftInclude });
      return this.decorateShift(updated as any);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(`Shift code "${body.code}" already exists.`);
      }
      throw error;
    }
  },

  async deactivateShift(id: string, updatedById: string) {
    await this.assertExists('shift', id);
    const updated = await prisma.shift.update({
      where: { id },
      data: { isActive: false, updatedById, statusChangedAt: new Date(), statusChangedBy: await resolveActorLabel(updatedById) },
      include: this.shiftInclude,
    });
    return this.decorateShift(updated as any);
  },

  // ── shared existence guard ───────────────────────────────────────────
  async assertExists(model: 'department' | 'serviceRate' | 'ward' | 'room' | 'bed' | 'corporatePanel' | 'shift', id: string) {
    const record = await (prisma[model] as unknown as { findUnique: (args: { where: { id: string } }) => Promise<unknown> })
      .findUnique({ where: { id } });
    if (!record) throw new NotFoundError(`${model} not found`);
    return record;
  },
};
