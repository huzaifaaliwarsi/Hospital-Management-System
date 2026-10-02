import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError, ConflictError } from '@/shared/errors/AppError';
import { nextCode, peekNextCode, SEQUENCE } from '@/shared/sequence';
import type { Prisma } from '@prisma/client';
import type {
  CreateMedicineBody,
  UpdateMedicineBody,
  ListMedicinesQuery,
  CreateBatchBody,
  OpeningStockBody,
  DispenseRetailBody,
  AddPaymentBody,
  ListInvoicesQuery,
  StockAdjustmentBody,
  StockMovementsQuery,
  SalesReturnBody,
  PackagingLevelInput,
} from './pharmacy.schemas';

/** pharmacy.md §3 Settings screen — configured, not hardcoded; one singleton row, auto-created on first read. */
async function getSettings() {
  const existing = await prisma.pharmacySettings.findFirst();
  if (existing) return existing;
  return prisma.pharmacySettings.create({ data: {} });
}

/**
 * medicine-packaging-plan — validates and writes a medicine's full packaging
 * chain (level 0 = base unit, conversionToBase = 1, implicit from
 * baseUnitId; levels 1..n = the caller-supplied `packagingLevels`, sorted by
 * conversionToBase ascending). Shared by create and update (update replaces
 * the whole set — safe because historical PurchaseLine/MedicineBatch rows
 * hold their own frozen snapshot, never a live reference to this table).
 */
async function writePackagingLevels(
  tx: Prisma.TransactionClient,
  medicineId: string,
  baseUnitId: string,
  baseIsPurchaseUnit: boolean,
  baseIsSaleUnit: boolean,
  levels: PackagingLevelInput[],
) {
  const baseUnit = await tx.unit.findUnique({ where: { id: baseUnitId } });
  if (!baseUnit) throw new NotFoundError('Base unit not found');

  const unitIds = new Set([baseUnitId]);
  for (const lvl of levels) {
    if (lvl.conversionToBase <= 1) throw new ValidationError('Each packaging level must convert to more than 1 base unit');
    if (unitIds.has(lvl.unitId)) throw new ValidationError('The same unit cannot appear twice in a medicine\'s packaging');
    unitIds.add(lvl.unitId);
  }
  const unitsFound = await tx.unit.count({ where: { id: { in: [...unitIds] } } });
  if (unitsFound !== unitIds.size) throw new NotFoundError('One or more selected packaging units were not found');

  // "Default Purchase Unit" is singular by design (matches the UI's one dropdown) —
  // base unit + every level together may mark exactly one as the purchase unit.
  const purchaseUnitCount = (baseIsPurchaseUnit ? 1 : 0) + levels.filter((l) => l.isPurchaseUnit).length;
  if (purchaseUnitCount !== 1) throw new ValidationError('Choose exactly one Default Purchase Unit.');
  // At least one unit must be sellable from POS, or nothing could ever be dispensed.
  const saleUnitCount = (baseIsSaleUnit ? 1 : 0) + levels.filter((l) => l.isSaleUnit).length;
  if (saleUnitCount < 1) throw new ValidationError('At least one unit must be marked sellable.');

  const sorted = [...levels].sort((a, b) => a.conversionToBase - b.conversionToBase);

  await tx.medicinePackagingLevel.deleteMany({ where: { medicineId } });
  await tx.medicinePackagingLevel.create({
    data: { medicineId, unitId: baseUnitId, level: 0, conversionToBase: 1, isPurchaseUnit: baseIsPurchaseUnit, isSaleUnit: baseIsSaleUnit },
  });
  for (let i = 0; i < sorted.length; i++) {
    const lvl = sorted[i]!;
    await tx.medicinePackagingLevel.create({
      data: {
        medicineId,
        unitId: lvl.unitId,
        level: i + 1,
        conversionToBase: lvl.conversionToBase,
        isPurchaseUnit: lvl.isPurchaseUnit,
        isSaleUnit: lvl.isSaleUnit,
        overrideSaleRate: lvl.overrideSaleRate,
      },
    });
  }
  return baseUnit.name;
}

