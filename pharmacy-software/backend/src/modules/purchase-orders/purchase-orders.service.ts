import { prisma } from '@/db/client';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/AppError';
import { nextCode, peekNextCode, SEQUENCE } from '@/shared/sequence';
import type { CreatePurchaseOrderBody, ListPurchaseOrdersQuery } from './purchase-orders.schemas';

const includeDetail = {
  vendor: true,
  createdByUser: { select: { id: true, fullName: true, username: true } },
  lines: { include: { medicine: true, requiredUnit: true } },
};

/**
 * Purchase Order — the simple procurement reminder/order screen (what we
 * want to order). Deliberately isolated from vendors.service.ts's
 * createPurchase/postPurchase pipeline (what we actually received): nothing
 * here ever touches StockLedgerEntry, MedicineBatch, VendorLedgerEntry or
 * CashLedgerEntry. A PO is never required before a real Purchase.
 */
export const purchaseOrdersService = {
  /** Preview only — not reserved. See `peekNextCode` doc comment. */
  async peekNextOrderCode() {
    return peekNextCode(SEQUENCE.PURCHASE_ORDER);
  },

  async list(query: ListPurchaseOrdersQuery) {
    return prisma.purchaseOrder.findMany({
      where: query.status ? { status: query.status } : undefined,
      include: includeDetail,
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: string) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: includeDetail });
    if (!order) throw new NotFoundError('Purchase order not found');
    return order;
  },

  async create(body: CreatePurchaseOrderBody, actorId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { id: body.vendorId } });
    if (!vendor) throw new NotFoundError('Vendor not found');

    const medicineIds = [...new Set(body.lines.map((l) => l.medicineId))];
    const medicineCount = await prisma.medicineMaster.count({ where: { id: { in: medicineIds }, isActive: true } });
    if (medicineCount !== medicineIds.length) throw new ValidationError('One or more selected medicines were not found or are inactive');

    return prisma.$transaction(async (tx) => {
      const orderNumber = await nextCode(tx, SEQUENCE.PURCHASE_ORDER);
      return tx.purchaseOrder.create({
        data: {
          orderNumber,
          vendorId: body.vendorId,
          orderDate: body.orderDate,
          isUrgent: body.isUrgent,
          notes: body.notes,
          createdById: actorId,
          lines: {
            create: body.lines.map((l) => ({
              medicineId: l.medicineId,
              requiredUnitId: l.requiredUnitId,
              requiredQty: l.requiredQty,
              lineNotes: l.lineNotes,
            })),
          },
        },
        include: includeDetail,
      });
    });
  },

  async cancel(id: string) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundError('Purchase order not found');
    if (order.status !== 'OPEN') throw new ConflictError(`Purchase order is already ${order.status.toLowerCase()}`);
    return prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
  },

  /** Marks a PO used once its "Receive / Convert to Stock In" pre-fill has been opened — the PO itself still never posts stock; the resulting Purchase is a fully independent record. */
  async markConverted(id: string) {
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundError('Purchase order not found');
    if (order.status !== 'OPEN') throw new ConflictError(`Purchase order is already ${order.status.toLowerCase()}`);
    return prisma.purchaseOrder.update({ where: { id }, data: { status: 'CONVERTED' } });
  },
};
