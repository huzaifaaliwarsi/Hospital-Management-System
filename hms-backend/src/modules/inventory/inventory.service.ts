import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
import type {
  CreateSupplierBody,
  UpdateSupplierBody,
  CreateStockItemBody,
  UpdateStockItemBody,
  CreatePurchaseBody,
  CreateDepartmentIssueBody,
} from './inventory.schemas';

export const inventoryService = {
  // ── Suppliers ──────────────────────────────────────────────────────────
  async createSupplier(body: CreateSupplierBody, actorId: string) {
    return prisma.supplier.create({
      data: {
        ...body,
        createdById: actorId,
      },
    });
  },

  async updateSupplier(id: string, body: UpdateSupplierBody) {
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Supplier not found');
    return prisma.supplier.update({ where: { id }, data: body });
  },

  async listSuppliers(search?: string) {
    const suppliers = await prisma.supplier.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { contact: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        supplierLedger: true,
      },
      orderBy: { name: 'asc' },
    });

    return suppliers.map((s) => {
      // Outstanding balance: Credit purchases (+) minus Payments/returns (-)
      const outstanding = s.supplierLedger.reduce((acc, entry) => {
        if (entry.entryType === 'PURCHASE_CREDIT') {
          return acc.plus(entry.amount);
        } else {
          return acc.minus(entry.amount);
        }
      }, new Decimal(0));

      return {
        id: s.id,
        name: s.name,
        contact: s.contact,
        phone: s.phone,
        address: s.address,
        terms: s.terms,
        isActive: s.isActive,
        outstandingBalance: outstanding,
      };
    });
  },

  async getSupplierLedger(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        supplierLedger: {
          include: { actor: { select: { id: true, username: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!supplier) throw new NotFoundError('Supplier not found');

    const totalOutstanding = supplier.supplierLedger.reduce((acc, entry) => {
      return entry.entryType === 'PURCHASE_CREDIT'
        ? acc.plus(entry.amount)
        : acc.minus(entry.amount);
    }, new Decimal(0));

    return {
      supplier: { id: supplier.id, name: supplier.name, contact: supplier.contact },
      totalOutstanding,
      ledgerEntries: supplier.supplierLedger,
    };
  },

  // ── Stock Items & Running Balance ──────────────────────────────────────
  async createStockItem(body: CreateStockItemBody, actorId: string) {
    return prisma.stockItem.create({
      data: {
        ...body,
        reorderLevel: new Decimal(body.reorderLevel),
        createdById: actorId,
      },
    });
  },

  async updateStockItem(id: string, body: UpdateStockItemBody) {
    const existing = await prisma.stockItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Stock item not found');
    return prisma.stockItem.update({
      where: { id },
      data: {
        ...body,
        reorderLevel: body.reorderLevel !== undefined ? new Decimal(body.reorderLevel) : undefined,
      },
    });
  },

  async listStockItems(search?: string) {
    const items = await prisma.stockItem.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        stockLedgerEntries: { select: { quantityDelta: true } },
      },
      orderBy: { name: 'asc' },
    });

    return items.map((item) => {
      const currentStock = item.stockLedgerEntries.reduce(
        (sum, entry) => sum.plus(entry.quantityDelta),
        new Decimal(0),
      );
      const isLowStock = currentStock.lessThanOrEqualTo(item.reorderLevel);

      return {
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        reorderLevel: item.reorderLevel,
        isActive: item.isActive,
        currentStock,
        isLowStock,
      };
    });
  },

  async getItemLedger(stockItemId: string) {
    const item = await prisma.stockItem.findUnique({
      where: { id: stockItemId },
      include: {
        stockLedgerEntries: {
          include: { actor: { select: { id: true, username: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!item) throw new NotFoundError('Stock item not found');

    const runningStock = item.stockLedgerEntries.reduce(
      (sum, e) => sum.plus(e.quantityDelta),
      new Decimal(0),
    );

    return {
      item: { id: item.id, code: item.code, name: item.name, unit: item.unit },
      currentStock: runningStock,
      movements: item.stockLedgerEntries,
    };
  },

  // ── Fund Requests (Petty Cash for Inventory) ───────────────────────────
  async approveFundRequest(recipientUserId: string, amount: number) {
    const amountDecimal = new Decimal(amount);

    // Credits recipient's UserCashBalance (§4.8, D16 p.17)
    return prisma.userCashBalance.create({
      data: {
        portalUserId: recipientUserId,
        moduleScope: 'INVENTORY',
        direction: 'IN',
        amount: amountDecimal,
        category: 'PETTY_CASH_ISSUE',
        isPhysicalCash: true,
      },
    });
  },

  // ── Purchase Orders & Goods Receipt ────────────────────────────────────
  /**
   * Posts stock IN (+delta) into StockLedger; cash payment reduces user cash balance.
   */
  async createPurchase(body: CreatePurchaseBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: body.supplierId } });
      if (!supplier || !supplier.isActive) {
        throw new NotFoundError('Supplier not found or inactive');
      }

      let totalAmount = new Decimal(0);
      const linesData = [];

      for (const line of body.lines) {
        const item = await tx.stockItem.findUnique({ where: { id: line.stockItemId } });
        if (!item || !item.isActive) {
          throw new NotFoundError(`Stock item ${line.stockItemId} not found or inactive`);
        }
        const qty = new Decimal(line.quantity);
        const rate = new Decimal(line.rate);
        totalAmount = totalAmount.plus(qty.mul(rate));
        linesData.push({
          stockItemId: item.id,
          quantity: qty,
          rate,
          receivedQuantity: qty,
        });
      }

      // If paid by PETTY_CASH, verify user has sufficient physical cash balance
      if (body.paymentMethod === 'PETTY_CASH') {
        const userCashEntries = await tx.userCashBalance.findMany({
          where: { portalUserId: actorId, isSettled: false, isPhysicalCash: true },
        });
        const currentPhysicalCash = userCashEntries.reduce((sum, entry) => {
          return entry.direction === 'IN' ? sum.plus(entry.amount) : sum.minus(entry.amount);
        }, new Decimal(0));

        if (currentPhysicalCash.lessThan(totalAmount)) {
          throw new ValidationError(
            `Insufficient petty cash balance (Current: PKR ${currentPhysicalCash.toFixed(2)}, Required: PKR ${totalAmount.toFixed(2)}). Request petty cash advance first.`,
          );
        }

        // Deduct from user's UserCashBalance
        await tx.userCashBalance.create({
          data: {
            portalUserId: actorId,
            moduleScope: 'INVENTORY',
            direction: 'OUT',
            amount: totalAmount,
            category: 'PURCHASE',
            isPhysicalCash: true,
          },
        });
      }

      // Create PurchaseOrder record
      const po = await tx.purchaseOrder.create({
        data: {
          supplierId: supplier.id,
          status: 'RECEIVED',
          invoiceReference: body.invoiceReference,
          paymentMethod: body.paymentMethod,
          totalAmount,
          createdById: actorId,
          approvedById: actorId,
          approvedAt: new Date(),
          lines: {
            create: linesData,
          },
        },
        include: { lines: { include: { stockItem: true } } },
      });

      // Post +IN movement for each line to StockLedger (§6.1, §6.10)
      for (const line of po.lines) {
        await tx.stockLedger.create({
          data: {
            stockItemId: line.stockItemId,
            movementType: 'PURCHASE_RECEIPT',
            quantityDelta: line.quantity, // +IN
            referenceTable: 'purchase_orders',
            referenceId: po.id,
            actorId,
          },
        });
      }

      // Post to SupplierLedger
      if (body.paymentMethod === 'CREDIT') {
        await tx.supplierLedger.create({
          data: {
            supplierId: supplier.id,
            entryType: 'PURCHASE_CREDIT',
            amount: totalAmount,
            referenceTable: 'purchase_orders',
            referenceId: po.id,
            actorId,
          },
        });
      } else {
        // Immediate settlement (e.g. Petty cash / direct payment)
        await tx.supplierLedger.create({
          data: {
            supplierId: supplier.id,
            entryType: 'PAYMENT',
            amount: totalAmount,
            referenceTable: 'purchase_orders',
            referenceId: po.id,
            actorId,
          },
        });
      }

      return po;
    });
  },

  // ── Department Issue & Return ──────────────────────────────────────────
  /**
   * Requisition -> Issue stock -> Deduct StockLedger with department tag.
   * Negative stock is blocked (§4.8, D06 p.1).
   */
  async issueToDepartment(body: CreateDepartmentIssueBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const department = await tx.department.findUnique({ where: { id: body.departmentId } });
      if (!department) throw new NotFoundError('Department not found');

      // Verify stock sufficiency for every requested item before executing
      for (const line of body.lines) {
        const item = await tx.stockItem.findUnique({
          where: { id: line.stockItemId },
          include: { stockLedgerEntries: { select: { quantityDelta: true } } },
        });

        if (!item || !item.isActive) {
          throw new NotFoundError(`Stock item ${line.stockItemId} not found or inactive`);
        }

        const currentStock = item.stockLedgerEntries.reduce(
          (sum, e) => sum.plus(e.quantityDelta),
          new Decimal(0),
        );

        const requestedQty = new Decimal(line.quantity);
        if (currentStock.lessThan(requestedQty)) {
          throw new ValidationError(
            `Insufficient stock for "${item.name}" (Available: ${currentStock.toString()} ${item.unit}, Requested: ${requestedQty.toString()} ${item.unit}). Cannot drive stock negative.`,
          );
        }
      }

      // Create DepartmentRequisition
      const requisition = await tx.departmentRequisition.create({
        data: {
          departmentId: department.id,
          status: 'ISSUED',
          issuedById: actorId,
          receivedByName: body.receivedByName,
          lines: {
            create: body.lines.map((l) => ({
              stockItemId: l.stockItemId,
              quantity: new Decimal(l.quantity),
            })),
          },
        },
        include: { lines: { include: { stockItem: true } } },
      });

      // Post -OUT movement for each line to StockLedger
      for (const line of requisition.lines) {
        await tx.stockLedger.create({
          data: {
            stockItemId: line.stockItemId,
            movementType: 'DEPARTMENT_ISSUE',
            quantityDelta: line.quantity.negated(), // -OUT
            referenceTable: 'department_requisitions',
            referenceId: requisition.id,
            actorId,
          },
        });
      }

      return requisition;
    });
  },
};
