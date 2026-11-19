import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError, ConflictError, AuthorizationError } from '@/shared/errors/AppError';
import { nextCode, peekNextCode, SEQUENCE } from '@/shared/sequence';
import { Prisma } from '@prisma/client';
import { invoiceTransactions, summarizeInvoiceTransactions } from './invoiceTransactions';
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
  BulkImportBody,
  PosCatalogQuery,
} from './pharmacy.schemas';

/** pharmacy.md §3 Settings screen — configured, not hardcoded; one singleton row, auto-created on first read. */
async function getSettings(db: Prisma.TransactionClient = prisma) {
  const existing = await db.pharmacySettings.findFirst();
  if (existing) return existing;
  return db.pharmacySettings.create({ data: {} });
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
  saleRate: Decimal;
  costRate: Decimal;
}

/** FEFO (earliest valid expiry first) with FIFO tie-breaker (oldest batch first), skipping expired/zero-stock batches. */
async function allocateFefoBatches(
  medicineId: string,
  requestedQuantity: Decimal,
  tx: Prisma.TransactionClient,
  reserved: { medicineId: string; batchId: string | null; quantity: Decimal }[] = [],
): Promise<BatchAllocation[]> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pharmacy-stock'))`;
  const medicine = await tx.medicineMaster.findUnique({
    where: { id: medicineId },
    include: { batches: { orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }], include: { stockEntries: { select: { quantityDelta: true } } } } },
  });
  if (!medicine || !medicine.isActive) throw new NotFoundError(`Medicine ${medicineId} not found or inactive`);

  if (!medicine.batchManaged) {
    const entries = await tx.stockLedgerEntry.findMany({ where: { medicineId }, select: { quantityDelta: true } });
    const total = entries.reduce((sum, e) => sum.plus(e.quantityDelta), new Decimal(0))
      .minus(reserved.filter(r => r.medicineId === medicineId).reduce((sum, r) => sum.plus(r.quantity), new Decimal(0)));
    if (total.lessThan(requestedQuantity)) {
      throw new ValidationError(`Insufficient stock for "${medicine.name}". Available: ${total}, Requested: ${requestedQuantity}`);
    }
    return [{
      batchId: null,
      quantity: requestedQuantity,
      saleRate: medicine.saleRate,
      costRate: medicine.purchaseRate ?? new Decimal(0),
    }];
  }

  const now = new Date();
  const withStock = medicine.batches
    .filter((b) => b.expiryDate > now)
    .map((b) => ({
      id: b.id,
      saleRate: b.saleRate ?? medicine.saleRate,
      costRate: b.costRate,
      available: b.stockEntries.reduce((s, e) => s.plus(e.quantityDelta), new Decimal(0))
        .minus(reserved.filter(r => r.medicineId === medicineId && r.batchId === b.id).reduce((sum, r) => sum.plus(r.quantity), new Decimal(0))),
    }))
    .filter((b) => b.available.greaterThan(0));

  let remaining = requestedQuantity;
  const allocations: BatchAllocation[] = [];
  for (const batch of withStock) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const take = remaining.lessThan(batch.available) ? remaining : batch.available;
    allocations.push({
      batchId: batch.id,
      quantity: take,
      saleRate: batch.saleRate,
      costRate: batch.costRate,
    });
    remaining = remaining.minus(take);
  }
  if (remaining.greaterThan(0)) {
    const totalAvailable = withStock.reduce((s, b) => s.plus(b.available), new Decimal(0));
    throw new ValidationError(`Insufficient non-expired stock for "${medicine.name}". Available: ${totalAvailable} ${medicine.unit}, Requested: ${requestedQuantity} ${medicine.unit}`);
  }
  return allocations;
}

/**
 * Syncs `medicineMaster.saleRate` to the active FEFO/FIFO batch's selling price
 * (the earliest-expiring, oldest-created non-expired batch with stock > 0).
 * Keeps Medicine Master display/fallback pricing aligned with the next batch to dispense.
 */
async function syncEffectiveSaleRate(medicineId: string, tx: Prisma.TransactionClient): Promise<void> {
  const medicine = await tx.medicineMaster.findUnique({
    where: { id: medicineId },
    include: {
      batches: {
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        include: { stockEntries: { select: { quantityDelta: true } } },
      },
    },
  });
  if (!medicine || !medicine.batchManaged) return;

  const now = new Date();
  const activeBatch = medicine.batches.find((b) => {
    if (b.expiryDate <= now) return false;
    const available = b.stockEntries.reduce((s, e) => s.plus(e.quantityDelta), new Decimal(0));
    return available.greaterThan(0);
  });

  if (activeBatch && activeBatch.saleRate !== null && !medicine.saleRate.equals(activeBatch.saleRate)) {
    await tx.medicineMaster.update({
      where: { id: medicineId },
      data: { saleRate: activeBatch.saleRate },
    });
  }
}

async function currentStock(medicineId: string): Promise<Decimal> {
  const entries = await prisma.stockLedgerEntry.findMany({ where: { medicineId }, select: { quantityDelta: true } });
  return entries.reduce((s, e) => s.plus(e.quantityDelta), new Decimal(0));
}

