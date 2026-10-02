import { prisma } from '@/db/client';
import { ConflictError, NotFoundError } from '@/shared/errors/AppError';
import type { UpdatePharmacySettingsBody, UpsertMarkupRuleBody, CreateMedicineCategoryBody, UpdateMedicineCategoryBody } from './settings.schemas';

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

  // ── Markup Rules (purchase-costing-plan) ──────────────────────────────
  async listMarkupRules() {
    return prisma.markupRule.findMany({ orderBy: { category: 'asc' } });
  },

  async upsertMarkupRule(body: UpsertMarkupRuleBody, actorId: string) {
    return prisma.markupRule.upsert({
      where: { category: body.category },
      create: { category: body.category, markupPercent: body.markupPercent, isActive: body.isActive, updatedById: actorId },
      update: { markupPercent: body.markupPercent, isActive: body.isActive, updatedById: actorId },
    });
  },

  async deleteMarkupRule(category: string) {
    const rule = await prisma.markupRule.findUnique({ where: { category } });
    if (!rule) throw new NotFoundError('Markup rule not found');
    await prisma.markupRule.delete({ where: { category } });
  },

  // ── Medicine Categories (Add-Medicine-form fix — database-driven Therapeutic Category master) ──
  /** All categories, active first — for the Settings management list. */
  async listMedicineCategories() {
    return prisma.medicineCategory.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  },

  async createMedicineCategory(body: CreateMedicineCategoryBody, actorId: string) {
    const dup = await prisma.medicineCategory.findUnique({ where: { name: body.name } });
    if (dup) throw new ConflictError('A category with this name already exists');
    return prisma.medicineCategory.create({ data: { name: body.name, description: body.description, createdById: actorId } });
  },

  /** Renaming keeps the same id — every medicine's categoryId relation (and the Edit form's dropdown selection) stays correct automatically. */
  async updateMedicineCategory(id: string, body: UpdateMedicineCategoryBody) {
    const existing = await prisma.medicineCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Category not found');
    if (body.name && body.name !== existing.name) {
      const dup = await prisma.medicineCategory.findUnique({ where: { name: body.name } });
      if (dup) throw new ConflictError('A category with this name already exists');
    }
    const updated = await prisma.medicineCategory.update({ where: { id }, data: body });
    // Keep every medicine's legacy categoryLabel string cache in sync with a rename — same pattern as baseUnit.name sync for packaging.
    if (body.name && body.name !== existing.name) {
      await prisma.medicineMaster.updateMany({ where: { categoryId: id }, data: { categoryLabel: updated.name } });
    }
    return updated;
  },

  // ── Testing Data Reset ────────────────────────────────────────────────
  async resetData(scope: 'transactions_only' | 'complete', actorId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Invoices & Payments & Dispenses
      await tx.pharmacyPayment.deleteMany({});
      await tx.pharmacyInvoiceLine.deleteMany({});
      const invoices = await tx.pharmacyInvoice.deleteMany({});

      // 2. HMS Requests
      await tx.medicineRequestLine.deleteMany({});
      await tx.medicineRequest.deleteMany({});

      // 3. Purchases, Purchase Orders & Vendor Ledgers
      await tx.purchaseOrderLine.deleteMany({});
      const purchaseOrders = await tx.purchaseOrder.deleteMany({});
      await tx.purchaseLine.deleteMany({});
      const purchases = await tx.purchase.deleteMany({});
      await tx.vendorLedgerEntry.deleteMany({});

      // 4. Stock & Inventory
      const stockEntries = await tx.stockLedgerEntry.deleteMany({});
      await tx.stockAdjustment.deleteMany({});
      const batches = await tx.medicineBatch.deleteMany({});

      // 5. Cash & Financials
      await tx.cashLedgerEntry.deleteMany({});
      await tx.accountSettlement.deleteMany({});
      await tx.expense.deleteMany({});

      // 6. Reset Sequences so counters start fresh from 1 (INV-0001, PO-0001, etc.)
      await tx.documentSequence.deleteMany({});

      let medicinesCount = 0;
      let vendorsCount = 0;

      // 7. If complete reset, wipe master catalogs as well
      if (scope === 'complete') {
        await tx.purchaseOrderLine.deleteMany({});
        await tx.purchaseOrder.deleteMany({});
        await tx.medicinePackagingLevel.deleteMany({});
        const medRes = await tx.medicineMaster.deleteMany({});
        const venRes = await tx.vendor.deleteMany({});
        await tx.medicineCategory.deleteMany({});
        medicinesCount = medRes.count;
        vendorsCount = venRes.count;
      }

      return {
        scope,
        resetBy: actorId,
        timestamp: new Date().toISOString(),
        cleared: {
          invoices: invoices.count,
          purchases: purchases.count,
          purchaseOrders: purchaseOrders.count,
          stockMovements: stockEntries.count,
          batches: batches.count,
          medicines: medicinesCount,
          vendors: vendorsCount,
        },
      };
    });
  },
};