export interface BatchAllocation {
  batchId: string | null;
  quantity: Decimal;
}

/** pharmacy.md §9.1 FEFO — earliest valid expiry first, skips expired/zero-stock batches. Shared by POS and (later) HMS dispense. */
async function allocateFefoBatches(
  medicineId: string,
  requestedQuantity: Decimal,
  tx: Prisma.TransactionClient,
): Promise<BatchAllocation[]> {
  const medicine = await tx.medicineMaster.findUnique({
    where: { id: medicineId },
    include: { batches: { orderBy: { expiryDate: 'asc' }, include: { stockEntries: { select: { quantityDelta: true } } } } },
  });
  if (!medicine || !medicine.isActive) throw new NotFoundError(`Medicine ${medicineId} not found or inactive`);

  if (!medicine.batchManaged) {
    const entries = await tx.stockLedgerEntry.findMany({ where: { medicineId }, select: { quantityDelta: true } });
    const total = entries.reduce((sum, e) => sum.plus(e.quantityDelta), new Decimal(0));
    if (total.lessThan(requestedQuantity)) {
      throw new ValidationError(`Insufficient stock for "${medicine.name}". Available: ${total}, Requested: ${requestedQuantity}`);
    }
    return [{ batchId: null, quantity: requestedQuantity }];
  }

  const now = new Date();
  const withStock = medicine.batches
    .filter((b) => b.expiryDate > now)
    .map((b) => ({ id: b.id, available: b.stockEntries.reduce((s, e) => s.plus(e.quantityDelta), new Decimal(0)) }))
    .filter((b) => b.available.greaterThan(0));

  let remaining = requestedQuantity;
  const allocations: BatchAllocation[] = [];
  for (const batch of withStock) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const take = remaining.lessThan(batch.available) ? remaining : batch.available;
    allocations.push({ batchId: batch.id, quantity: take });
    remaining = remaining.minus(take);
  }
  if (remaining.greaterThan(0)) {
    const totalAvailable = withStock.reduce((s, b) => s.plus(b.available), new Decimal(0));
    throw new ValidationError(`Insufficient non-expired stock for "${medicine.name}". Available: ${totalAvailable} ${medicine.unit}, Requested: ${requestedQuantity} ${medicine.unit}`);
  }
  return allocations;
}

async function currentStock(medicineId: string): Promise<Decimal> {
  const entries = await prisma.stockLedgerEntry.findMany({ where: { medicineId }, select: { quantityDelta: true } });
  return entries.reduce((s, e) => s.plus(e.quantityDelta), new Decimal(0));
}

