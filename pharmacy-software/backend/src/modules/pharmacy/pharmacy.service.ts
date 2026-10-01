import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError, ConflictError } from '@/shared/errors/AppError';
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
} from './pharmacy.schemas';

/** pharmacy.md §3 Settings screen — configured, not hardcoded; one singleton row, auto-created on first read. */
async function getSettings() {
  const existing = await prisma.pharmacySettings.findFirst();
  if (existing) return existing;
  return prisma.pharmacySettings.create({ data: {} });
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

  // ── Medicine Master (pharmacy.md §9) ────────────────────────────────────
  async createMedicine(body: CreateMedicineBody, actorId: string) {
    const dup = await prisma.medicineMaster.findFirst({ where: { OR: [{ code: body.code }, ...(body.barcode ? [{ barcode: body.barcode }] : [])] } });
    if (dup) throw new ConflictError('Medicine code or barcode already exists');
    // pharmacy.md §3 Settings "Tax/discount" policy — falls back to the configured default when the form leaves tax at 0.
    const taxPercent = body.taxPercent || (await getSettings()).defaultTaxPercent;
    return prisma.medicineMaster.create({ data: { ...body, taxPercent, createdById: actorId } });
  },

  async updateMedicine(id: string, body: UpdateMedicineBody) {
    const existing = await prisma.medicineMaster.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Medicine not found');
    return prisma.medicineMaster.update({ where: { id }, data: body });
  },

  async listMedicines(query: ListMedicinesQuery) {
    const [medicines, settings] = await Promise.all([
      prisma.medicineMaster.findMany({
        where: query.search
          ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }, { barcode: { contains: query.search, mode: 'insensitive' } }] }
          : undefined,
        include: { batches: true, stockEntries: { select: { quantityDelta: true } } },
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
        category: m.category,
        unit: m.unit,
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
    const batches = await prisma.medicineBatch.findMany({ where: { medicineId }, include: { stockEntries: { select: { quantityDelta: true } } }, orderBy: { expiryDate: 'asc' } });
    const now = new Date();
    return batches.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      costRate: b.costRate,
      saleRate: b.saleRate,
      currentStock: b.stockEntries.reduce((s, e) => s.plus(e.quantityDelta), new Decimal(0)),
      isExpired: b.expiryDate <= now,
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
      const adjustment = await tx.stockAdjustment.create({
        data: { medicineId: body.medicineId, batchId: body.batchId, type: body.type, quantity: new Decimal(body.quantity), reason: body.reason, createdById: actorId },
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

        const saleRate = medicine.saleRate;
        const reqQty = new Decimal(reqLine.quantity);
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

          linesToCreate.push({ medicineId: medicine.id, batchId: alloc.batchId, quantity: alloc.quantity, rateSnapshot: saleRate, discountAmount: allocDiscount, taxAmount: allocTax, lineNet: allocNet });
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

      const invoiceNumber = `PH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
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
        include: { lines: { include: { medicine: true, batch: true } }, payments: true },
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

      const refund = await tx.cashLedgerEntry.create({
        data: {
          portalUserId: actorId,
          direction: 'OUT',
          amount: refundTotal,
          category: 'REFUND',
          isPhysicalCash: body.refundMethod === 'CASH',
          referenceTable: 'pharmacy_invoices',
          referenceId: invoice.id,
          note: body.reason,
        },
      });

      return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, refundTotal, refundMethod: body.refundMethod, cashLedgerEntryId: refund.id };
    });
  },

  async getInvoiceById(id: string) {
    const invoice = await prisma.pharmacyInvoice.findUnique({
      where: { id },
      include: { lines: { include: { medicine: true, batch: true } }, payments: { include: { collectedByUser: { select: { id: true, fullName: true } } } }, dispensedByUser: { select: { id: true, fullName: true } } },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  },

  currentStock,
};
