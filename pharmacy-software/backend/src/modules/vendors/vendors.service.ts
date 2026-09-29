import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ConflictError, ValidationError } from '@/shared/errors/AppError';
import type { CreateVendorBody, UpdateVendorBody, PayVendorBody, CreatePurchaseBody, PurchaseReturnBody } from './vendors.schemas';

/** pharmacy.md §10.3 — Opening + Purchases - Payments - Returns/Credits +/- Adjustments = Closing. */
async function vendorBalance(vendorId: string): Promise<Decimal> {
  const entries = await prisma.vendorLedgerEntry.findMany({ where: { vendorId }, select: { amount: true } });
  return entries.reduce((sum, e) => sum.plus(e.amount), new Decimal(0));
}

export const vendorsService = {
  async create(body: CreateVendorBody, actorId: string) {
    const dup = await prisma.vendor.findUnique({ where: { code: body.code } });
    if (dup) throw new ConflictError('Vendor code already exists');
    return prisma.vendor.create({ data: { ...body, createdById: actorId } });
  },

  async update(id: string, body: UpdateVendorBody) {
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Vendor not found');
    return prisma.vendor.update({ where: { id }, data: body });
  },

  async list(search?: string) {
    const vendors = await prisma.vendor.findMany({
      where: search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }] } : undefined,
      orderBy: { name: 'asc' },
    });
    const withBalance = await Promise.all(vendors.map(async (v) => ({ ...v, currentPayable: await vendorBalance(v.id) })));
    return withBalance;
  },

  async getLedger(vendorId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError('Vendor not found');
    const entries = await prisma.vendorLedgerEntry.findMany({ where: { vendorId }, include: { actor: { select: { id: true, fullName: true, username: true } } }, orderBy: { createdAt: 'asc' } });

    let running = new Decimal(0);
    const rows = entries.map((e) => {
      running = running.plus(e.amount);
      return { ...e, runningBalance: running };
    });
    return { vendor, currentPayable: running, entries: rows };
  },

  /** pharmacy.md §10.1 Purchase / Stock In — posts PURCHASE_IN stock + PURCHASE_CREDIT vendor ledger, optional immediate payment. */
  async createPurchase(body: CreatePurchaseBody, actorId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { id: body.vendorId } });
    if (!vendor) throw new NotFoundError('Vendor not found');

    return prisma.$transaction(async (tx) => {
      let subtotal = new Decimal(0);
      let discountTotal = new Decimal(0);
      let taxTotal = new Decimal(0);
      const lineRows: { medicineId: string; batchId: string | null; quantity: Decimal; unitCost: Decimal; discountAmount: Decimal; taxAmount: Decimal; lineTotal: Decimal }[] = [];

      for (const line of body.lines) {
        const medicine = await tx.medicineMaster.findUnique({ where: { id: line.medicineId } });
        if (!medicine) throw new NotFoundError(`Medicine ${line.medicineId} not found`);

        const batch = await tx.medicineBatch.upsert({
          where: { medicineId_batchNumber: { medicineId: line.medicineId, batchNumber: line.batchNumber } },
          create: { medicineId: line.medicineId, batchNumber: line.batchNumber, expiryDate: line.expiryDate, costRate: line.unitCost, createdById: actorId },
          update: { costRate: line.unitCost },
        });

        const qty = new Decimal(line.quantity);
        const lineGross = qty.mul(line.unitCost);
        const discount = new Decimal(line.discountAmount);
        const tax = new Decimal(line.taxAmount);
        const lineTotal = lineGross.minus(discount).plus(tax);

        subtotal = subtotal.plus(lineGross);
        discountTotal = discountTotal.plus(discount);
        taxTotal = taxTotal.plus(tax);

        lineRows.push({ medicineId: line.medicineId, batchId: batch.id, quantity: qty, unitCost: new Decimal(line.unitCost), discountAmount: discount, taxAmount: tax, lineTotal });
      }

      const total = subtotal.minus(discountTotal).plus(taxTotal);
      const paidNow = new Decimal(body.paidNow);
      if (paidNow.greaterThan(total)) throw new ValidationError('Paid Now cannot exceed the purchase total');
      const vendorDue = total.minus(paidNow);
      const purchaseNumber = `PO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          vendorId: body.vendorId,
          purchaseDate: body.purchaseDate,
          vendorInvoiceNo: body.vendorInvoiceNo,
          paymentType: body.paymentType,
          notes: body.notes,
          status: body.post ? 'POSTED' : 'DRAFT',
          subtotal,
          discountTotal,
          taxTotal,
          total,
          paidNow,
          vendorDue,
          createdById: actorId,
          lines: { create: lineRows },
        },
        include: { lines: { include: { medicine: true, batch: true } }, vendor: true },
      });

      if (body.post) {
        for (const line of lineRows) {
          await tx.stockLedgerEntry.create({
            data: { medicineId: line.medicineId, batchId: line.batchId, movementType: 'PURCHASE_IN', quantityDelta: line.quantity, referenceTable: 'purchases', referenceId: purchase.id, actorId },
          });
        }
        await tx.vendorLedgerEntry.create({
          data: { vendorId: body.vendorId, entryType: 'PURCHASE_CREDIT', amount: total, description: `Purchase ${purchaseNumber}`, referenceTable: 'purchases', referenceId: purchase.id, actorId },
        });
        if (paidNow.greaterThan(0)) {
          await tx.vendorLedgerEntry.create({
            data: { vendorId: body.vendorId, entryType: 'PAYMENT', amount: paidNow.negated(), description: `Paid on purchase ${purchaseNumber}`, referenceTable: 'purchases', referenceId: purchase.id, actorId },
          });
          await tx.cashLedgerEntry.create({
            data: { portalUserId: actorId, direction: 'OUT', amount: paidNow, category: 'VENDOR_PAYMENT', isPhysicalCash: body.paymentType === 'CASH', referenceTable: 'purchases', referenceId: purchase.id },
          });
        }
      }

      return purchase;
    });
  },

  async payVendor(vendorId: string, body: PayVendorBody, actorId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundError('Vendor not found');
    const amount = new Decimal(body.amount);

    return prisma.$transaction(async (tx) => {
      const entry = await tx.vendorLedgerEntry.create({
        data: { vendorId, entryType: 'PAYMENT', amount: amount.negated(), description: `Vendor payment (${body.method})`, referenceTable: 'vendor_payments', referenceId: vendorId, actorId },
      });
      await tx.cashLedgerEntry.create({
        data: { portalUserId: actorId, direction: 'OUT', amount, category: 'VENDOR_PAYMENT', isPhysicalCash: body.method === 'CASH', referenceTable: 'vendor_ledger_entries', referenceId: entry.id },
      });
      return entry;
    });
  },

  /** pharmacy.md §9.1 PURCHASE_RETURN_OUT + vendor RETURN_CREDIT. */
  async purchaseReturn(body: PurchaseReturnBody, actorId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { id: body.vendorId } });
    if (!vendor) throw new NotFoundError('Vendor not found');

    return prisma.$transaction(async (tx) => {
      let total = new Decimal(0);
      for (const line of body.lines) {
        const qty = new Decimal(line.quantity);
        const lineTotal = qty.mul(line.unitCost);
        total = total.plus(lineTotal);
        await tx.stockLedgerEntry.create({
          data: { medicineId: line.medicineId, batchId: line.batchId, movementType: 'PURCHASE_RETURN_OUT', quantityDelta: qty.negated(), referenceTable: 'purchase_returns', referenceId: body.vendorId, note: body.reason, actorId },
        });
      }
      return tx.vendorLedgerEntry.create({
        data: { vendorId: body.vendorId, entryType: 'RETURN_CREDIT', amount: total.negated(), description: body.reason, referenceTable: 'purchase_returns', referenceId: body.vendorId, actorId },
      });
    });
  },
};
