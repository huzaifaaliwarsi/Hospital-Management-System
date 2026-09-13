import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { NotFoundError } from '@/shared/errors/AppError';
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
} from './setup.schemas';

/**
 * §4.2 Hospital Setup & Master Data. Kept as a single service file for this
 * phase (routes → controller → service, no separate repository layer) —
 * each sub-resource here is a thin CRUD wrapper around one Prisma model.
 */
export const setupService = {
  // ── Hospital Profile (singleton) ────────────────────────────────────
  async getHospitalProfile() {
    const existing = await prisma.hospitalProfile.findFirst();
    // Unconfigured fields render "Not configured" client-side rather than
    // being fabricated here — an empty singleton is a valid response.
    return existing ?? (await prisma.hospitalProfile.create({ data: {} }));
  },

  async updateHospitalProfile(body: UpdateHospitalProfileBody, updatedBy: string) {
    const existing = await this.getHospitalProfile();
    return prisma.hospitalProfile.update({
      where: { id: existing.id },
      data: { ...body, updatedBy } as unknown as Prisma.HospitalProfileUpdateInput,
    });
  },

  // ── Departments ──────────────────────────────────────────────────────
  listDepartments(activeOnly = false) {
    return prisma.department.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  },

  createDepartment(body: CreateDepartmentBody, createdById: string) {
    return prisma.department.create({ data: { ...body, createdById } });
  },

  async updateDepartment(id: string, body: UpdateDepartmentBody, updatedById: string) {
    await this.assertExists('department', id);
    return prisma.department.update({ where: { id }, data: { ...body, updatedById } });
  },

  async deactivateDepartment(id: string) {
    await this.assertExists('department', id);
    return prisma.department.update({ where: { id }, data: { isActive: false } });
  },

  // ── Service Rates ────────────────────────────────────────────────────
  listServiceRates(activeOnly = false) {
    return prisma.serviceRate.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: { department: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  },

  createServiceRate(body: CreateServiceRateBody, createdById: string) {
    return prisma.serviceRate.create({ data: { ...body, createdById } });
  },

  async updateServiceRate(id: string, body: UpdateServiceRateBody) {
    await this.assertExists('serviceRate', id);
    // NOTE: changing standardRate here never rewrites rate_snapshot on
    // already-posted invoice lines (D15 §15) — those are frozen at billing time.
    return prisma.serviceRate.update({ where: { id }, data: body });
  },

  async deactivateServiceRate(id: string) {
    await this.assertExists('serviceRate', id);
    return prisma.serviceRate.update({ where: { id }, data: { isActive: false } });
  },

  // ── Wards / Rooms / Beds (Department → Ward → Room → Bed, §4.2) ─────
  listWardHierarchy() {
    return prisma.ward.findMany({
      include: { rooms: { include: { beds: true } } },
      orderBy: { name: 'asc' },
    });
  },

  createWard(body: CreateWardBody, createdById: string) {
    return prisma.ward.create({ data: { ...body, createdById } });
  },

  async updateWard(id: string, body: UpdateWardBody) {
    await this.assertExists('ward', id);
    return prisma.ward.update({ where: { id }, data: body });
  },

  createRoom(body: CreateRoomBody, createdById: string) {
    return prisma.room.create({ data: { ...body, createdById } });
  },

  async updateRoom(id: string, body: UpdateRoomBody) {
    await this.assertExists('room', id);
    return prisma.room.update({ where: { id }, data: body });
  },

  createBed(body: CreateBedBody, createdById: string) {
    return prisma.bed.create({ data: { ...body, createdById } });
  },

  async updateBed(id: string, body: UpdateBedBody) {
    await this.assertExists('bed', id);
    return prisma.bed.update({ where: { id }, data: body });
  },

  // ── Corporate Panels ─────────────────────────────────────────────────
  listCorporatePanels(activeOnly = false) {
    return prisma.corporatePanel.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: { discountRules: true },
      orderBy: { organizationName: 'asc' },
    });
  },

  createCorporatePanel(body: CreateCorporatePanelBody, createdById: string) {
    return prisma.corporatePanel.create({ data: { ...body, createdById } });
  },

  async updateCorporatePanel(id: string, body: UpdateCorporatePanelBody) {
    await this.assertExists('corporatePanel', id);
    return prisma.corporatePanel.update({ where: { id }, data: body });
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

  // ── shared existence guard ───────────────────────────────────────────
  async assertExists(model: 'department' | 'serviceRate' | 'ward' | 'room' | 'bed' | 'corporatePanel', id: string) {
    const record = await (prisma[model] as unknown as { findUnique: (args: { where: { id: string } }) => Promise<unknown> })
      .findUnique({ where: { id } });
    if (!record) throw new NotFoundError(`${model} not found`);
    return record;
  },
};