export const pharmacyService = {
  allocateFefoBatches,

  /** Preview only — not reserved. See `peekNextCode` doc comment. */
  async peekNextMedicineCode() {
    return peekNextCode(SEQUENCE.MEDICINE);
  },

  // ── Medicine Master (pharmacy.md §9) ────────────────────────────────────
  async createMedicine(body: CreateMedicineBody, actorId: string) {
    if (body.code) {
      const dup = await prisma.medicineMaster.findFirst({ where: { OR: [{ code: body.code }, ...(body.barcode ? [{ barcode: body.barcode }] : [])] } });
      if (dup) throw new ConflictError('Medicine code or barcode already exists');
    } else if (body.barcode) {
      const dup = await prisma.medicineMaster.findFirst({ where: { barcode: body.barcode } });
      if (dup) throw new ConflictError('Medicine code or barcode already exists');
    }
    const { baseUnitId, baseIsPurchaseUnit, baseIsSaleUnit, packagingLevels, code: requestedCode, categoryId, ...rest } = body;
    return prisma.$transaction(async (tx) => {
      const baseUnit = await tx.unit.findUnique({ where: { id: baseUnitId } });
      if (!baseUnit) throw new NotFoundError('Base unit not found');
      // Database-driven Therapeutic Category master — not required to be active (an inactive one can still be re-saved on an unrelated edit), just required to exist.
      let categoryLabel: string | null = null;
      if (categoryId) {
        const category = await tx.medicineCategory.findUnique({ where: { id: categoryId } });
        if (!category) throw new NotFoundError('Medicine category not found');
        categoryLabel = category.name;
      }
      // Authorized-override path keeps a client-supplied code; otherwise this is the ONLY place a Medicine Code is ever decided.
      const code = requestedCode || (await nextCode(tx, SEQUENCE.MEDICINE));
      const medicine = await tx.medicineMaster.create({ data: { ...rest, code, categoryId, categoryLabel, unit: baseUnit.name, baseUnitId, createdById: actorId } });
      // Throwing here (bad packaging level) rolls the whole transaction back — the medicine row never persists.
      await writePackagingLevels(tx, medicine.id, baseUnitId, baseIsPurchaseUnit, baseIsSaleUnit, packagingLevels);
      return medicine;
    });
  },

  async updateMedicine(id: string, body: UpdateMedicineBody) {
    const existing = await prisma.medicineMaster.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Medicine not found');
    if (body.code && body.code !== existing.code) {
      const dup = await prisma.medicineMaster.findFirst({ where: { code: body.code, id: { not: id } } });
      if (dup) throw new ConflictError('Medicine code already exists');
    }
    if (body.barcode && body.barcode !== existing.barcode) {
      const dup = await prisma.medicineMaster.findFirst({ where: { barcode: body.barcode, id: { not: id } } });
      if (dup) throw new ConflictError('Barcode already exists');
    }
    const { baseUnitId, baseIsPurchaseUnit, baseIsSaleUnit, packagingLevels, categoryId, ...rest } = body;
    return prisma.$transaction(async (tx) => {
      // Database-driven Therapeutic Category master — `categoryId` absent = leave untouched, explicit null = clear it, a uuid = set it (kept in sync with categoryLabel for legacy string readers).
      let categoryPatch: { categoryId?: string | null; categoryLabel?: string | null } = {};
      if (categoryId !== undefined) {
        if (categoryId === null) {
          categoryPatch = { categoryId: null, categoryLabel: null };
        } else {
          const category = await tx.medicineCategory.findUnique({ where: { id: categoryId } });
          if (!category) throw new NotFoundError('Medicine category not found');
          categoryPatch = { categoryId, categoryLabel: category.name };
        }
      }
      let unitPatch: { unit?: string; baseUnitId?: string } = {};
      const effectiveBaseUnitId = baseUnitId ?? existing.baseUnitId;
      if (baseUnitId || packagingLevels !== undefined) {
        const baseUnitName = await writePackagingLevels(
          tx,
          id,
          effectiveBaseUnitId,
          baseIsPurchaseUnit ?? true,
          baseIsSaleUnit ?? true,
          packagingLevels ?? [],
        );
        unitPatch = { unit: baseUnitName, baseUnitId: effectiveBaseUnitId };
      }
      return tx.medicineMaster.update({ where: { id }, data: { ...rest, ...unitPatch, ...categoryPatch } });
    });
  },

  /** Ordered packaging chain for Purchase/POS unit selectors (medicine-packaging-plan). */
  async getPackaging(medicineId: string) {
    const medicine = await prisma.medicineMaster.findUnique({ where: { id: medicineId } });
    if (!medicine) throw new NotFoundError('Medicine not found');
    const levels = await prisma.medicinePackagingLevel.findMany({
      where: { medicineId, isActive: true },
      include: { unit: true },
      orderBy: { level: 'asc' },
    });
    return { medicineId, baseUnitId: medicine.baseUnitId, levels };
  },

  async listMedicines(query: ListMedicinesQuery) {
    const [medicines, settings] = await Promise.all([
      prisma.medicineMaster.findMany({
        where: query.search
          ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }, { barcode: { contains: query.search, mode: 'insensitive' } }] }
          : undefined,
        include: { batches: true, stockEntries: { select: { quantityDelta: true } }, baseUnit: true, category: true, packagingLevels: { include: { unit: true }, orderBy: { level: 'asc' } } },
        orderBy: { name: 'asc' },
      }),
      getSettings(),
    ]);

    const now = new Date();
    const nearExpiryCutoff = new Date(now.getTime() + settings.nearExpiryWindowDays * 86_400_000);

    const rows = medicines.map((m) => {
      const stock = m.stockEntries.reduce((s, e) => s.plus(e.quantityDelta), new Decimal(0));
      const isLow = stock.lessThanOrEqualTo(m.reorderLevel);
      const isOut = stock.lessThanOrEqualTo(0);
      const hasExpired = m.batches.some((b) => b.expiryDate <= now);
      const hasNearExpiry = m.batches.some((b) => b.expiryDate > now && b.expiryDate <= nearExpiryCutoff);
      return {
        id: m.id,
        code: m.code,
        barcode: m.barcode,
        name: m.name,
        genericName: m.genericName,
        strength: m.strength,
        dosageForm: m.dosageForm,
        /// Flat string for old consumers (filters, CSV, table cell) — sourced from the relation, falling back to the legacy label cache.
        category: m.category?.name ?? m.categoryLabel,
        categoryId: m.categoryId,
        categoryActive: m.category?.isActive ?? null,
        unit: m.unit,
        baseUnitId: m.baseUnitId,
        baseUnit: m.baseUnit,
        packagingLevels: m.packagingLevels,
        batchManaged: m.batchManaged,
        reorderLevel: m.reorderLevel,
        purchaseRate: m.purchaseRate,
        saleRate: m.saleRate,
        taxPercent: m.taxPercent,
        isActive: m.isActive,
        currentStock: stock,
        batchesCount: m.batches.length,
        isLowStock: isLow && !isOut,
        isOutOfStock: isOut,
        hasExpiredBatch: hasExpired,
        hasNearExpiryBatch: hasNearExpiry,
      };
    });

    if (!query.stockStatus) return rows;
    return rows.filter((r) => {
      if (query.stockStatus === 'LOW') return r.isLowStock;
      if (query.stockStatus === 'OUT') return r.isOutOfStock;
      if (query.stockStatus === 'NEAR_EXPIRY') return r.hasNearExpiryBatch;
      return r.hasExpiredBatch;
    });
  },

  // ── Batches ──────────────────────────────────────────────────────────────
  async createBatch(medicineId: string, body: CreateBatchBody, actorId: string) {
    const medicine = await prisma.medicineMaster.findUnique({ where: { id: medicineId } });
    if (!medicine) throw new NotFoundError('Medicine not found');
    return prisma.medicineBatch.create({ data: { medicineId, ...body, createdById: actorId } });
  },

  async getMedicineBatches(medicineId: string) {
    const batches = await prisma.medicineBatch.findMany({ where: { medicineId }, include: { stockEntries: { select: { quantityDelta: true } }, purchaseUnit: true }, orderBy: { expiryDate: 'asc' } });
    const now = new Date();
    return batches.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      costRate: b.costRate,
      saleRate: b.saleRate,
      currentStock: b.stockEntries.reduce((s, e) => s.plus(e.quantityDelta), new Decimal(0)),
      isExpired: b.expiryDate <= now,
      // purchase-costing-plan — Purchase Return needs this batch's own frozen packaging snapshot, not the medicine's live default.
      purchaseUnitId: b.purchaseUnitId,
      purchaseUnit: b.purchaseUnit,
      purchaseUnitConversionToBase: b.purchaseUnitConversionToBase,
      packagingSnapshotJson: b.packagingSnapshotJson,
    }));
  },

  /** Authorized opening-stock / migration entry only — never the normal receiving path (that's Purchase, pharmacy.md §10.1). */
  async receiveOpeningStock(medicineId: string, batchId: string | null, body: OpeningStockBody, actorId: string) {
    const medicine = await prisma.medicineMaster.findUnique({ where: { id: medicineId } });
    if (!medicine) throw new NotFoundError('Medicine not found');
    if (batchId) {
      const batch = await prisma.medicineBatch.findUnique({ where: { id: batchId } });
      if (!batch || batch.medicineId !== medicineId) throw new NotFoundError('Batch not found for this medicine');
    }
    return prisma.stockLedgerEntry.create({
      data: {
        medicineId,
        batchId,
        movementType: 'OPENING_STOCK',
        quantityDelta: new Decimal(body.quantity),
        referenceTable: 'opening_stock',
        referenceId: medicineId,
        note: body.note,
        actorId,
      },
    });
  },

  async stockMovements(query: StockMovementsQuery) {
    return prisma.stockLedgerEntry.findMany({
      where: { medicineId: query.medicineId, movementType: query.movementType },
      include: { medicine: { select: { id: true, name: true, code: true } }, batch: { select: { id: true, batchNumber: true } }, actor: { select: { id: true, fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  },

  async createStockAdjustment(body: StockAdjustmentBody, actorId: string) {
    const medicine = await prisma.medicineMaster.findUnique({ where: { id: body.medicineId } });
    if (!medicine) throw new NotFoundError('Medicine not found');
    const isNegative = body.type !== 'SURPLUS';
    const delta = isNegative ? new Decimal(body.quantity).negated() : new Decimal(body.quantity);

    return prisma.$transaction(async (tx) => {
      const adjustmentNumber = await nextCode(tx, SEQUENCE.STOCK_ADJUSTMENT);
      const adjustment = await tx.stockAdjustment.create({
        data: { adjustmentNumber, medicineId: body.medicineId, batchId: body.batchId, type: body.type, quantity: new Decimal(body.quantity), reason: body.reason, createdById: actorId },
      });
      await tx.stockLedgerEntry.create({
        data: {
          medicineId: body.medicineId,
          batchId: body.batchId,
          movementType: isNegative ? 'NEGATIVE_ADJUSTMENT' : 'POSITIVE_ADJUSTMENT',
          quantityDelta: delta,
          referenceTable: 'stock_adjustments',
          referenceId: adjustment.id,
          note: body.reason,
          actorId,
        },
      });
      return adjustment;
    });
  },

  // ── POS Retail Dispensing (pharmacy.md §6 — real tax/discount/split payment/outstanding, §19.2 fix) ──
  async dispenseRetail(body: DispenseRetailBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      let subtotal = new Decimal(0);
      let discountTotal = new Decimal(0);
      let taxTotal = new Decimal(0);
      const linesToCreate: Prisma.PharmacyInvoiceLineCreateManyInvoiceInput[] = [];
      const stockDeductions: { medicineId: string; batchId: string | null; quantity: Decimal }[] = [];

      for (const reqLine of body.lines) {
        const medicine = await tx.medicineMaster.findUnique({ where: { id: reqLine.medicineId } });
        if (!medicine || !medicine.isActive) throw new NotFoundError(`Medicine ${reqLine.medicineId} not found or inactive`);

        // medicine-packaging-plan — resolve the sold unit (default: base unit) to a
        // base-unit quantity + an effective per-base-unit rate, ONCE per line; every
        // line below this (FEFO split across batches, discount, tax) is byte-for-byte
        // the pre-packaging base-unit math, now just fed a converted quantity/rate.
        const saleUnitId = reqLine.saleUnitId ?? medicine.baseUnitId;
        const packagingLevel = await tx.medicinePackagingLevel.findFirst({ where: { medicineId: medicine.id, unitId: saleUnitId, isActive: true, isSaleUnit: true } });
        if (!packagingLevel) throw new ValidationError(`Selected unit is not configured as a sale unit for "${medicine.name}"`);
        const conversionToBase = packagingLevel.conversionToBase;
        const reqQty = new Decimal(reqLine.saleUnitQuantity).mul(conversionToBase);
        const saleRate = packagingLevel.overrideSaleRate ? packagingLevel.overrideSaleRate.div(conversionToBase) : medicine.saleRate;
        const lineDiscount = new Decimal(reqLine.discountAmount || 0);
        const allocations = await allocateFefoBatches(medicine.id, reqQty, tx);

        for (let i = 0; i < allocations.length; i++) {
          const alloc = allocations[i]!;
          const allocGross = alloc.quantity.mul(saleRate);
          const allocDiscount = i === 0 ? lineDiscount : new Decimal(0);
          const taxable = allocGross.minus(allocDiscount);
          const allocTax = taxable.mul(medicine.taxPercent).div(100);
          const allocNet = taxable.plus(allocTax);

          subtotal = subtotal.plus(allocGross);
          discountTotal = discountTotal.plus(allocDiscount);
          taxTotal = taxTotal.plus(allocTax);

          linesToCreate.push({
            medicineId: medicine.id,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
            rateSnapshot: saleRate,
            discountAmount: allocDiscount,
            taxAmount: allocTax,
            lineNet: allocNet,
            saleUnitId,
            saleUnitQuantity: alloc.quantity.div(conversionToBase),
          });
          stockDeductions.push({ medicineId: medicine.id, batchId: alloc.batchId, quantity: alloc.quantity });
        }
      }

      const invoiceDiscount = new Decimal(body.invoiceDiscount || 0);

      // pharmacy.md §3 Settings "Tax/discount" policy — 0 means no cap configured.
      const settings = await tx.pharmacySettings.findFirst();
      const maxDiscountPercent = settings?.maxDiscountPercent ?? new Decimal(0);
      if (maxDiscountPercent.greaterThan(0) && subtotal.greaterThan(0)) {
        const discountPercent = discountTotal.plus(invoiceDiscount).div(subtotal).mul(100);
        if (discountPercent.greaterThan(maxDiscountPercent)) {
          throw new ValidationError(`Total discount (${discountPercent.toFixed(2)}%) exceeds the configured policy cap of ${maxDiscountPercent}%`);
        }
      }

      const total = subtotal.minus(discountTotal).plus(taxTotal).minus(invoiceDiscount);
      if (total.lessThan(0)) throw new ValidationError('Invoice discount exceeds the invoice total');

      const paidTotal = body.payments.reduce((s, p) => s.plus(p.amount), new Decimal(0));
      if (paidTotal.greaterThan(total)) throw new ValidationError('Payment amount exceeds invoice total');
      const outstanding = total.minus(paidTotal);
      const status = outstanding.lessThanOrEqualTo(0) ? 'PAID' : paidTotal.greaterThan(0) ? 'PARTIALLY_PAID' : 'UNPAID';

      const invoiceNumber = await nextCode(tx, SEQUENCE.INVOICE_RETAIL);
      const invoice = await tx.pharmacyInvoice.create({
        data: {
          invoiceNumber,
          channel: 'RETAIL',
          customerName: body.customerName,
          subtotal,
          discountTotal: discountTotal.plus(invoiceDiscount),
          taxTotal,
          total,
          paidTotal,
          outstanding,
          status,
          dispensedById: actorId,
          lines: { create: linesToCreate },
          payments: body.payments.length ? { create: body.payments.map((p) => ({ amount: new Decimal(p.amount), method: p.method, reference: p.reference, collectedById: actorId })) } : undefined,
        },
        include: { lines: { include: { medicine: true, batch: true, saleUnit: true } }, payments: true },
      });

      for (const d of stockDeductions) {
        await tx.stockLedgerEntry.create({
          data: { medicineId: d.medicineId, batchId: d.batchId, movementType: 'POS_SALE_OUT', quantityDelta: d.quantity.negated(), referenceTable: 'pharmacy_invoices', referenceId: invoice.id, actorId },
        });
      }

      if (paidTotal.greaterThan(0)) {
        const byMethod = new Map<string, Decimal>();
        for (const p of body.payments) byMethod.set(p.method, (byMethod.get(p.method) ?? new Decimal(0)).plus(p.amount));
        for (const [method, amount] of byMethod) {
          await tx.cashLedgerEntry.create({
            data: { portalUserId: actorId, direction: 'IN', amount, category: 'POS_COLLECTION', isPhysicalCash: method === 'CASH', referenceTable: 'pharmacy_invoices', referenceId: invoice.id },
          });
        }
      }

      return invoice;
    });
  },

  async addPayment(invoiceId: string, body: AddPaymentBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.pharmacyInvoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundError('Invoice not found');
      if (invoice.status === 'PAID') throw new ConflictError('Invoice is already fully paid');
      const amount = new Decimal(body.amount);
      if (amount.greaterThan(invoice.outstanding)) throw new ValidationError(`Payment exceeds outstanding balance of ${invoice.outstanding}`);

      await tx.pharmacyPayment.create({ data: { invoiceId, amount, method: body.method, reference: body.reference, collectedById: actorId } });
      const newPaid = invoice.paidTotal.plus(amount);
      const newOutstanding = invoice.outstanding.minus(amount);
      const newStatus = newOutstanding.lessThanOrEqualTo(0) ? 'PAID' : 'PARTIALLY_PAID';
      const newClearance = invoice.channel === 'HMS_LINKED' ? (newOutstanding.lessThanOrEqualTo(0) ? 'CLEARED' : 'OUTSTANDING') : undefined;

      const updated = await tx.pharmacyInvoice.update({
        where: { id: invoiceId },
        data: { paidTotal: newPaid, outstanding: newOutstanding, status: newStatus, ...(newClearance ? { clearanceStatus: newClearance } : {}) },
        include: { lines: true, payments: true },
      });

      await tx.cashLedgerEntry.create({
        data: { portalUserId: actorId, direction: 'IN', amount, category: invoice.channel === 'HMS_LINKED' ? 'HMS_COLLECTION' : 'POS_COLLECTION', isPhysicalCash: body.method === 'CASH', referenceTable: 'pharmacy_invoices', referenceId: invoiceId },
      });

      return updated;
    });
  },

  async listInvoices(query: ListInvoicesQuery) {
    return prisma.pharmacyInvoice.findMany({
      where: { channel: query.channel, status: query.status },
      include: { lines: { include: { medicine: { select: { name: true, code: true } } } }, payments: true, dispensedByUser: { select: { id: true, fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  },

  // ── Sales Return (pharmacy.md §9.1 SALES_RETURN_IN) ─────────────────────
  async salesReturn(body: SalesReturnBody, actorId: string) {
    const invoice = await prisma.pharmacyInvoice.findUnique({ where: { id: body.invoiceId }, include: { lines: true } });
    if (!invoice) throw new NotFoundError('Invoice not found');

    return prisma.$transaction(async (tx) => {
      let refundTotal = new Decimal(0);
      for (const returnLine of body.lines) {
        const line = invoice.lines.find((l) => l.id === returnLine.invoiceLineId);
        if (!line) throw new NotFoundError(`Invoice line ${returnLine.invoiceLineId} not found on invoice ${invoice.invoiceNumber}`);
        const qty = new Decimal(returnLine.quantity);
        if (qty.greaterThan(line.quantity)) throw new ValidationError(`Return quantity exceeds originally sold quantity (${line.quantity}) for this line`);

        const proportion = qty.div(line.quantity);
        const refundAmount = line.lineNet.mul(proportion);
        refundTotal = refundTotal.plus(refundAmount);

        if (returnLine.restock) {
          await tx.stockLedgerEntry.create({
            data: {
              medicineId: line.medicineId,
              batchId: line.batchId,
              movementType: 'SALES_RETURN_IN',
              quantityDelta: qty,
              referenceTable: 'pharmacy_invoices',
              referenceId: invoice.id,
              note: body.reason,
              actorId,
            },
          });
        }
      }

      const referenceNo = await nextCode(tx, SEQUENCE.RETURN);
      const refund = await tx.cashLedgerEntry.create({
        data: {
          portalUserId: actorId,
          direction: 'OUT',
          amount: refundTotal,
          category: 'REFUND',
          referenceNo,
          isPhysicalCash: body.refundMethod === 'CASH',
          referenceTable: 'pharmacy_invoices',
          referenceId: invoice.id,
          note: body.reason,
        },
      });

      return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, returnReferenceNo: referenceNo, refundTotal, refundMethod: body.refundMethod, cashLedgerEntryId: refund.id };
    });
  },

  async getInvoiceById(id: string) {
    const invoice = await prisma.pharmacyInvoice.findUnique({
      where: { id },
      include: { lines: { include: { medicine: true, batch: true, saleUnit: true } }, payments: { include: { collectedByUser: { select: { id: true, fullName: true } } } }, dispensedByUser: { select: { id: true, fullName: true } } },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  },

  currentStock,
};
