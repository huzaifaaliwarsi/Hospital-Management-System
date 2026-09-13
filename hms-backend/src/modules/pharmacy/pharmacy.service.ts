import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
import type {
  CreateMedicineBody,
  UpdateMedicineBody,
  CreateBatchBody,
  DispenseRetailBody,
} from './pharmacy.schemas';

export interface BatchAllocation {
  batchId: string | null;
  quantity: Decimal;
  costRate: Decimal;
}

export const pharmacyService = {
  // ── Medicine Master ────────────────────────────────────────────────────────
  async createMedicine(body: CreateMedicineBody, actorId: string) {
    return prisma.medicineMaster.create({
      data: {
        code: body.code,
        name: body.name,
        category: body.category,
        unit: body.unit,
        batchManaged: body.batchManaged,
        purchaseRate: body.purchaseRate !== undefined ? new Decimal(body.purchaseRate) : undefined,
        saleRate: body.saleRate !== undefined ? new Decimal(body.saleRate) : undefined,
        createdById: actorId,
      },
    });
  },

  async updateMedicine(id: string, body: UpdateMedicineBody) {
    const existing = await prisma.medicineMaster.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Medicine not found');

    return prisma.medicineMaster.update({
      where: { id },
      data: {
        ...body,
        purchaseRate: body.purchaseRate !== undefined ? new Decimal(body.purchaseRate) : undefined,
        saleRate: body.saleRate !== undefined ? new Decimal(body.saleRate) : undefined,
      },
    });
  },

  async listMedicines(search?: string) {
    const medicines = await prisma.medicineMaster.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        batches: true,
        stockLedgerEntries: { select: { quantityDelta: true } },
      },
      orderBy: { name: 'asc' },
    });

    return medicines.map((m) => {
      const currentStock = m.stockLedgerEntries.reduce(
        (acc, entry) => acc.plus(entry.quantityDelta),
        new Decimal(0),
      );

      return {
        id: m.id,
        code: m.code,
        name: m.name,
        category: m.category,
        unit: m.unit,
        batchManaged: m.batchManaged,
        purchaseRate: m.purchaseRate,
        saleRate: m.saleRate,
        isActive: m.isActive,
        currentStock,
        batchesCount: m.batches.length,
      };
    });
  },

  // ── Batches ────────────────────────────────────────────────────────────────
  async createBatch(medicineId: string, body: CreateBatchBody, actorId: string) {
    const medicine = await prisma.medicineMaster.findUnique({ where: { id: medicineId } });
    if (!medicine) throw new NotFoundError('Medicine not found');

    return prisma.medicineBatch.create({
      data: {
        medicineId,
        batchNumber: body.batchNumber,
        expiryDate: new Date(body.expiryDate),
        costRate: new Decimal(body.costRate),
        createdById: actorId,
      },
    });
  },

  async receiveBatchStock(
    medicineId: string,
    batchId: string,
    quantity: number,
    actorId: string,
    referenceInvoice?: string,
  ) {
    const batch = await prisma.medicineBatch.findUnique({
      where: { id: batchId },
      include: { medicine: true },
    });
    if (!batch || batch.medicineId !== medicineId) {
      throw new NotFoundError('Batch not found for this medicine');
    }

    const qtyDecimal = new Decimal(quantity);

    return prisma.medicineStockLedger.create({
      data: {
        medicineId,
        batchId,
        movementType: 'RECEIPT',
        quantityDelta: qtyDecimal, // +IN
        referenceTable: 'goods_receipt',
        referenceId: referenceInvoice || batch.id,
        actorId,
      },
    });
  },

  async getMedicineBatches(medicineId: string) {
    const batches = await prisma.medicineBatch.findMany({
      where: { medicineId },
      include: {
        stockLedgerEntries: { select: { quantityDelta: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const now = new Date();

    return batches.map((b) => {
      const stock = b.stockLedgerEntries.reduce(
        (sum, e) => sum.plus(e.quantityDelta),
        new Decimal(0),
      );
      const isExpired = b.expiryDate <= now;

      return {
        id: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        costRate: b.costRate,
        currentStock: stock,
        isExpired,
      };
    });
  },

  // ── FEFO Allocation Engine (D09 p.1) ────────────────────────────────────────
  /**
   * Sorts active batches by earliest expiryDate first.
   * Discards expired batches (expiryDate <= now) to prevent dispensing expired stock.
   * Allocates quantity across available batches.
   */
  async allocateFefoBatches(
    medicineId: string,
    requestedQuantity: Decimal,
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  ): Promise<BatchAllocation[]> {
    const medicine = await tx.medicineMaster.findUnique({
      where: { id: medicineId },
      include: {
        batches: {
          orderBy: { expiryDate: 'asc' },
          include: { stockLedgerEntries: { select: { quantityDelta: true } } },
        },
      },
    });

    if (!medicine || !medicine.isActive) {
      throw new NotFoundError(`Medicine ${medicineId} not found or inactive`);
    }

    if (!medicine.batchManaged) {
      // Non-batch managed medicine: calculate total from stock ledger
      const allEntries = await tx.medicineStockLedger.findMany({
        where: { medicineId },
        select: { quantityDelta: true },
      });
      const totalStock = allEntries.reduce((sum, e) => sum.plus(e.quantityDelta), new Decimal(0));
      if (totalStock.lessThan(requestedQuantity)) {
        throw new ValidationError(
          `Insufficient stock for medicine "${medicine.name}". Available: ${totalStock.toString()}, Requested: ${requestedQuantity.toString()}`,
        );
      }
      return [
        {
          batchId: null,
          quantity: requestedQuantity,
          costRate: medicine.purchaseRate ?? new Decimal(0),
        },
      ];
    }

    const now = new Date();
    // Filter out expired batches and batches with zero or negative stock
    const activeBatchesWithStock = medicine.batches
      .filter((b) => b.expiryDate > now)
      .map((b) => {
        const available = b.stockLedgerEntries.reduce(
          (sum, e) => sum.plus(e.quantityDelta),
          new Decimal(0),
        );
        return {
          id: b.id,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          costRate: b.costRate,
          available,
        };
      })
      .filter((b) => b.available.greaterThan(0));

    let remaining = requestedQuantity;
    const allocations: BatchAllocation[] = [];

    for (const batch of activeBatchesWithStock) {
      if (remaining.lessThanOrEqualTo(0)) break;

      const take = remaining.lessThan(batch.available) ? remaining : batch.available;
      allocations.push({
        batchId: batch.id,
        quantity: take,
        costRate: batch.costRate,
      });

      remaining = remaining.minus(take);
    }

    if (remaining.greaterThan(0)) {
      const totalAvailable = activeBatchesWithStock.reduce(
        (sum, b) => sum.plus(b.available),
        new Decimal(0),
      );
      throw new ValidationError(
        `Insufficient non-expired stock for "${medicine.name}". Available: ${totalAvailable.toString()} ${medicine.unit}, Requested: ${requestedQuantity.toString()} ${medicine.unit}`,
      );
    }

    return allocations;
  },

  // ── Retail FEFO Dispensing ────────────────────────────────────────────────
  async dispenseRetail(body: DispenseRetailBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      let subtotal = new Decimal(0);
      let discountTotal = new Decimal(0);

      // Unique retail invoice number
      const invoiceNumber = `PHARM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Dispense lines to persist
      const linesToCreate: {
        medicineId: string;
        batchId: string | null;
        quantity: Decimal;
        rateSnapshot: Decimal;
        discountAmount: Decimal;
        lineNet: Decimal;
      }[] = [];

      const stockDeductions: {
        medicineId: string;
        batchId: string | null;
        quantity: Decimal;
      }[] = [];

      for (const reqLine of body.lines) {
        const medicine = await tx.medicineMaster.findUnique({
          where: { id: reqLine.medicineId },
        });
        if (!medicine || !medicine.isActive) {
          throw new NotFoundError(`Medicine ${reqLine.medicineId} not found or inactive`);
        }

        const saleRate = medicine.saleRate ?? new Decimal(0);
        const reqQty = new Decimal(reqLine.quantity);
        const lineDiscount = new Decimal(reqLine.discountAmount || 0);

        // FEFO allocation
        const allocations = await pharmacyService.allocateFefoBatches(medicine.id, reqQty, tx);

        // Calculate line totals across allocations
        for (let i = 0; i < allocations.length; i++) {
          const alloc = allocations[i]!;
          const allocGross = alloc.quantity.mul(saleRate);
          // Allocate discount proportionally or to the first batch chunk
          const allocDiscount = i === 0 ? lineDiscount : new Decimal(0);
          const allocNet = allocGross.minus(allocDiscount);

          subtotal = subtotal.plus(allocGross);
          discountTotal = discountTotal.plus(allocDiscount);

          linesToCreate.push({
            medicineId: medicine.id,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
            rateSnapshot: saleRate,
            discountAmount: allocDiscount,
            lineNet: allocNet,
          });

          stockDeductions.push({
            medicineId: medicine.id,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
          });
        }
      }

      const total = subtotal.minus(discountTotal);

      // Create PharmacyDispense record
      const dispense = await tx.pharmacyDispense.create({
        data: {
          invoiceNumber,
          channel: 'RETAIL',
          panelPatientId: body.panelPatientId,
          selfPayEncounterId: body.selfPayEncounterId,
          subtotal,
          discountTotal,
          total,
          paidTotal: total,
          status: 'PAID',
          dispensedById: actorId,
          lines: {
            create: linesToCreate,
          },
        },
        include: {
          lines: {
            include: {
              medicine: true,
              batch: true,
            },
          },
        },
      });

      // Post stock deductions to MedicineStockLedger (-OUT)
      for (const deduction of stockDeductions) {
        await tx.medicineStockLedger.create({
          data: {
            medicineId: deduction.medicineId,
            batchId: deduction.batchId,
            movementType: 'SALE',
            quantityDelta: deduction.quantity.negated(), // -OUT
            referenceTable: 'pharmacy_dispenses',
            referenceId: dispense.id,
            actorId,
          },
        });
      }

      // Record cash collection into UserCashBalance (§4.8, §4.10)
      if (total.greaterThan(0)) {
        await tx.userCashBalance.create({
          data: {
            portalUserId: actorId,
            moduleScope: 'PHARMACY',
            direction: 'IN',
            amount: total,
            category: 'COLLECTION',
            isPhysicalCash: true,
          },
        });
      }

      return dispense;
    });
  },
};