export const pharmacyService = {
  allocateFefoBatches,
  syncEffectiveSaleRate,

  /** Preview only — not reserved. See `peekNextCode` doc comment. */
  async peekNextMedicineCode() {
    return peekNextCode(SEQUENCE.MEDICINE);
  },

  // ── Medicine Master (pharmacy.md §9) ────────────────────────────────────
  async createMedicine(body: CreateMedicineBody, actorId: string) {
    const rawBarcode = body.barcode?.trim() || null;
    const rawCode = body.code?.trim() || null;
    const rawGenericName = body.genericName?.trim() || null;
    const rawStrength = body.strength?.trim() || null;
    const rawDosageForm = body.dosageForm?.trim() || null;
    const rawCategory = (body as any).category?.trim() || null;

    if (rawCode) {
      const dup = await prisma.medicineMaster.findFirst({
        where: {
          OR: [
            { code: rawCode },
            ...(rawBarcode ? [{ barcode: rawBarcode }] : [])
          ]
        }
      });
      if (dup) {
        if (dup.code === rawCode) throw new ConflictError(`Medicine code "${rawCode}" already exists`);
        if (rawBarcode && dup.barcode === rawBarcode) throw new ConflictError(`Barcode "${rawBarcode}" already exists`);
        throw new ConflictError('Medicine code or barcode already exists');
      }
    } else if (rawBarcode) {
      const dup = await prisma.medicineMaster.findFirst({ where: { barcode: rawBarcode } });
      if (dup) throw new ConflictError(`Barcode "${rawBarcode}" already exists`);
    }

    const {
      baseUnitId,
      baseIsPurchaseUnit,
      baseIsSaleUnit,
      packagingLevels,
      code: _c,
      barcode: _b,
      genericName: _g,
      strength: _s,
      dosageForm: _d,
      category: _cat,
      categoryId,
      openingStock,
      openingBatchNumber,
      openingExpiryDate,
      openingCostRate,
      ...rest
    } = body as any;

    return prisma.$transaction(async (tx) => {
      const baseUnit = await tx.unit.findUnique({ where: { id: baseUnitId } });
      if (!baseUnit) throw new NotFoundError('Base unit not found');

      let categoryLabel: string | null = null;
      if (categoryId) {
        const category = await tx.medicineCategory.findUnique({ where: { id: categoryId } });
        if (!category) throw new NotFoundError('Medicine category not found');
        categoryLabel = category.name;
      } else if (rawCategory) {
        categoryLabel = rawCategory;
      }

      // If no code requested, automatically generate next sequence; otherwise advance sequence
      let code = rawCode;
      if (!code) {
        code = await nextCode(tx, SEQUENCE.MEDICINE);
      } else {
        const match = code.match(/^MED-(\d+)$/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num)) {
            await tx.$executeRaw`
              INSERT INTO document_sequences (key, last_value, updated_at)
              VALUES (${SEQUENCE.MEDICINE.key}, ${num}, now())
              ON CONFLICT (key) DO UPDATE SET last_value = GREATEST(document_sequences.last_value, ${num}), updated_at = now()
            `;
          }
        }
      }

      const medicine = await tx.medicineMaster.create({
        data: {
          ...rest,
          code,
          barcode: rawBarcode,
          genericName: rawGenericName,
          strength: rawStrength,
          dosageForm: rawDosageForm,
          categoryId: categoryId || null,
          categoryLabel,
          unit: baseUnit.name,
          baseUnitId,
          createdById: actorId
        }
      });

      // Throwing here (bad packaging level) rolls the whole transaction back — the medicine row never persists.
      await writePackagingLevels(tx, medicine.id, baseUnitId, baseIsPurchaseUnit, baseIsSaleUnit, packagingLevels);

      // Handle direct Opening Stock (if provided)
      const opStockNum = Number(openingStock) || 0;
      if (opStockNum > 0) {
        if (medicine.batchManaged) {
          const batchNumber = openingBatchNumber?.trim() || '';
          let expiryDate = openingExpiryDate ? new Date(openingExpiryDate) : null;
          if (!expiryDate || isNaN(expiryDate.getTime())) {
            expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          }
          const costRate = openingCostRate !== undefined && openingCostRate !== null
            ? new Decimal(openingCostRate)
            : medicine.purchaseRate ?? medicine.saleRate.mul(0.8);

          const batch = await tx.medicineBatch.create({
            data: {
              medicineId: medicine.id,
              batchNumber,
              expiryDate,
              costRate,
              saleRate: medicine.saleRate,
              createdById: actorId,
            },
          });

          await tx.stockLedgerEntry.create({
            data: {
              medicineId: medicine.id,
              batchId: batch.id,
              movementType: 'OPENING_STOCK',
              quantityDelta: new Decimal(opStockNum),
              referenceTable: 'opening_stock',
              referenceId: batch.id,
              note: `Opening stock on creation (${opStockNum} ${baseUnit.name})`,
              actorId,
            },
          });
        } else {
          await tx.stockLedgerEntry.create({
            data: {
              medicineId: medicine.id,
              batchId: null,
              movementType: 'OPENING_STOCK',
              quantityDelta: new Decimal(opStockNum),
              referenceTable: 'opening_stock',
              referenceId: medicine.id,
              note: `Opening stock on creation (${opStockNum} ${baseUnit.name})`,
              actorId,
            },
          });
        }
        await syncEffectiveSaleRate(medicine.id, tx);
      }

      return medicine;
    });
  },

  async updateMedicine(id: string, body: UpdateMedicineBody) {
    const existing = await prisma.medicineMaster.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Medicine not found');

    const rawBarcode = body.barcode !== undefined ? (body.barcode?.trim() || null) : undefined;
    const rawCode = body.code !== undefined ? (body.code?.trim() || null) : undefined;

    if (rawCode && rawCode !== existing.code) {
      const dup = await prisma.medicineMaster.findFirst({ where: { code: rawCode, id: { not: id } } });
      if (dup) throw new ConflictError(`Medicine code "${rawCode}" already exists`);
    }
    if (rawBarcode && rawBarcode !== existing.barcode) {
      const dup = await prisma.medicineMaster.findFirst({ where: { barcode: rawBarcode, id: { not: id } } });
      if (dup) throw new ConflictError(`Barcode "${rawBarcode}" already exists`);
    }
    const { baseUnitId, baseIsPurchaseUnit, baseIsSaleUnit, packagingLevels, categoryId, code: _c, barcode: _b, ...rest } = body as any;
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
      if (rest.saleRate !== undefined) {
        await tx.medicineBatch.updateMany({
          where: { medicineId: id },
          data: { saleRate: rest.saleRate },
        });
      }
      return tx.medicineMaster.update({ where: { id }, data: { ...rest, ...unitPatch, ...categoryPatch } });
    });
  },

  async deleteMedicine(id: string, actorId: string) {
    const existing = await prisma.medicineMaster.findUnique({
      where: { id },
      include: {
        batches: {
          include: {
            stockEntries: { select: { quantityDelta: true } },
          },
        },
        stockEntries: { select: { quantityDelta: true } },
        _count: {
          select: {
            invoiceLines: true,
            requestLines: true,
            purchaseLines: true,
            purchaseOrderLines: true,
          },
        },
      },
    });

    if (!existing) throw new NotFoundError('Medicine not found');

    const adjustmentsCount = await prisma.stockAdjustment.count({ where: { medicineId: id } });
    const hasHistory =
      existing._count.invoiceLines > 0 ||
      existing._count.requestLines > 0 ||
      existing._count.purchaseLines > 0 ||
      existing._count.purchaseOrderLines > 0 ||
      adjustmentsCount > 0;

    return prisma.$transaction(async (tx) => {
      // 1. Calculate and deduct any remaining stock so inventory balances reach 0
      if (existing.batchManaged) {
        for (const batch of existing.batches) {
          const batchStock = batch.stockEntries.reduce((sum, e) => sum.plus(e.quantityDelta), new Decimal(0));
          if (batchStock.greaterThan(0)) {
            await tx.stockLedgerEntry.create({
              data: {
                medicineId: id,
                batchId: batch.id,
                movementType: 'NEGATIVE_ADJUSTMENT',
                quantityDelta: batchStock.negated(),
                referenceTable: 'medicine_deletion',
                referenceId: id,
                note: `Stock written off on medicine removal (${batchStock} ${existing.unit})`,
                actorId,
              },
            });
          }
        }
      } else {
        const totalStock = existing.stockEntries.reduce((sum, e) => sum.plus(e.quantityDelta), new Decimal(0));
        if (totalStock.greaterThan(0)) {
          await tx.stockLedgerEntry.create({
            data: {
              medicineId: id,
              batchId: null,
              movementType: 'NEGATIVE_ADJUSTMENT',
              quantityDelta: totalStock.negated(),
              referenceTable: 'medicine_deletion',
              referenceId: id,
              note: `Stock written off on medicine removal (${totalStock} ${existing.unit})`,
              actorId,
            },
          });
        }
      }

      // 2. If medicine has historical transactional records, soft-delete to preserve data integrity
      if (hasHistory) {
        await tx.medicinePackagingLevel.updateMany({
          where: { medicineId: id },
          data: { isActive: false },
        });

        const timestamp = Date.now();
        const updated = await tx.medicineMaster.update({
          where: { id },
          data: {
            isActive: false,
            code: `${existing.code}_del_${timestamp}`,
            barcode: existing.barcode ? `${existing.barcode}_del_${timestamp}` : null,
          },
        });
        return { id: updated.id, success: true, mode: 'deactivated' };
      }

      // 3. Otherwise, if no transactional history exists, hard-delete completely
      await tx.stockLedgerEntry.deleteMany({ where: { medicineId: id } });
      await tx.medicinePackagingLevel.deleteMany({ where: { medicineId: id } });
      await tx.medicineBatch.deleteMany({ where: { medicineId: id } });
      await tx.medicineMaster.delete({ where: { id } });

      return { id, success: true, mode: 'deleted' };
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

  async listMedicines(query: ListMedicinesQuery, transaction?: Prisma.TransactionClient) {
    const db = transaction ?? prisma;
    const isPaginated = query.paginated === 'true' || query.page !== undefined;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [settings] = await Promise.all([getSettings(db)]);
    const now = new Date();
    const nearExpiryCutoff = new Date(now.getTime() + settings.nearExpiryWindowDays * 86_400_000);

    const where: Prisma.MedicineMasterWhereInput = {};

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { genericName: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (query.category && query.category !== 'ALL') {
      where.OR = [
        { category: { name: query.category } },
        { categoryLabel: query.category },
        { categoryId: query.category },
      ];
    } else if (query.categoryId && query.categoryId !== 'ALL') {
      where.categoryId = query.categoryId;
    }

    if (query.unit && query.unit !== 'ALL') {
      where.unit = query.unit;
    }

    if (query.stockStatus === 'EXPIRED') {
      where.batches = { some: { expiryDate: { lte: now } } };
    } else if (query.stockStatus === 'NEAR_EXPIRY') {
      where.batches = { some: { expiryDate: { gt: now, lte: nearExpiryCutoff } } };
    } else if (query.stockStatus === 'OUT') {
      const outMeds = await prisma.$queryRaw<Array<{ medicine_id: string }>>`
        SELECT m.id AS medicine_id
        FROM medicine_masters m
        LEFT JOIN stock_ledger_entries sle ON sle.medicine_id = m.id
        GROUP BY m.id
        HAVING COALESCE(SUM(sle.quantity_delta), 0) <= 0
      `;
      where.id = { in: outMeds.map((r) => r.medicine_id) };
    } else if (query.stockStatus === 'LOW') {
      const lowMeds = await prisma.$queryRaw<Array<{ medicine_id: string }>>`
        SELECT m.id AS medicine_id
        FROM medicine_masters m
        JOIN stock_ledger_entries sle ON sle.medicine_id = m.id
        GROUP BY m.id, m.reorder_level
        HAVING SUM(sle.quantity_delta) > 0 AND SUM(sle.quantity_delta) <= m.reorder_level
      `;
      where.id = { in: lowMeds.map((r) => r.medicine_id) };
    } else if (query.stockStatus === 'OK') {
      const okMeds = await prisma.$queryRaw<Array<{ medicine_id: string }>>`
        SELECT m.id AS medicine_id
        FROM medicine_masters m
        JOIN stock_ledger_entries sle ON sle.medicine_id = m.id
        GROUP BY m.id, m.reorder_level
        HAVING SUM(sle.quantity_delta) > m.reorder_level
      `;
      where.id = { in: okMeds.map((r) => r.medicine_id) };
    }

    const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    const orderBy: Prisma.MedicineMasterOrderByWithRelationInput[] = [];
    if (query.sortBy === 'code') orderBy.push({ code: sortOrder });
    else if (query.sortBy === 'saleRate') orderBy.push({ saleRate: sortOrder });
    else if (query.sortBy === 'reorderLevel') orderBy.push({ reorderLevel: sortOrder });
    else if (query.sortBy === 'createdAt') orderBy.push({ createdAt: sortOrder });
    else if (query.sortBy === 'unit') orderBy.push({ unit: sortOrder });
    else if (query.sortBy === 'category') orderBy.push({ category: { name: sortOrder } });
    else orderBy.push({ name: sortOrder });

    let total = 0;
    let summary: any = undefined;

    if (isPaginated) {
      const [countResult, totalCount, outRows, lowRows, categoriesCount] = await Promise.all([
        db.medicineMaster.count({ where }),
        db.medicineMaster.count(),
        db.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count FROM (
            SELECT m.id
            FROM medicine_masters m
            LEFT JOIN stock_ledger_entries sle ON sle.medicine_id = m.id
            GROUP BY m.id
            HAVING COALESCE(SUM(sle.quantity_delta), 0) <= 0
          ) sub
        `,
        db.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count FROM (
            SELECT m.id
            FROM medicine_masters m
            JOIN stock_ledger_entries sle ON sle.medicine_id = m.id
            GROUP BY m.id, m.reorder_level
            HAVING SUM(sle.quantity_delta) > 0 AND SUM(sle.quantity_delta) <= m.reorder_level
          ) sub
        `,
        db.medicineCategory.count({ where: { isActive: true } }),
      ]);

      total = countResult;
      const outOfStockCount = Number(outRows[0]?.count || 0);
      const lowStockCount = Number(lowRows[0]?.count || 0);
      const normalStockCount = Math.max(0, totalCount - outOfStockCount - lowStockCount);

      summary = {
        totalItems: totalCount,
        outOfStockCount,
        lowStockCount,
        normalStockCount,
        categoriesCount,
      };
    }

    const medicines = await db.medicineMaster.findMany({
      where,
      include: {
        baseUnit: true,
        category: true,
        packagingLevels: { include: { unit: true }, orderBy: { level: 'asc' } },
      },
      orderBy,
      ...(isPaginated ? { skip, take: limit } : {}),
    });

    if (medicines.length === 0) {
      if (isPaginated) {
        return {
          items: [],
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          summary,
        };
      }
      return [];
    }

    const medIds = medicines.map((m) => m.id);

    const [stockAgg, activeBatchesAgg, batchCountsAgg] = await Promise.all([
      db.$queryRaw<Array<{ medicine_id: string; stock: Decimal | number | string }>>`
        SELECT medicine_id, COALESCE(SUM(quantity_delta), 0) AS stock
        FROM stock_ledger_entries
        WHERE medicine_id IN (${Prisma.join(medIds)})
        GROUP BY medicine_id
      `,
      db.$queryRaw<Array<{
        id: string;
        medicine_id: string;
        batch_number: string;
        expiry_date: Date;
        sale_rate: Decimal | null;
        cost_rate: Decimal;
        available: Decimal | number | string;
      }>>`
        SELECT 
          b.id,
          b.medicine_id,
          b.batch_number,
          b.expiry_date,
          b.sale_rate,
          b.cost_rate,
          COALESCE(SUM(sle.quantity_delta), 0) AS available
        FROM medicine_batches b
        LEFT JOIN stock_ledger_entries sle ON sle.batch_id = b.id
        WHERE b.medicine_id IN (${Prisma.join(medIds)}) AND b.expiry_date > ${now}
        GROUP BY b.id, b.medicine_id, b.batch_number, b.expiry_date, b.sale_rate, b.cost_rate
        HAVING COALESCE(SUM(sle.quantity_delta), 0) > 0
        ORDER BY b.expiry_date ASC, b.created_at ASC
      `,
      db.$queryRaw<Array<{
        medicine_id: string;
        batches_count: bigint | number;
        expired_count: bigint | number;
        near_expiry_count: bigint | number;
      }>>`
        SELECT 
          medicine_id,
          COUNT(id) AS batches_count,
          COUNT(CASE WHEN expiry_date <= ${now} THEN 1 END) AS expired_count,
          COUNT(CASE WHEN expiry_date > ${now} AND expiry_date <= ${nearExpiryCutoff} THEN 1 END) AS near_expiry_count
        FROM medicine_batches
        WHERE medicine_id IN (${Prisma.join(medIds)})
        GROUP BY medicine_id
      `,
    ]);

    const stockMap = new Map<string, Decimal>();
    stockAgg.forEach((r) => {
      stockMap.set(r.medicine_id, new Decimal(r.stock.toString()));
    });

    const activeBatchesMap = new Map<string, any[]>();
    activeBatchesAgg.forEach((b) => {
      const list = activeBatchesMap.get(b.medicine_id) || [];
      list.push({
        id: b.id,
        batchNumber: b.batch_number,
        expiryDate: b.expiry_date,
        saleRate: b.sale_rate,
        costRate: b.cost_rate,
        available: new Decimal(b.available.toString()),
      });
      activeBatchesMap.set(b.medicine_id, list);
    });

    const batchCountsMap = new Map<string, { total: number; expired: number; nearExpiry: number }>();
    batchCountsAgg.forEach((b) => {
      batchCountsMap.set(b.medicine_id, {
        total: Number(b.batches_count),
        expired: Number(b.expired_count),
        nearExpiry: Number(b.near_expiry_count),
      });
    });

    const rows = medicines.map((m) => {
      const stock = stockMap.get(m.id) || new Decimal(0);
      const isLow = stock.lessThanOrEqualTo(m.reorderLevel);
      const isOut = stock.lessThanOrEqualTo(0);
      const bCounts = batchCountsMap.get(m.id) || { total: 0, expired: 0, nearExpiry: 0 };
      const rawActiveBatches = activeBatchesMap.get(m.id) || [];
      const activeBatches = rawActiveBatches.map((b) => ({
        ...b,
        saleRate: b.saleRate ?? m.saleRate,
      }));

      return {
        id: m.id,
        code: m.code,
        barcode: m.barcode,
        name: m.name,
        genericName: m.genericName,
        strength: m.strength,
        dosageForm: m.dosageForm,
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
        batchesCount: bCounts.total,
        activeBatches,
        isLowStock: isLow && !isOut,
        isOutOfStock: isOut,
        hasExpiredBatch: bCounts.expired > 0,
        hasNearExpiryBatch: bCounts.nearExpiry > 0,
      };
    });

    if (query.sortBy === 'currentStock' || query.sortBy === 'stockValue' || query.sortBy === 'status') {
      rows.sort((a, b) => {
        let cmp = 0;
        if (query.sortBy === 'currentStock') {
          cmp = a.currentStock.minus(b.currentStock).toNumber();
        } else if (query.sortBy === 'stockValue') {
          const valA = a.currentStock.times(a.saleRate);
          const valB = b.currentStock.times(b.saleRate);
          cmp = valA.minus(valB).toNumber();
        } else if (query.sortBy === 'status') {
          const rankA = a.isOutOfStock ? 2 : a.isLowStock ? 1 : 0;
          const rankB = b.isOutOfStock ? 2 : b.isLowStock ? 1 : 0;
          cmp = rankA - rankB;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    if (isPaginated) {
      return {
        items: rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        summary,
      };
    }

    return rows;
  },

  // ── POS Fast Lightweight Catalog (pharmacy-performance-batch-2) ──────────
  async getPosCatalog(query?: PosCatalogQuery, transaction?: Prisma.TransactionClient) {
    const db = transaction ?? prisma;
    const where: Prisma.MedicineMasterWhereInput = {
      isActive: true,
    };

    if (query?.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { genericName: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (query?.category && query.category !== 'ALL') {
      where.OR = [
        { category: { name: query.category } },
        { categoryLabel: query.category },
        { categoryId: query.category },
      ];
    } else if (query?.categoryId && query.categoryId !== 'ALL') {
      where.categoryId = query.categoryId;
    }

    const medicines = await db.medicineMaster.findMany({
      where,
      select: {
        id: true,
        code: true,
        barcode: true,
        name: true,
        genericName: true,
        strength: true,
        dosageForm: true,
        category: { select: { id: true, name: true, isActive: true } },
        categoryLabel: true,
        categoryId: true,
        unit: true,
        baseUnitId: true,
        baseUnit: { select: { id: true, name: true, shortCode: true } },
        packagingLevels: {
          where: { isActive: true },
          select: {
            id: true,
            unitId: true,
            level: true,
            conversionToBase: true,
            isPurchaseUnit: true,
            isSaleUnit: true,
            overrideSaleRate: true,
            unit: { select: { id: true, name: true, shortCode: true } },
          },
          orderBy: { level: 'asc' },
        },
        batchManaged: true,
        reorderLevel: true,
        saleRate: true,
        taxPercent: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    if (medicines.length === 0) return [];

    const medIds = medicines.map((m) => m.id);
    const now = new Date();

    const [stockAgg, activeBatchesAgg] = await Promise.all([
      db.$queryRaw<Array<{ medicine_id: string; stock: Decimal | number | string }>>`
        SELECT medicine_id, COALESCE(SUM(quantity_delta), 0) AS stock
        FROM stock_ledger_entries
        WHERE medicine_id IN (${Prisma.join(medIds)})
        GROUP BY medicine_id
      `,
      db.$queryRaw<Array<{
        id: string;
        medicine_id: string;
        batch_number: string;
        expiry_date: Date;
        sale_rate: Decimal | null;
        cost_rate: Decimal;
        available: Decimal | number | string;
      }>>`
        SELECT 
          b.id,
          b.medicine_id,
          b.batch_number,
          b.expiry_date,
          b.sale_rate,
          b.cost_rate,
          COALESCE(SUM(sle.quantity_delta), 0) AS available
        FROM medicine_batches b
        LEFT JOIN stock_ledger_entries sle ON sle.batch_id = b.id
        WHERE b.medicine_id IN (${Prisma.join(medIds)}) AND b.expiry_date > ${now}
        GROUP BY b.id, b.medicine_id, b.batch_number, b.expiry_date, b.sale_rate, b.cost_rate
        HAVING COALESCE(SUM(sle.quantity_delta), 0) > 0
        ORDER BY b.expiry_date ASC, b.created_at ASC
      `,
    ]);

    const stockMap = new Map<string, Decimal>();
    stockAgg.forEach((r) => {
      stockMap.set(r.medicine_id, new Decimal(r.stock.toString()));
    });

    const activeBatchesMap = new Map<string, any[]>();
    activeBatchesAgg.forEach((b) => {
      const list = activeBatchesMap.get(b.medicine_id) || [];
      list.push({
        id: b.id,
        batchNumber: b.batch_number,
        expiryDate: b.expiry_date,
        saleRate: b.sale_rate,
        costRate: b.cost_rate,
        available: new Decimal(b.available.toString()),
      });
      activeBatchesMap.set(b.medicine_id, list);
    });

    return medicines.map((m) => {
      const stock = stockMap.get(m.id) || new Decimal(0);
      const isLow = stock.lessThanOrEqualTo(m.reorderLevel);
      const isOut = stock.lessThanOrEqualTo(0);
      const rawActiveBatches = activeBatchesMap.get(m.id) || [];
      const activeBatches = rawActiveBatches.map((b) => ({
        ...b,
        saleRate: b.saleRate ?? m.saleRate,
      }));

      return {
        id: m.id,
        code: m.code,
        barcode: m.barcode,
        name: m.name,
        genericName: m.genericName,
        strength: m.strength,
        dosageForm: m.dosageForm,
        category: m.category?.name ?? m.categoryLabel,
        categoryId: m.categoryId,
        categoryActive: m.category?.isActive ?? null,
        unit: m.unit,
        baseUnitId: m.baseUnitId,
        baseUnit: m.baseUnit,
        packagingLevels: m.packagingLevels,
        batchManaged: m.batchManaged,
        reorderLevel: m.reorderLevel,
        saleRate: m.saleRate,
        taxPercent: m.taxPercent,
        isActive: m.isActive,
        currentStock: stock,
        batchesCount: activeBatches.length,
        activeBatches,
        isLowStock: isLow && !isOut,
        isOutOfStock: isOut,
        hasExpiredBatch: false,
        hasNearExpiryBatch: false,
      };
    });
  },

  async getMedicinesStock(medicineIds: string[], tx?: Prisma.TransactionClient) {
    if (medicineIds.length === 0) return [];
    const client = tx ?? prisma;
    const now = new Date();

    const [medicines, stockAgg, activeBatchesAgg] = await Promise.all([
      client.medicineMaster.findMany({
        where: { id: { in: medicineIds } },
        select: { id: true, reorderLevel: true, saleRate: true },
      }),
      client.$queryRaw<Array<{ medicine_id: string; stock: Decimal | number | string }>>`
        SELECT medicine_id, COALESCE(SUM(quantity_delta), 0) AS stock
        FROM stock_ledger_entries
        WHERE medicine_id IN (${Prisma.join(medicineIds)})
        GROUP BY medicine_id
      `,
      client.$queryRaw<Array<{
        id: string;
        medicine_id: string;
        batch_number: string;
        expiry_date: Date;
        sale_rate: Decimal | null;
        cost_rate: Decimal;
        available: Decimal | number | string;
      }>>`
        SELECT 
          b.id,
          b.medicine_id,
          b.batch_number,
          b.expiry_date,
          b.sale_rate,
          b.cost_rate,
          COALESCE(SUM(sle.quantity_delta), 0) AS available
        FROM medicine_batches b
        LEFT JOIN stock_ledger_entries sle ON sle.batch_id = b.id
        WHERE b.medicine_id IN (${Prisma.join(medicineIds)}) AND b.expiry_date > ${now}
        GROUP BY b.id, b.medicine_id, b.batch_number, b.expiry_date, b.sale_rate, b.cost_rate
        HAVING COALESCE(SUM(sle.quantity_delta), 0) > 0
        ORDER BY b.expiry_date ASC, b.created_at ASC
      `,
    ]);

    const stockMap = new Map<string, Decimal>();
    stockAgg.forEach((r) => stockMap.set(r.medicine_id, new Decimal(r.stock.toString())));

    const batchesMap = new Map<string, any[]>();
    activeBatchesAgg.forEach((b) => {
      const list = batchesMap.get(b.medicine_id) || [];
      list.push({
        id: b.id,
        batchNumber: b.batch_number,
        expiryDate: b.expiry_date,
        saleRate: b.sale_rate,
        costRate: b.cost_rate,
        available: new Decimal(b.available.toString()),
      });
      batchesMap.set(b.medicine_id, list);
    });

    return medicines.map((m) => {
      const stock = stockMap.get(m.id) || new Decimal(0);
      const isLow = stock.lessThanOrEqualTo(m.reorderLevel);
      const isOut = stock.lessThanOrEqualTo(0);
      const rawBatches = batchesMap.get(m.id) || [];
      const activeBatches = rawBatches.map((b) => ({
        ...b,
        saleRate: b.saleRate ?? m.saleRate,
      }));

      return {
        medicineId: m.id,
        currentStock: stock,
        isLowStock: isLow && !isOut,
        isOutOfStock: isOut,
        activeBatches,
      };
    });
  },

  // ── Batches ──────────────────────────────────────────────────────────────
  async createBatch(medicineId: string, body: CreateBatchBody, actorId: string) {
    const medicine = await prisma.medicineMaster.findUnique({ where: { id: medicineId } });
    if (!medicine) throw new NotFoundError('Medicine not found');
    return prisma.medicineBatch.create({ data: { medicineId, ...body, createdById: actorId } });
  },

  async getMedicineBatches(medicineId: string) {
    const batches = await prisma.medicineBatch.findMany({ where: { medicineId }, include: { stockEntries: { select: { quantityDelta: true } }, purchaseUnit: true }, orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }] });
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
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pharmacy-stock'))`;
      if (medicine.batchManaged && !body.batchId) throw new ValidationError('Select a batch for this stock adjustment');
      if (body.batchId && !await tx.medicineBatch.findFirst({ where: { id: body.batchId, medicineId: body.medicineId } })) {
        throw new ValidationError('Batch does not belong to this medicine');
      }
      const balance = await tx.stockLedgerEntry.aggregate({ where: { medicineId: body.medicineId, batchId: body.batchId ?? null }, _sum: { quantityDelta: true } });
      if (new Decimal(balance._sum.quantityDelta ?? 0).plus(delta).lessThan(0)) throw new ValidationError('Adjustment would create negative stock');
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
      await syncEffectiveSaleRate(body.medicineId, tx);
      return adjustment;
    });
  },

  // ── POS Retail Dispensing (pharmacy.md §6 — real tax/discount/split payment/outstanding, §19.2 fix) ──
  async dispenseRetail(body: DispenseRetailBody, actorId: string, transaction?: Prisma.TransactionClient) {
    const execute = async (tx: Prisma.TransactionClient) => {
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
        const overrideSaleRate = packagingLevel.overrideSaleRate ? packagingLevel.overrideSaleRate.div(conversionToBase) : null;
        const lineDiscount = new Decimal(reqLine.discountAmount || 0);
        const allocations = await allocateFefoBatches(medicine.id, reqQty, tx, stockDeductions);
        const lineGrossTotal = allocations.reduce((sum, a) => sum.plus(a.quantity.mul(overrideSaleRate ?? a.saleRate)), new Decimal(0));
        if (lineDiscount.greaterThan(lineGrossTotal)) throw new ValidationError('Line discount exceeds medicine value');

        for (let i = 0; i < allocations.length; i++) {
          const alloc = allocations[i]!;
          const allocSaleRate = overrideSaleRate ?? alloc.saleRate;
          const allocGross = alloc.quantity.mul(allocSaleRate);
          const allocDiscount = lineDiscount.mul(alloc.quantity).div(reqQty);
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
            rateSnapshot: allocSaleRate,
            costRateSnapshot: alloc.costRate,
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
          payments: body.payments.length ? { create: body.payments.map((p) => ({ amount: new Decimal(p.amount), method: p.method, reference: p.reference, paymentAccountId: p.paymentAccountId, isInitial: true, collectedById: actorId })) } : undefined,
        },
        include: {
          lines: { include: { medicine: true, batch: true, saleUnit: true } },
          payments: { include: { collectedByUser: { select: { id: true, fullName: true, username: true } } } },
          dispensedByUser: { select: { id: true, fullName: true, username: true } },
          medicineRequests: { include: { lines: true } },
        },
      });

      for (const d of stockDeductions) {
        await tx.stockLedgerEntry.create({
          data: { medicineId: d.medicineId, batchId: d.batchId, movementType: 'POS_SALE_OUT', quantityDelta: d.quantity.negated(), referenceTable: 'pharmacy_invoices', referenceId: invoice.id, actorId },
        });
      }
      const uniqueMedIds = Array.from(new Set(stockDeductions.map((d) => d.medicineId)));
      for (const medId of uniqueMedIds) {
        await syncEffectiveSaleRate(medId, tx);
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

      const updatedStock = await pharmacyService.getMedicinesStock(uniqueMedIds, tx);

      return {
        ...invoice,
        updatedStock,
      };
    };
    return transaction ? execute(transaction) : prisma.$transaction(execute);
  },

  async addPayment(invoiceId: string, body: AddPaymentBody, actorId: string, transaction?: Prisma.TransactionClient) {
    const execute = async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invoiceId}))`;
      const invoice = await tx.pharmacyInvoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundError('Invoice not found');

      const amount = new Decimal(body.amount);
      if (body.requestKey) {
        const existing = await tx.pharmacyPayment.findUnique({ where: { requestKey: body.requestKey } });
        if (existing) {
          if (!new Decimal(existing.amount).equals(amount)) {
            throw new ConflictError('A payment with this requestKey has already been recorded with a different amount');
          }
          return invoice;
        }
      }

      if (invoice.status === 'PAID') throw new ConflictError('Invoice is already fully paid');
      // HMS-linked invoices are paid by the patient at the HMS Front Desk,
      // never at this pharmacy counter — "collecting" one here would log a
      // physical-cash entry that was never actually received, while leaving
      // `hmsCollectedAmount`/`hmsReceivable` (the real cross-entity receivable)
      // untouched. That money only ever moves through the settlement
      // workflow: `createSettlementRequest` → HMS releases it → `handleSettlementRelease`.
      if (invoice.channel === 'HMS_LINKED') {
        throw new ValidationError(
          'HMS-linked invoices are collected by the patient at the HMS Front Desk, not here. Use "Request Settlement" on this invoice to collect what HMS owes Pharmacy.',
        );
      }
      if (amount.greaterThan(invoice.outstanding)) throw new ValidationError(`Payment exceeds outstanding balance of ${invoice.outstanding}`);
      if (body.method !== 'CASH' && !body.paymentAccountId) throw new ValidationError('Payment account is required for non-cash payments');

      await tx.pharmacyPayment.create({
        data: {
          invoiceId,
          amount,
          method: body.method,
          reference: body.reference,
          paymentAccountId: body.paymentAccountId,
          isInitial: false,
          requestKey: body.requestKey,
          collectedById: actorId,
        },
      });
      const newPaid = invoice.paidTotal.plus(amount);
      const newOutstanding = invoice.outstanding.minus(amount);
      const newStatus = newOutstanding.lessThanOrEqualTo(0) ? 'PAID' : 'PARTIALLY_PAID';

      const updated = await tx.pharmacyInvoice.update({
        where: { id: invoiceId },
        data: { paidTotal: newPaid, outstanding: newOutstanding, status: newStatus },
        include: { lines: true, payments: true },
      });

      await tx.cashLedgerEntry.create({
        data: {
          portalUserId: actorId,
          direction: 'IN',
          amount,
          category: 'POS_COLLECTION',
          isPhysicalCash: body.method === 'CASH',
          paymentAccountId: body.paymentAccountId,
          referenceTable: 'pharmacy_invoices',
          referenceId: invoiceId,
        },
      });

      return updated;
    };
    return transaction ? execute(transaction) : prisma.$transaction(execute);
  },

  async listInvoiceTransactionsSql(
    query: ListInvoicesQuery,
    client: Prisma.TransactionClient | typeof prisma,
    sellerId?: string
  ) {
    const channelFilter = query.channel && query.channel !== 'ALL' ? query.channel : undefined;
    const statusFilter = query.status && query.status !== 'ALL' ? query.status : undefined;
    const searchTerm = query.search?.trim();
    const fromDate = query.fromDate?.trim();
    const toDate = query.toDate?.trim();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = [20, 25, 50, 100].includes(Number(query.limit)) ? Number(query.limit) : 25;
    const offset = (page - 1) * limit;
    const sortBy = query.sortBy || 'date';
    const sortOrder = query.sortOrder || 'desc';

    let startUtc: Date | undefined;
    let endUtc: Date | undefined;
    if (fromDate) {
      startUtc = new Date(`${fromDate}T00:00:00+05:00`);
    }
    if (toDate) {
      endUtc = new Date(`${toDate}T23:59:59.999+05:00`);
    }

    const conditions: Prisma.Sql[] = [];
    if (channelFilter) {
      conditions.push(Prisma.sql`channel = ${channelFilter}`);
    }
    if (statusFilter) {
      conditions.push(Prisma.sql`status = ${statusFilter}`);
    }
    if (startUtc) {
      conditions.push(Prisma.sql`transaction_at >= ${startUtc}`);
    }
    if (endUtc) {
      conditions.push(Prisma.sql`transaction_at <= ${endUtc}`);
    }
    if (sellerId) {
      conditions.push(Prisma.sql`(
        (transaction_type = 'Original Sale' AND (dispensed_by_id = ${sellerId} OR collected_by_id = ${sellerId}))
        OR (transaction_type != 'Original Sale' AND collected_by_id = ${sellerId})
      )`);
    }
    if (searchTerm) {
      const q = `%${searchTerm}%`;
      conditions.push(Prisma.sql`(
        invoice_number ILIKE ${q} OR
        customer_name ILIKE ${q} OR
        receipt_number ILIKE ${q} OR
        transaction_type ILIKE ${q} OR
        collected_by_name ILIKE ${q} OR
        dispensed_by_full_name ILIKE ${q} OR
        dispensed_by_username ILIKE ${q} OR
        payment_method ILIKE ${q} OR
        external_admission_ref ILIKE ${q}
      )`);
    }

    const whereClause = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const sortColumnMap: Record<string, string> = {
      date: 'transaction_at',
      invoiceNumber: 'invoice_number',
      billing: 'billing_amount',
      collected: 'collected_amount',
      outstanding: 'outstanding',
    };
    const col = sortColumnMap[sortBy] || 'transaction_at';
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const orderClause = Prisma.raw(`ORDER BY ${col} ${dir}, id ASC`);

    const ctes = Prisma.sql`
      WITH ranked_payments AS (
        SELECT
          p.id, p.invoice_id, p.amount, p.method, p.paid_at, p.payment_account_id, p.collected_by, p.is_initial,
          ROW_NUMBER() OVER (PARTITION BY p.invoice_id ORDER BY p.paid_at ASC, p.id ASC) as pay_rank
        FROM pharmacy_payments p
        WHERE p.amount > 0
      ),
      classified_payments AS (
        SELECT
          p.id, p.invoice_id, p.amount, p.method, p.paid_at, p.payment_account_id, p.collected_by,
          CASE
            WHEN p.is_initial = true THEN true
            WHEN p.is_initial = false THEN false
            WHEN p.paid_at = i.created_at THEN true
            WHEN (p.paid_at + INTERVAL '5 hours')::date = (i.created_at + INTERVAL '5 hours')::date AND rp.pay_rank = 1 THEN true
            ELSE false
          END as is_initial_effective
        FROM pharmacy_payments p
        JOIN pharmacy_invoices i ON i.id = p.invoice_id
        LEFT JOIN ranked_payments rp ON rp.id = p.id
      ),
      first_hms_events AS (
        SELECT DISTINCT ON (e.invoice_id)
          e.id, e.invoice_id, e.collection_delta, e.occurred_at, e.reference, e.method, e.actor_id
        FROM pharmacy_financial_events e
        JOIN pharmacy_invoices i ON i.id = e.invoice_id
        WHERE e.kind LIKE 'HMS_%' AND e.occurred_at IS NOT NULL AND e.collection_delta > 0
          AND (e.occurred_at + INTERVAL '5 hours')::date = (i.created_at + INTERVAL '5 hours')::date
        ORDER BY e.invoice_id, e.occurred_at ASC, e.id ASC
      ),
      invoice_returns AS (
        SELECT invoice_id, COALESCE(SUM(sale_delta), 0) as total_return_sale
        FROM pharmacy_financial_events WHERE kind = 'RETURN' GROUP BY invoice_id
      ),
      invoice_legacy_refunds AS (
        SELECT r.reference_id as invoice_id, COALESCE(SUM(r.amount), 0) as total_refund_amount
        FROM cash_ledger_entries r
        WHERE r.category = 'REFUND' AND r.reference_table = 'pharmacy_invoices'
          AND NOT EXISTS (SELECT 1 FROM pharmacy_financial_events e WHERE e.reference = r.id)
        GROUP BY r.reference_id
      ),
      initial_payments_agg AS (
        SELECT
          cp.invoice_id,
          COALESCE(SUM(cp.amount), 0) as initial_collected,
          STRING_AGG('PAY-' || UPPER(SUBSTRING(cp.id, 1, 8)), ', ' ORDER BY cp.paid_at ASC, cp.id ASC) as initial_receipts,
          STRING_AGG(cp.method::text, ', ' ORDER BY cp.paid_at ASC, cp.id ASC) as initial_methods,
          STRING_AGG(COALESCE(pa.name, ''), ', ' ORDER BY cp.paid_at ASC, cp.id ASC) as initial_accounts,
          STRING_AGG(COALESCE(pu.full_name, ''), ', ' ORDER BY cp.paid_at ASC, cp.id ASC) as initial_collectors
        FROM classified_payments cp
        LEFT JOIN payment_accounts pa ON pa.id = cp.payment_account_id
        LEFT JOIN portal_users pu ON pu.id = cp.collected_by
        WHERE cp.is_initial_effective = true
        GROUP BY cp.invoice_id
      ),
      all_transactions AS (
        -- 1. Original Sale
        SELECT
          'invoice:' || i.id as id, i.id as invoice_id, 'invoice:' || i.id as transaction_id,
          'Original Sale' as transaction_type, i.created_at as transaction_at, i.created_at as invoice_created_at,
          i.invoice_number, i.channel::text as channel, i.customer_name, i.external_admission_ref, i.status::text as status,
          i.outstanding::numeric as outstanding, i.total::numeric as invoice_total, i.paid_total::numeric as invoice_paid_total,
          i.subtotal::numeric as invoice_subtotal, i.discount_total::numeric as invoice_discount_total, i.tax_total::numeric as invoice_tax_total,
          (i.total - COALESCE(ret.total_return_sale, 0) + COALESCE(ref.total_refund_amount, 0))::numeric as billing_amount,
          (COALESCE(ipa.initial_collected, 0) + COALESCE(fhe.collection_delta, 0))::numeric as collected_amount,
          NULLIF(TRIM(CONCAT_WS(', ', ipa.initial_receipts, fhe.reference)), '') as receipt_number,
          NULLIF(TRIM(CONCAT_WS(', ', ipa.initial_methods, fhe.method)), '') as payment_method,
          NULLIF(TRIM(ipa.initial_accounts), '') as payment_account_name,
          COALESCE(NULLIF(TRIM(CONCAT_WS(', ', ipa.initial_collectors, CASE WHEN fhe.id IS NOT NULL THEN COALESCE(fhe.actor_id, 'HMS Front Desk') END)), ''), u.full_name, 'Staff') as collected_by_name,
          u.id as dispensed_by_id, u.full_name as dispensed_by_full_name, u.username as dispensed_by_username,
          u.id as collected_by_id
        FROM pharmacy_invoices i
        JOIN portal_users u ON u.id = i.dispensed_by
        LEFT JOIN initial_payments_agg ipa ON ipa.invoice_id = i.id
        LEFT JOIN first_hms_events fhe ON fhe.invoice_id = i.id
        LEFT JOIN invoice_returns ret ON ret.invoice_id = i.id
        LEFT JOIN invoice_legacy_refunds ref ON ref.invoice_id = i.id

        UNION ALL

        -- 2. Remaining Collections
        SELECT
          'payment:' || cp.id as id, i.id as invoice_id, 'payment:' || cp.id as transaction_id,
          CASE WHEN cp.amount < 0 THEN 'Collection Reversal' ELSE 'Remaining Collection' END as transaction_type,
          cp.paid_at as transaction_at, i.created_at as invoice_created_at,
          i.invoice_number, i.channel::text as channel, i.customer_name, i.external_admission_ref, i.status::text as status,
          i.outstanding::numeric as outstanding, i.total::numeric as invoice_total, i.paid_total::numeric as invoice_paid_total,
          i.subtotal::numeric as invoice_subtotal, i.discount_total::numeric as invoice_discount_total, i.tax_total::numeric as invoice_tax_total,
          0::numeric as billing_amount, cp.amount::numeric as collected_amount,
          'PAY-' || UPPER(SUBSTRING(cp.id, 1, 8)) as receipt_number, cp.method::text as payment_method,
          COALESCE(pa.name, '') as payment_account_name, COALESCE(pu.full_name, 'Staff') as collected_by_name,
          u.id as dispensed_by_id, u.full_name as dispensed_by_full_name, u.username as dispensed_by_username,
          cp.collected_by as collected_by_id
        FROM classified_payments cp
        JOIN pharmacy_invoices i ON i.id = cp.invoice_id
        JOIN portal_users u ON u.id = i.dispensed_by
        LEFT JOIN payment_accounts pa ON pa.id = cp.payment_account_id
        LEFT JOIN portal_users pu ON pu.id = cp.collected_by
        WHERE cp.is_initial_effective = false

        UNION ALL

        -- 3. Financial Events
        SELECT
          'event:' || e.id as id, i.id as invoice_id, 'event:' || e.id as transaction_id,
          CASE WHEN e.kind = 'RETURN' THEN 'Return / Refund' WHEN e.collection_delta < 0 THEN 'Collection Reversal' ELSE 'Remaining Collection' END as transaction_type,
          e.occurred_at as transaction_at, i.created_at as invoice_created_at,
          i.invoice_number, i.channel::text as channel, i.customer_name, i.external_admission_ref, i.status::text as status,
          i.outstanding::numeric as outstanding, i.total::numeric as invoice_total, i.paid_total::numeric as invoice_paid_total,
          i.subtotal::numeric as invoice_subtotal, i.discount_total::numeric as invoice_discount_total, i.tax_total::numeric as invoice_tax_total,
          e.sale_delta::numeric as billing_amount, e.collection_delta::numeric as collected_amount,
          COALESCE(cle.reference_no, e.reference, 'EVT-' || UPPER(SUBSTRING(e.id, 1, 8))) as receipt_number,
          COALESCE(e.method, '') as payment_method, COALESCE(pa.name, '') as payment_account_name,
          COALESCE(cle_u.full_name, e.actor_id, 'HMS Front Desk') as collected_by_name,
          u.id as dispensed_by_id, u.full_name as dispensed_by_full_name, u.username as dispensed_by_username,
          COALESCE(cle.portal_user_id, e.actor_id) as collected_by_id
        FROM pharmacy_financial_events e
        JOIN pharmacy_invoices i ON i.id = e.invoice_id
        JOIN portal_users u ON u.id = i.dispensed_by
        LEFT JOIN first_hms_events fhe ON fhe.id = e.id
        LEFT JOIN cash_ledger_entries cle ON cle.id = e.reference
        LEFT JOIN payment_accounts pa ON pa.id = cle.payment_account_id
        LEFT JOIN portal_users cle_u ON cle_u.id = cle.portal_user_id
        WHERE fhe.id IS NULL

        UNION ALL

        -- 4. Legacy Refunds
        SELECT
          'refund:' || r.id as id, i.id as invoice_id, 'refund:' || r.id as transaction_id,
          'Legacy Return / Refund' as transaction_type, r.occurred_at as transaction_at, i.created_at as invoice_created_at,
          i.invoice_number, i.channel::text as channel, i.customer_name, i.external_admission_ref, i.status::text as status,
          i.outstanding::numeric as outstanding, i.total::numeric as invoice_total, i.paid_total::numeric as invoice_paid_total,
          i.subtotal::numeric as invoice_subtotal, i.discount_total::numeric as invoice_discount_total, i.tax_total::numeric as invoice_tax_total,
          (-r.amount)::numeric as billing_amount, (-r.amount)::numeric as collected_amount,
          COALESCE(r.reference_no, 'REF-' || UPPER(SUBSTRING(r.id, 1, 8))) as receipt_number,
          COALESCE(r.payment_method::text, CASE WHEN r.is_physical_cash THEN 'CASH' ELSE 'UNKNOWN' END) as payment_method,
          COALESCE(pa.name, '') as payment_account_name, COALESCE(pu.full_name, 'Staff') as collected_by_name,
          u.id as dispensed_by_id, u.full_name as dispensed_by_full_name, u.username as dispensed_by_username,
          r.portal_user_id as collected_by_id
        FROM cash_ledger_entries r
        JOIN pharmacy_invoices i ON i.id = r.reference_id
        JOIN portal_users u ON u.id = i.dispensed_by
        LEFT JOIN payment_accounts pa ON pa.id = r.payment_account_id
        LEFT JOIN portal_users pu ON pu.id = r.portal_user_id
        WHERE r.category = 'REFUND' AND r.reference_table = 'pharmacy_invoices'
          AND NOT EXISTS (SELECT 1 FROM pharmacy_financial_events e WHERE e.reference = r.id)
      )
    `;

    const pagedQuery = Prisma.sql`
      ${ctes}
      SELECT * FROM all_transactions
      ${whereClause}
      ${orderClause}
      LIMIT ${limit} OFFSET ${offset};
    `;

    const summaryQuery = Prisma.sql`
      ${ctes},
      filtered_tx AS (
        SELECT * FROM all_transactions
        ${whereClause}
      ),
      summary_m AS (
        SELECT
          COALESCE(SUM(billing_amount), 0)::numeric as total_billing,
          COALESCE(SUM(collected_amount), 0)::numeric as total_collected,
          COUNT(*)::int as total_count,
          COUNT(DISTINCT invoice_id)::int as total_invoices
        FROM filtered_tx
      ),
      distinct_inv AS (
        SELECT DISTINCT ON (invoice_id) outstanding FROM filtered_tx
      ),
      out_m AS (
        SELECT COALESCE(SUM(outstanding), 0)::numeric as total_outstanding FROM distinct_inv
      )
      SELECT s.*, o.total_outstanding FROM summary_m s, out_m o;
    `;

    const [itemsRaw, summaryRaw] = await Promise.all([
      client.$queryRaw<any[]>(pagedQuery),
      client.$queryRaw<any[]>(summaryQuery),
    ]);

    const summary = summaryRaw[0] || {
      total_billing: 0,
      total_collected: 0,
      total_outstanding: 0,
      total_invoices: 0,
      total_count: 0,
    };

    const items = itemsRaw.map((row) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      transactionId: row.transaction_id,
      transactionType: row.transaction_type,
      transactionAt: row.transaction_at,
      billingAmount: Number(row.billing_amount),
      collectedAmount: Number(row.collected_amount),
      receiptNumber: row.receipt_number || '',
      paymentMethod: row.payment_method || '',
      paymentAccountName: row.payment_account_name || '',
      collectedByName: row.collected_by_name || 'Staff',
      outstanding: Number(row.outstanding),
      status: row.status,
      channel: row.channel,
      customerName: row.customer_name,
      invoiceNumber: row.invoice_number,
      total: Number(row.invoice_total),
      paidTotal: Number(row.invoice_paid_total),
      subtotal: Number(row.invoice_subtotal),
      discountTotal: Number(row.invoice_discount_total),
      taxTotal: Number(row.invoice_tax_total),
      createdAt: row.invoice_created_at,
      externalAdmissionRef: row.external_admission_ref,
      dispensedById: row.dispensed_by_id,
      dispensedByUser: {
        id: row.dispensed_by_id,
        fullName: row.dispensed_by_full_name,
        username: row.dispensed_by_username,
      },
    }));

    const total = Number(summary.total_count);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items,
      page,
      limit,
      total,
      totalPages,
      summary: {
        totalBilling: Number(summary.total_billing),
        totalCollected: Number(summary.total_collected),
        totalOutstanding: Number(summary.total_outstanding),
        totalInvoices: Number(summary.total_invoices),
      },
    };
  },

  async listInvoices(query: ListInvoicesQuery, tx?: Prisma.TransactionClient, sellerId?: string) {
    const client = tx || prisma;
    const isPaginated = query.page != null || query.limit != null;

    // Database-level SQL transaction projection & pagination for paginated requests
    if (isPaginated && query.transactions === 'true') {
      return pharmacyService.listInvoiceTransactionsSql(query, client, sellerId);
    }

    const channelFilter = query.channel && query.channel !== 'ALL' ? query.channel : undefined;
    const statusFilter = query.status && query.status !== 'ALL' ? query.status : undefined;
    const searchTerm = query.search?.trim();
    const fromDate = query.fromDate?.trim();
    const toDate = query.toDate?.trim();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = [20, 25, 50, 100].includes(Number(query.limit)) ? Number(query.limit) : 25;
    const sortBy = query.sortBy || 'date';
    const sortOrder = query.sortOrder || 'desc';

    // Parse PKT date range (UTC+5) to UTC timestamps
    let startUtc: Date | undefined;
    let endUtc: Date | undefined;
    if (fromDate) {
      startUtc = new Date(`${fromDate}T00:00:00+05:00`);
    }
    if (toDate) {
      endUtc = new Date(`${toDate}T23:59:59.999+05:00`);
    }

    // Build Prisma query condition
    const searchWhere: Prisma.PharmacyInvoiceWhereInput | undefined = searchTerm
      ? {
          OR: [
            { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
            { customerName: { contains: searchTerm, mode: 'insensitive' } },
            { externalAdmissionRef: { contains: searchTerm, mode: 'insensitive' } },
            { payments: { some: { collectedByUser: { fullName: { contains: searchTerm, mode: 'insensitive' } } } } },
            { dispensedByUser: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
          ],
        }
      : undefined;

    const dateConditions: Prisma.PharmacyInvoiceWhereInput[] = [];
    if (startUtc && endUtc) {
      dateConditions.push(
        { createdAt: { gte: startUtc, lte: endUtc } },
        { payments: { some: { paidAt: { gte: startUtc, lte: endUtc } } } },
        { financialEvents: { some: { occurredAt: { gte: startUtc, lte: endUtc } } } }
      );
    } else if (startUtc) {
      dateConditions.push(
        { createdAt: { gte: startUtc } },
        { payments: { some: { paidAt: { gte: startUtc } } } },
        { financialEvents: { some: { occurredAt: { gte: startUtc } } } }
      );
    } else if (endUtc) {
      dateConditions.push(
        { createdAt: { lte: endUtc } },
        { payments: { some: { paidAt: { lte: endUtc } } } },
        { financialEvents: { some: { occurredAt: { lte: endUtc } } } }
      );
    }

    const andClauses: Prisma.PharmacyInvoiceWhereInput[] = [];
    if (channelFilter) andClauses.push({ channel: channelFilter });
    if (statusFilter) andClauses.push({ status: statusFilter });
    if (searchWhere) andClauses.push(searchWhere);
    if (dateConditions.length > 0) andClauses.push({ OR: dateConditions });
    if (sellerId) {
      andClauses.push({
        OR: [
          { dispensedById: sellerId },
          { payments: { some: { collectedById: sellerId } } },
          { financialEvents: { some: { actorId: sellerId } } },
        ],
      });
    }

    const where: Prisma.PharmacyInvoiceWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};

    // Load candidate invoices with payments, dispensedByUser, and financialEvents.
    // Lines and medicineRequests are omitted for high performance (they are loaded on demand via getInvoiceById).
    const invoices = await client.pharmacyInvoice.findMany({
      where,
      include: {
        payments: {
          include: {
            collectedByUser: { select: { id: true, fullName: true, username: true } },
            paymentAccount: { select: { id: true, name: true } },
          },
        },
        dispensedByUser: { select: { id: true, fullName: true, username: true } },
        financialEvents: true,
      },
      orderBy: { createdAt: 'desc' },
      ...(isPaginated ? {} : { take: 200 }),
    });

    if (query.transactions !== 'true' && !isPaginated) {
      return invoices;
    }

    const invoiceIds = invoices.map((i) => i.id);
    const refunds =
      invoiceIds.length > 0
        ? await client.cashLedgerEntry.findMany({
            where: {
              category: 'REFUND',
              referenceTable: 'pharmacy_invoices',
              referenceId: { in: invoiceIds },
            },
            include: {
              portalUser: { select: { fullName: true } },
              paymentAccount: { select: { name: true } },
            },
          })
        : [];

    // Project transactions (original sales + subsequent collections/events/refunds)
    let rows = invoiceTransactions(invoices as any, refunds as any);

    // Apply strict date window filtering on transaction rows
    if (startUtc || endUtc) {
      rows = rows.filter((r) => {
        const tAt = r.transactionAt || r.createdAt;
        if (!tAt) return false;
        const d = new Date(tAt);
        if (startUtc && d < startUtc) return false;
        if (endUtc && d > endUtc) return false;
        return true;
      });
    }

    // Apply text search on expanded transaction attributes
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((r) => {
        return (
          (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(q)) ||
          (r.customerName && r.customerName.toLowerCase().includes(q)) ||
          (r.receiptNumber && r.receiptNumber.toLowerCase().includes(q)) ||
          (r.transactionType && r.transactionType.toLowerCase().includes(q)) ||
          (r.collectedByName && r.collectedByName.toLowerCase().includes(q)) ||
          (r.dispensedByUser?.fullName && r.dispensedByUser.fullName.toLowerCase().includes(q)) ||
          (r.dispensedByUser?.username && r.dispensedByUser.username.toLowerCase().includes(q)) ||
          (r.paymentMethod && r.paymentMethod.toLowerCase().includes(q))
        );
      });
    }

    // Calculate aggregated KPIs across the entire filtered dataset
    const summary = summarizeInvoiceTransactions(rows);

    // Sort visible transaction rows
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') {
        const timeA = (a.transactionAt ? new Date(a.transactionAt).getTime() : new Date(a.createdAt).getTime()) || 0;
        const timeB = (b.transactionAt ? new Date(b.transactionAt).getTime() : new Date(b.createdAt).getTime()) || 0;
        cmp = timeA - timeB;
      } else if (sortBy === 'invoiceNumber') {
        cmp = (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '');
      } else if (sortBy === 'billing') {
        const valA = Number(a.billingAmount ?? a.total ?? 0);
        const valB = Number(b.billingAmount ?? b.total ?? 0);
        cmp = valA - valB;
      } else if (sortBy === 'collected') {
        const valA = Number(a.collectedAmount ?? a.paidTotal ?? 0);
        const valB = Number(b.collectedAmount ?? b.paidTotal ?? 0);
        cmp = valA - valB;
      } else if (sortBy === 'outstanding') {
        const valA = Number(a.outstanding ?? 0);
        const valB = Number(b.outstanding ?? 0);
        cmp = valA - valB;
      }
      if (cmp === 0) {
        cmp = a.id.localeCompare(b.id);
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    if (!isPaginated) {
      return rows;
    }

    // Paginate visible transaction rows
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const validPage = Math.min(page, totalPages);
    const start = (validPage - 1) * limit;
    const items = rows.slice(start, start + limit);

    return {
      items,
      page: validPage,
      limit,
      total,
      totalPages,
      summary: {
        totalBilling: summary.billing,
        totalCollected: summary.collected,
        totalOutstanding: summary.outstanding,
        totalInvoices: summary.invoices,
      },
    };
  },

  // ── Sales Return (pharmacy.md §9.1 SALES_RETURN_IN) ─────────────────────
  async salesReturn(body: SalesReturnBody, actorId: string, transaction?: Prisma.TransactionClient) {
    const execute = async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${body.invoiceId}))`;
      const invoice = await tx.pharmacyInvoice.findUnique({ where: { id: body.invoiceId }, include: { lines: { include: { batch: true } } } });
      if (!invoice) throw new NotFoundError('Invoice not found');
      if (invoice.channel === 'HMS_LINKED') throw new ValidationError('HMS-linked returns require the HMS billing/refund workflow; no pharmacy drawer refund is permitted.');
      if (new Set(body.lines.map(l => l.invoiceLineId)).size !== body.lines.length) throw new ValidationError('Duplicate return line');
      if (body.requestKey) {
        const previous = await tx.pharmacyFinancialEvent.findUnique({ where: { eventKey: 'return:' + body.requestKey } });
        if (previous) throw new ConflictError('This return request has already been posted');
      }
      let returnedCost = new Decimal(0);
      let refundTotal = new Decimal(0);
      let grossRefundTotal = new Decimal(0);
      let taxRefundTotal = new Decimal(0);
      let discountRefundTotal = new Decimal(0);

      for (const returnLine of body.lines) {
        const line = invoice.lines.find((l) => l.id === returnLine.invoiceLineId);
        if (!line) throw new NotFoundError(`Invoice line ${returnLine.invoiceLineId} not found on invoice ${invoice.invoiceNumber}`);
        const qty = new Decimal(returnLine.quantity);
        const previouslyReturned = line.returnedQuantity || new Decimal(0);
        const remainingReturnable = line.quantity.minus(previouslyReturned);

        if (qty.greaterThan(remainingReturnable)) {
          throw new ValidationError(
            `Return quantity (${qty}) exceeds remaining returnable quantity (${remainingReturnable}) for this line`
          );
        }

        const proportion = qty.div(line.quantity);
        const lineGrossRefund = line.rateSnapshot.mul(qty);
        const lineTaxRefund = line.taxAmount.mul(proportion);
        const lineDiscountRefund = line.discountAmount.mul(proportion);
        const originalTotal = invoice.total.plus(invoice.lines.reduce((sum, l) => sum.plus(l.returnedValue), new Decimal(0)));
        const originalLinesNet = invoice.lines.reduce((sum, l) => sum.plus(l.lineNet), new Decimal(0));
        const invoiceDiscountShare = originalLinesNet.gt(0) ? Decimal.max(0, originalLinesNet.minus(originalTotal)).mul(line.lineNet).div(originalLinesNet).mul(proportion) : new Decimal(0);
        const refundAmount = line.lineNet.mul(proportion).minus(invoiceDiscountShare).toDecimalPlaces(2);
        if (returnLine.restock) returnedCost = returnedCost.plus(qty.mul(line.costRateSnapshot ?? line.batch?.costRate ?? 0));

        grossRefundTotal = grossRefundTotal.plus(lineGrossRefund);
        taxRefundTotal = taxRefundTotal.plus(lineTaxRefund);
        discountRefundTotal = discountRefundTotal.plus(lineDiscountRefund).plus(invoiceDiscountShare);
        refundTotal = refundTotal.plus(refundAmount);

        // Update returned metrics on line
        await tx.pharmacyInvoiceLine.update({
          where: { id: line.id },
          data: {
            returnedQuantity: previouslyReturned.plus(qty),
            returnedValue: (line.returnedValue || new Decimal(0)).plus(refundAmount),
          },
        });

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
          await syncEffectiveSaleRate(line.medicineId, tx);
        }
      }

      const cashRefund = Decimal.min(refundTotal, invoice.paidTotal);
      const referenceNo = await nextCode(tx, SEQUENCE.RETURN);
      const refund = await tx.cashLedgerEntry.create({
        data: {
          portalUserId: actorId,
          direction: 'OUT',
          amount: cashRefund,
          category: 'REFUND',
          referenceNo,
          isPhysicalCash: body.refundMethod === 'CASH',
          referenceTable: 'pharmacy_invoices',
          referenceId: invoice.id,
          note: `${referenceNo}: ${body.reason}`,
        },
      });

      await tx.pharmacyFinancialEvent.create({
        data: {
          invoiceId: invoice.id, eventKey: body.requestKey ? 'return:' + body.requestKey : referenceNo, kind: 'RETURN', occurredAt: refund.occurredAt,
          collectionDelta: cashRefund.negated(), saleDelta: refundTotal.negated(), taxDelta: taxRefundTotal.negated(),
          grossDelta: grossRefundTotal.negated(), discountDelta: discountRefundTotal.negated(), costDelta: returnedCost.negated(),
          method: body.refundMethod, actorId, reference: refund.id,
        }
      });
      // Update invoice totals reflecting the reversal
      const newSubtotal = Decimal.max(0, invoice.subtotal.minus(grossRefundTotal));
      const newDiscountTotal = Decimal.max(0, invoice.discountTotal.minus(discountRefundTotal));
      const newTaxTotal = Decimal.max(0, invoice.taxTotal.minus(taxRefundTotal));
      const newTotal = Decimal.max(0, invoice.total.minus(refundTotal));
      const newPaidTotal = Decimal.max(0, invoice.paidTotal.minus(cashRefund));
      const newOutstanding = Decimal.max(0, newTotal.minus(newPaidTotal));
      const newStatus = newTotal.isZero()
        ? 'PAID'
        : newOutstanding.isZero()
          ? 'PAID'
          : newPaidTotal.greaterThan(0)
            ? 'PARTIALLY_PAID'
            : 'UNPAID';

      await tx.pharmacyInvoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: newSubtotal,
          discountTotal: newDiscountTotal,
          taxTotal: newTaxTotal,
          total: newTotal,
          paidTotal: newPaidTotal,
          outstanding: newOutstanding,
          status: newStatus,
        },
      });

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        returnReferenceNo: referenceNo,
        refundTotal: cashRefund,
        returnedSaleAmount: refundTotal,
        refundMethod: body.refundMethod,
        cashLedgerEntryId: refund.id,
        newTotal,
        newPaidTotal,
      };
    };
    return transaction ? execute(transaction) : prisma.$transaction(execute);
  },

  async getInvoiceById(id: string, tx?: Prisma.TransactionClient, user?: { role: string; sub: string }) {
    const client = tx || prisma;
    const invoice = await client.pharmacyInvoice.findUnique({
      where: { id },
      include: {
        lines: { include: { medicine: true, batch: true, saleUnit: true } },
        payments: {
          include: {
            collectedByUser: { select: { id: true, fullName: true, username: true } },
            paymentAccount: { select: { id: true, name: true } },
          },
        },
        dispensedByUser: { select: { id: true, fullName: true, username: true } },
        medicineRequests: { include: { lines: true } },
        financialEvents: true,
      },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');

    if (user && user.role === 'SALES_DISPENSING') {
      const isAuthorized =
        invoice.dispensedById === user.sub ||
        invoice.payments.some((p) => p.collectedById === user.sub) ||
        invoice.financialEvents.some((e) => e.actorId === user.sub) ||
        (invoice.status !== 'PAID' && Number(invoice.outstanding) > 0);
      if (!isAuthorized) {
        throw new AuthorizationError('Access denied: You are not authorized to view this invoice');
      }
    }

    return invoice;
  },

  async bulkImportMedicines(body: BulkImportBody, actorId: string) {
    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ row: number; medicine: string; error: string }> = [];
    const successfulItems: Array<{ id: string; code: string; name: string; isNew: boolean }> = [];

    // Helper: case-insensitive get or create unit
    const resolveUnit = async (tx: Prisma.TransactionClient, rawName: string) => {
      const name = rawName.trim();
      const existing = await tx.unit.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
      if (existing) return existing;
      return tx.unit.create({
        data: {
          name,
          isSystem: false,
          createdById: actorId,
        },
      });
    };

    // Helper: case-insensitive get or create category
    const resolveCategory = async (tx: Prisma.TransactionClient, rawCategory?: string | null) => {
      if (!rawCategory || !rawCategory.trim()) return { id: null, name: null };
      const name = rawCategory.trim();
      const existing = await tx.medicineCategory.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
      if (existing) return { id: existing.id, name: existing.name };
      const created = await tx.medicineCategory.create({
        data: {
          name,
          createdById: actorId,
        },
      });
      return { id: created.id, name: created.name };
    };

    for (let index = 0; index < body.items.length; index++) {
      const row = body.items[index]!;
      const rowNum = index + 1;

      try {
        await prisma.$transaction(async (tx) => {
          const medName = row.name.trim();
          const rawBarcode = row.barcode?.trim() || null;
          const rawStrength = row.strength?.trim() || null;
          const rawGeneric = row.genericName?.trim() || null;
          const rawDosage = row.dosageForm?.trim() || null;

          // Check if barcode already belongs to a DIFFERENT medicine
          if (rawBarcode) {
            const conflict = await tx.medicineMaster.findFirst({
              where: {
                barcode: rawBarcode,
                NOT: {
                  AND: [
                    { name: { equals: medName, mode: 'insensitive' } },
                    rawStrength ? { strength: { equals: rawStrength, mode: 'insensitive' } } : {},
                  ],
                },
              },
            });
            if (conflict) {
              throw new ValidationError(`Barcode "${rawBarcode}" already belongs to medicine "${conflict.name}" (${conflict.code})`);
            }
          }

          // Check for existing medicine by barcode OR (name + strength)
          let existingMed = null;
          if (rawBarcode) {
            existingMed = await tx.medicineMaster.findFirst({
              where: { barcode: rawBarcode },
            });
          }
          if (!existingMed) {
            existingMed = await tx.medicineMaster.findFirst({
              where: {
                name: { equals: medName, mode: 'insensitive' },
                ...(rawStrength ? { strength: { equals: rawStrength, mode: 'insensitive' } } : { strength: null }),
              },
            });
          }

          const categoryData = await resolveCategory(tx, row.category);
          const baseUnit = await resolveUnit(tx, row.baseUnit);

          // Option 1 Packaging & Pack-Rate Derivation:
          // Users enter rates (TP / MRP) and opening quantity in terms of the Default Purchase Unit (e.g. Box).
          const purchaseUnitRaw = row.defaultPurchaseUnit?.trim() || row.baseUnit.trim();
          const isBasePurchaseUnit = purchaseUnitRaw.toLowerCase() === row.baseUnit.trim().toLowerCase();

          let purchaseConversionToBase = 1;
          if (!isBasePurchaseUnit) {
            if (row.innerPackUnit && purchaseUnitRaw.toLowerCase() === row.innerPackUnit.trim().toLowerCase()) {
              purchaseConversionToBase = Number(row.baseUnitsPerInnerPack) || 1;
            } else {
              purchaseConversionToBase = Number(row.baseUnitsPerPurchaseUnit) || (Number(row.baseUnitsPerInnerPack) ? Number(row.baseUnitsPerInnerPack) * 10 : 1);
            }
          }
          if (purchaseConversionToBase <= 0) purchaseConversionToBase = 1;

          // Convert pack prices to per-base-unit rates (e.g. Rs 450 per Box / 100 = Rs 4.50 per Tablet)
          const rawSalePrice = Number(row.defaultSalePrice || 0);
          const saleRatePerBase = purchaseConversionToBase > 1 && rawSalePrice > 0
            ? rawSalePrice / purchaseConversionToBase
            : rawSalePrice;

          const rawPurchaseCost = row.purchaseCostRate !== undefined && row.purchaseCostRate !== null
            ? Number(row.purchaseCostRate)
            : null;
          const purchaseRatePerBase = rawPurchaseCost !== null && rawPurchaseCost > 0
            ? (purchaseConversionToBase > 1 ? rawPurchaseCost / purchaseConversionToBase : rawPurchaseCost)
            : null;

          // Convert opening stock from Packs/Boxes to Base Units (e.g. 5 boxes x 100 = 500 tablets)
          const rawOpeningPacks = Number(row.openingStockQty) || 0;
          const openingStockBaseUnits = rawOpeningPacks * purchaseConversionToBase;

          let medicineId: string;
          let medicineCode: string;
          let isNew = false;

          if (existingMed) {
            // Update existing medicine master
            const updated = await tx.medicineMaster.update({
              where: { id: existingMed.id },
              data: {
                genericName: rawGeneric ?? existingMed.genericName,
                dosageForm: rawDosage ?? existingMed.dosageForm,
                categoryId: categoryData.id ?? existingMed.categoryId,
                categoryLabel: categoryData.name ?? existingMed.categoryLabel,
                saleRate: row.defaultSalePrice !== undefined ? new Decimal(saleRatePerBase) : existingMed.saleRate,
                taxPercent: row.taxPercent !== undefined ? new Decimal(row.taxPercent) : existingMed.taxPercent,
                reorderLevel: row.reorderAlertQty !== undefined ? new Decimal(row.reorderAlertQty) : existingMed.reorderLevel,
                purchaseRate: purchaseRatePerBase !== null ? new Decimal(purchaseRatePerBase) : existingMed.purchaseRate,
                barcode: rawBarcode ?? existingMed.barcode,
              },
            });
            medicineId = updated.id;
            medicineCode = updated.code;
            updatedCount++;
          } else {
            // Create new medicine master
            isNew = true;
            medicineCode = await nextCode(tx, SEQUENCE.MEDICINE);

            const created = await tx.medicineMaster.create({
              data: {
                code: medicineCode,
                name: medName,
                strength: rawStrength,
                genericName: rawGeneric,
                dosageForm: rawDosage,
                categoryId: categoryData.id,
                categoryLabel: categoryData.name,
                unit: baseUnit.name,
                baseUnitId: baseUnit.id,
                batchManaged: Boolean(row.trackBatchExpiry),
                reorderLevel: new Decimal(row.reorderAlertQty || 0),
                saleRate: new Decimal(saleRatePerBase || 0),
                purchaseRate: purchaseRatePerBase !== null ? new Decimal(purchaseRatePerBase) : null,
                taxPercent: new Decimal(row.taxPercent || 0),
                barcode: rawBarcode,
                createdById: actorId,
              },
            });
            medicineId = created.id;

            // Build packaging levels
            const packagingLevels: PackagingLevelInput[] = [];

            // Level 1: Inner Pack Unit (if provided and conversion > 1)
            let innerUnit: any = null;
            if (row.innerPackUnit && row.innerPackUnit.trim()) {
              const innerConv = Number(row.baseUnitsPerInnerPack) || 0;
              if (innerConv > 1 && row.innerPackUnit.trim().toLowerCase() !== row.baseUnit.trim().toLowerCase()) {
                innerUnit = await resolveUnit(tx, row.innerPackUnit);
                const isInnerPurchase = !isBasePurchaseUnit && purchaseUnitRaw.toLowerCase() === row.innerPackUnit.trim().toLowerCase();
                packagingLevels.push({
                  unitId: innerUnit.id,
                  conversionToBase: innerConv,
                  isPurchaseUnit: isInnerPurchase,
                  isSaleUnit: true,
                });
              }
            }

            // Outer Pack Unit (if different from base and inner pack)
            if (!isBasePurchaseUnit && (!innerUnit || purchaseUnitRaw.toLowerCase() !== innerUnit.name.toLowerCase())) {
              const outerUnit = await resolveUnit(tx, purchaseUnitRaw);
              const outerConv = Number(row.baseUnitsPerPurchaseUnit) || (packagingLevels[0] ? packagingLevels[0].conversionToBase * 10 : 10);
              packagingLevels.push({
                unitId: outerUnit.id,
                conversionToBase: outerConv,
                isPurchaseUnit: true,
                isSaleUnit: true,
              });
            }

            // Ensure exactly one purchase unit is designated
            const purchaseCount = (isBasePurchaseUnit ? 1 : 0) + packagingLevels.filter((l) => l.isPurchaseUnit).length;
            const finalBasePurchase = purchaseCount === 1 ? isBasePurchaseUnit : true;
            if (purchaseCount !== 1) {
              packagingLevels.forEach((l) => {
                l.isPurchaseUnit = false;
              });
            }

            await writePackagingLevels(tx, medicineId, baseUnit.id, finalBasePurchase, true, packagingLevels);
            createdCount++;
          }

          // Handle Opening Stock (in base units derived from packs)
          if (openingStockBaseUnits > 0) {
            if (row.trackBatchExpiry) {
              const batchNumber = row.batchNumber?.trim() || `INIT-${medicineCode}`;
              let expiryDate = row.expiryDate ? new Date(row.expiryDate) : null;
              if (!expiryDate || isNaN(expiryDate.getTime())) {
                expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
              }
              const costRate = purchaseRatePerBase !== null
                ? purchaseRatePerBase
                : saleRatePerBase * 0.8;

              let batch = batchNumber
                ? await tx.medicineBatch.findFirst({
                  where: { medicineId, batchNumber },
                })
                : null;
              if (!batch) {
                batch = await tx.medicineBatch.create({
                  data: {
                    medicineId,
                    batchNumber,
                    expiryDate,
                    costRate: new Decimal(costRate),
                    saleRate: saleRatePerBase ? new Decimal(saleRatePerBase) : null,
                    createdById: actorId,
                  },
                });
              }

              await tx.stockLedgerEntry.create({
                data: {
                  medicineId,
                  batchId: batch.id,
                  movementType: 'OPENING_STOCK',
                  quantityDelta: new Decimal(openingStockBaseUnits),
                  referenceTable: 'opening_stock',
                  referenceId: batch.id,
                  note: `Excel bulk import opening stock (${rawOpeningPacks} ${purchaseUnitRaw})`,
                  actorId,
                },
              });
            } else {
              await tx.stockLedgerEntry.create({
                data: {
                  medicineId,
                  batchId: null,
                  movementType: 'OPENING_STOCK',
                  quantityDelta: new Decimal(openingStockBaseUnits),
                  referenceTable: 'opening_stock',
                  referenceId: medicineId,
                  note: `Excel bulk import opening stock (${rawOpeningPacks} ${purchaseUnitRaw})`,
                  actorId,
                },
              });
            }
          }

          successfulItems.push({ id: medicineId, code: medicineCode, name: medName, isNew });
        });
      } catch (err: any) {
        errors.push({
          row: rowNum,
          medicine: row.name,
          error: err.message || 'Unknown import error',
        });
      }
    };

    return {
      total: body.items.length,
      createdCount,
      updatedCount,
      failedCount: errors.length,
      errors,
      successfulItems,
    };
  },

  currentStock,
};