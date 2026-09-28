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
  CreateDepartmentReturnBody,
  CreateSupplierReturnBody,
  CreateAdjustmentBody,
  CreateInventoryExpenseBody,
  PaySupplierBody,
} from './inventory.schemas';
import type { StockAdjustmentType } from '@prisma/client';

// inventory.md §4.2 — the type dictates the direction for every type except
// COUNT_CORRECTION, which genuinely can go either way.
const FIXED_ADJUSTMENT_DIRECTION: Partial<Record<StockAdjustmentType, 'INCREASE' | 'DECREASE'>> = {
  DAMAGE: 'DECREASE',
  EXPIRY: 'DECREASE',
  LOSS: 'DECREASE',
  QUARANTINE: 'DECREASE',
  SURPLUS: 'INCREASE',
};

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

    // Fetch associated purchase orders so line items are displayed in the ledger
    const poIds = supplier.supplierLedger
      .filter((e) => e.referenceTable === 'purchase_orders' && e.referenceId)
      .map((e) => e.referenceId as string);

    const purchaseOrders =
      poIds.length > 0
        ? await prisma.purchaseOrder.findMany({
            where: { id: { in: poIds } },
            include: {
              lines: {
                include: {
                  stockItem: { select: { id: true, code: true, name: true, unit: true } },
                },
              },
            },
          })
        : [];

    const poMap = new Map(purchaseOrders.map((p) => [p.id, p]));

    const enrichedEntries = supplier.supplierLedger.map((entry) => {
      const po = entry.referenceId ? poMap.get(entry.referenceId) : null;
      return {
        ...entry,
        items: po
          ? po.lines.map((l) => ({
              itemCode: l.stockItem.code,
              itemName: l.stockItem.name,
              unit: l.stockItem.unit,
              quantity: l.quantity,
              rate: l.rate,
              batchNo: l.batchNo,
            }))
          : [],
        invoiceReference: po?.invoiceReference || null,
      };
    });

    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        contact: supplier.contact,
        phone: supplier.phone,
        terms: supplier.terms,
      },
      totalOutstanding,
      ledgerEntries: enrichedEntries,
    };
  },

  /** Pay Supplier (inventory.md §5.2, §9 step 12) — reduces payable; a
   * PETTY_CASH payment also deducts the paying user's own physical cash
   * (mirrors createPurchase's cash-purchase deduction). */
  async paySupplier(supplierId: string, body: PaySupplierBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier || !supplier.isActive) throw new NotFoundError('Supplier not found or inactive');

      const amount = new Decimal(body.amount);

      let payRef = body.reference?.trim();
      if (!payRef) {
        const count = await tx.supplierLedger.count({ where: { entryType: 'PAYMENT' } });
        const nextNum = (count + 1) % 100 || 1;
        payRef = `PAY-${String(nextNum).padStart(2, '0')}`;
      }

      const entry = await tx.supplierLedger.create({
        data: {
          supplierId,
          entryType: 'PAYMENT',
          amount,
          referenceTable: 'suppliers',
          referenceId: payRef,
          actorId,
        },
      });

      if (body.paymentMethod === 'PETTY_CASH') {
        const userCashEntries = await tx.userCashBalance.findMany({
          where: { portalUserId: actorId, isSettled: false, isPhysicalCash: true },
        });
        const currentPhysicalCash = userCashEntries.reduce(
          (sum, e) => (e.direction === 'IN' ? sum.plus(e.amount) : sum.minus(e.amount)),
          new Decimal(0),
        );
        if (currentPhysicalCash.lessThan(amount)) {
          throw new ValidationError(
            `Insufficient petty cash balance (Current: PKR ${currentPhysicalCash.toFixed(2)}, Required: PKR ${amount.toFixed(2)}).`,
          );
        }

        await tx.userCashBalance.create({
          data: {
            portalUserId: actorId,
            moduleScope: 'INVENTORY',
            direction: 'OUT',
            amount,
            category: 'PURCHASE',
            isPhysicalCash: true,
            note: `Supplier payment — ${supplier.name}${body.reference ? ` (Ref: ${body.reference})` : ''}`,
          },
        });
      }

      return entry;
    });
  },

  /** Delete Supplier and clean up related records safely */
  async deleteSupplier(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundError('Supplier not found');

    return prisma.$transaction(async (tx) => {
      // Find any purchase orders belonging to this supplier
      const pos = await tx.purchaseOrder.findMany({
        where: { supplierId },
        select: { id: true },
      });
      const poIds = pos.map((p) => p.id);

      if (poIds.length > 0) {
        // Delete associated stock ledger movements for these purchase orders
        await tx.stockLedger.deleteMany({
          where: { referenceTable: 'purchase_orders', referenceId: { in: poIds } },
        });
        // Delete purchase order lines
        await tx.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: { in: poIds } },
        });
        // Delete purchase orders
        await tx.purchaseOrder.deleteMany({
          where: { id: { in: poIds } },
        });
      }

      // Delete supplier ledger entries
      await tx.supplierLedger.deleteMany({ where: { supplierId } });

      // Delete the supplier
      await tx.supplier.delete({ where: { id: supplierId } });

      return { success: true, message: `Supplier "${supplier.name}" deleted successfully` };
    });
  },

  /** Delete Stock Item and clean up related stock records safely */
  async deleteStockItem(stockItemId: string) {
    const item = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
    if (!item) throw new NotFoundError('Stock item not found');

    return prisma.$transaction(async (tx) => {
      // Delete associated stock ledger entries
      await tx.stockLedger.deleteMany({ where: { stockItemId } });
      // Delete purchase order lines
      await tx.purchaseOrderLine.deleteMany({ where: { stockItemId } });
      // Delete department requisition lines
      await tx.departmentRequisitionLine.deleteMany({ where: { stockItemId } });
      // Delete stock adjustments
      await tx.stockAdjustment.deleteMany({ where: { stockItemId } });
      // Delete stock item
      await tx.stockItem.delete({ where: { id: stockItemId } });

      return { success: true, message: `Stock item "${item.name}" deleted successfully` };
    });
  },

  // ── Stock Items & Running Balance ──────────────────────────────────────
  async createStockItem(body: CreateStockItemBody, actorId: string) {
    let itemCode = body.code?.trim();
    if (!itemCode) {
      const items = await prisma.stockItem.findMany({ select: { code: true } });
      let maxNum = 0;
      for (const it of items) {
        const m = it.code.match(/ITM-?(\d+)/i);
        if (m && m[1]) {
          const n = parseInt(m[1], 10);
          if (n < 100 && n > maxNum) maxNum = n;
        }
      }
      const nextNum = (maxNum + 1) % 100 || 1;
      itemCode = `ITM-${String(nextNum).padStart(2, '0')}`;
    }

    return prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.create({
        data: {
          code: itemCode,
          name: body.name,
          category: body.category,
          unit: body.unit,
          location: body.location,
          reorderLevel: new Decimal(body.reorderLevel),
          createdById: actorId,
        },
      });

      const initialQty = body.initialQuantity ? new Decimal(body.initialQuantity) : new Decimal(0);
      const rate = body.unitCost ? new Decimal(body.unitCost) : new Decimal(0);

      if (initialQty.greaterThan(0)) {
        const supplier = body.supplierId
          ? await tx.supplier.findUnique({ where: { id: body.supplierId } })
          : null;

        if (supplier) {
          const poCount = await tx.purchaseOrder.count();
          const nextGrn = (poCount + 1) % 100 || 1;
          const invoiceRef = `GRN-${String(nextGrn).padStart(2, '0')}`;
          const batchNo = `BN-${String(nextGrn).padStart(2, '0')}`;
          const totalAmount = initialQty.mul(rate);

          const po = await tx.purchaseOrder.create({
            data: {
              supplierId: supplier.id,
              status: 'RECEIVED',
              invoiceReference: invoiceRef,
              paymentMethod: 'CREDIT',
              totalAmount,
              createdById: actorId,
              approvedById: actorId,
              approvedAt: new Date(),
              lines: {
                create: [
                  {
                    stockItemId: item.id,
                    quantity: initialQty,
                    rate,
                    receivedQuantity: initialQty,
                    batchNo,
                  },
                ],
              },
            },
          });

          await tx.stockLedger.create({
            data: {
              stockItemId: item.id,
              movementType: 'PURCHASE_RECEIPT',
              quantityDelta: initialQty,
              batchNo,
              referenceTable: 'purchase_orders',
              referenceId: po.id,
              actorId,
            },
          });

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
          await tx.stockLedger.create({
            data: {
              stockItemId: item.id,
              movementType: 'POSITIVE_ADJUSTMENT',
              quantityDelta: initialQty,
              batchNo: 'BN-01',
              referenceTable: 'stock_items',
              referenceId: item.id,
              actorId,
            },
          });
        }
      }

      return item;
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
        location: item.location,
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

  // ── Fund Requests / Petty Cash Received (inventory.md §6.1, §9 step 6) ──
  async approveFundRequest(recipientUserId: string, amount: number, reason: string, issuedById: string) {
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
        note: reason,
        issuedById,
      },
    });
  },

  /** Petty Cash Received tab — the calling user's own receipts. */
  async listPettyCash(portalUserId: string) {
    return prisma.userCashBalance.findMany({
      where: { portalUserId, moduleScope: 'INVENTORY', category: 'PETTY_CASH_ISSUE' },
      include: { issuedByUser: { select: { id: true, displayName: true, username: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 500,
    });
  },

  // ── Inventory Expenses (inventory.md §6.1, §9 step 6) ──────────────────
  /**
   * Deliberately separate from `expensesService` (Super Admin/Admin's
   * hospital-wide operating-expense ledger) — this one also posts a
   * `UserCashBalance` OUT/EXPENSE entry so it reduces the creating
   * Inventory user's own expected cash (§6.2 formula).
   */
  async createInventoryExpense(body: CreateInventoryExpenseBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const amount = new Decimal(body.amount);

      let expRef = body.reference?.trim();
      if (!expRef) {
        const expCount = await tx.inventoryExpense.count();
        const nextNum = (expCount + 1) % 100 || 1;
        expRef = `EXP-${String(nextNum).padStart(2, '0')}`;
      }

      const expense = await tx.inventoryExpense.create({
        data: {
          expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
          category: body.category,
          amount,
          paymentMethod: body.paymentMethod,
          payee: body.payee,
          description: body.description,
          reference: expRef,
          createdById: actorId,
        },
      });

      await tx.userCashBalance.create({
        data: {
          portalUserId: actorId,
          moduleScope: 'INVENTORY',
          direction: 'OUT',
          amount,
          category: 'EXPENSE',
          isPhysicalCash: body.paymentMethod === 'CASH',
          note: body.description ?? body.category,
        },
      });

      return expense;
    });
  },

  /** Inventory Expenses tab — the calling user's own recorded expenses. */
  async listInventoryExpenses(actorId: string) {
    return prisma.inventoryExpense.findMany({
      where: { createdById: actorId },
      orderBy: { expenseDate: 'desc' },
      take: 500,
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
        const batchNo: string =
          line.batchNo?.trim() ||
          `BN-${String((linesData.length + 1) % 100 || 1).padStart(2, '0')}`;
        totalAmount = totalAmount.plus(qty.mul(rate));
        linesData.push({
          stockItemId: item.id,
          quantity: qty,
          rate,
          receivedQuantity: qty,
          batchNo,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : undefined,
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

      // Auto-generate GRN / invoice reference if omitted
      let invoiceRef = body.invoiceReference?.trim();
      if (!invoiceRef) {
        const poCount = await tx.purchaseOrder.count();
        const nextGrn = (poCount + 1) % 100 || 1;
        invoiceRef = `GRN-${String(nextGrn).padStart(2, '0')}`;
      }

      // Create PurchaseOrder record
      const po = await tx.purchaseOrder.create({
        data: {
          supplierId: supplier.id,
          status: 'RECEIVED',
          invoiceReference: invoiceRef,
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
            batchNo: line.batchNo,
            expiryDate: line.expiryDate,
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

  /**
   * Department Return (inventory.md §4.2, §9 step 3) — brings unused/
   * returned stock back from a department against its original issue.
   * USABLE quantity is posted back to StockLedger as +IN; DAMAGED/EXPIRED
   * quantity is not (Quarantine/Adjustment routing is §9 step 5, not yet
   * built) but still counts against the line's `returnedQuantity` so a
   * department can never be credited for returning more than was issued.
   */
  async receiveDepartmentReturn(body: CreateDepartmentReturnBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const requisition = await tx.departmentRequisition.findUnique({
        where: { id: body.departmentRequisitionId },
        include: { lines: true },
      });
      if (!requisition) throw new NotFoundError('Department requisition not found');
      if (requisition.status === 'CLOSED') {
        throw new ValidationError('This requisition has already been fully returned.');
      }

      const lineById = new Map(requisition.lines.map((l) => [l.id, l]));

      for (const returnLine of body.lines) {
        const line = lineById.get(returnLine.departmentRequisitionLineId);
        if (!line) {
          throw new NotFoundError(
            `Requisition line ${returnLine.departmentRequisitionLineId} not found on requisition ${requisition.id}`,
          );
        }

        const qty = new Decimal(returnLine.quantity);
        const remaining = line.quantity.minus(line.returnedQuantity);
        if (qty.greaterThan(remaining)) {
          throw new ValidationError(
            `Cannot return ${qty.toString()} — only ${remaining.toString()} still outstanding on this line ` +
              `(issued ${line.quantity.toString()}, already returned ${line.returnedQuantity.toString()}).`,
          );
        }

        await tx.departmentRequisitionLine.update({
          where: { id: line.id },
          data: { returnedQuantity: line.returnedQuantity.plus(qty) },
        });

        if (returnLine.condition === 'USABLE') {
          await tx.stockLedger.create({
            data: {
              stockItemId: line.stockItemId,
              movementType: 'DEPARTMENT_RETURN',
              quantityDelta: qty, // +IN
              referenceTable: 'department_requisition_lines',
              referenceId: line.id,
              actorId,
            },
          });
        }
        // DAMAGED/EXPIRED: intentionally no StockLedger entry — see doc
        // comment above.
      }

      const refreshedLines = await tx.departmentRequisitionLine.findMany({
        where: { departmentRequisitionId: requisition.id },
      });
      const allReturned = refreshedLines.every((l) => l.returnedQuantity.greaterThanOrEqualTo(l.quantity));
      const anyReturned = refreshedLines.some((l) => l.returnedQuantity.greaterThan(0));
      const nextStatus = allReturned ? 'CLOSED' : anyReturned ? 'PARTIALLY_RETURNED' : requisition.status;

      return tx.departmentRequisition.update({
        where: { id: requisition.id },
        data: { status: nextStatus },
        include: { lines: { include: { stockItem: true } }, department: true },
      });
    });
  },

  // ── Supplier Return ─────────────────────────────────────────────────────
  /**
   * Returns purchased stock to a supplier (inventory.md §5.2, §9 step 4).
   * Posts -OUT to StockLedger (negative stock blocked, same guard as
   * `issueToDepartment`), and a `RETURN` SupplierLedger entry that reduces
   * what's owed per §5's balance formula. `refundMethod: 'CASH_REFUND'`
   * additionally credits the acting user's own physical cash — otherwise
   * the money the hospital gets back would be invisible to their Balance
   * Sheet (PROJECT_MASTER_SPEC.md §4.8 Sub-flow C).
   */
  async returnToSupplier(body: CreateSupplierReturnBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: body.supplierId } });
      if (!supplier || !supplier.isActive) {
        throw new NotFoundError('Supplier not found or inactive');
      }

      const purchaseOrder = await tx.purchaseOrder.findUnique({ where: { id: body.purchaseOrderId } });
      if (!purchaseOrder || purchaseOrder.supplierId !== supplier.id) {
        throw new NotFoundError('Purchase order not found for this supplier');
      }

      let totalAmount = new Decimal(0);
      const validatedLines: Array<{ stockItemId: string; quantity: Decimal }> = [];

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
        const qty = new Decimal(line.quantity);
        if (currentStock.lessThan(qty)) {
          throw new ValidationError(
            `Insufficient stock for "${item.name}" (Available: ${currentStock.toString()} ${item.unit}, Returning: ${qty.toString()} ${item.unit}). Cannot drive stock negative.`,
          );
        }

        totalAmount = totalAmount.plus(qty.mul(new Decimal(line.rate)));
        validatedLines.push({ stockItemId: item.id, quantity: qty });
      }

      for (const line of validatedLines) {
        await tx.stockLedger.create({
          data: {
            stockItemId: line.stockItemId,
            movementType: 'SUPPLIER_RETURN',
            quantityDelta: line.quantity.negated(), // -OUT
            referenceTable: 'purchase_orders',
            referenceId: purchaseOrder.id,
            actorId,
          },
        });
      }

      await tx.supplierLedger.create({
        data: {
          supplierId: supplier.id,
          entryType: 'RETURN',
          amount: totalAmount,
          referenceTable: 'purchase_orders',
          referenceId: purchaseOrder.id,
          actorId,
        },
      });

      if (body.refundMethod === 'CASH_REFUND') {
        await tx.userCashBalance.create({
          data: {
            portalUserId: actorId,
            moduleScope: 'INVENTORY',
            direction: 'IN',
            amount: totalAmount,
            category: 'REFUND',
            isPhysicalCash: true,
          },
        });
      }

      return { supplierId: supplier.id, purchaseOrderId: purchaseOrder.id, totalAmount, refundMethod: body.refundMethod };
    });
  },

  // ── Adjustment ───────────────────────────────────────────────────────────
  /**
   * Damage/Expiry/Count Correction/Loss/Surplus/Quarantine (inventory.md
   * §4.2, §9 step 5). Records a `StockAdjustment` row and posts the matching
   * signed `StockLedger` entry (negative stock blocked on DECREASE, same
   * guard used everywhere else in this file).
   */
  async createAdjustment(body: CreateAdjustmentBody, actorId: string) {
    const fixedDirection = FIXED_ADJUSTMENT_DIRECTION[body.type];
    if (fixedDirection && fixedDirection !== body.direction) {
      throw new ValidationError(
        `Adjustment type ${body.type} must be a stock ${fixedDirection === 'INCREASE' ? 'increase' : 'decrease'}.`,
      );
    }

    return prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.findUnique({
        where: { id: body.stockItemId },
        include: { stockLedgerEntries: { select: { quantityDelta: true } } },
      });
      if (!item || !item.isActive) throw new NotFoundError('Stock item not found or inactive');

      const qty = new Decimal(body.quantity);
      if (body.direction === 'DECREASE') {
        const currentStock = item.stockLedgerEntries.reduce(
          (sum, e) => sum.plus(e.quantityDelta),
          new Decimal(0),
        );
        if (currentStock.lessThan(qty)) {
          throw new ValidationError(
            `Insufficient stock for "${item.name}" (Available: ${currentStock.toString()} ${item.unit}, Adjusting: ${qty.toString()} ${item.unit}). Cannot drive stock negative.`,
          );
        }
      }

      const adjustment = await tx.stockAdjustment.create({
        data: {
          stockItemId: item.id,
          batchNo: body.batchNo,
          type: body.type,
          quantity: qty,
          reason: body.reason,
          requiresApproval: body.requiresApproval,
          createdById: actorId,
        },
      });

      await tx.stockLedger.create({
        data: {
          stockItemId: item.id,
          movementType: body.direction === 'INCREASE' ? 'POSITIVE_ADJUSTMENT' : 'NEGATIVE_ADJUSTMENT',
          quantityDelta: body.direction === 'INCREASE' ? qty : qty.negated(),
          batchNo: body.batchNo,
          referenceTable: 'stock_adjustments',
          referenceId: adjustment.id,
          actorId,
        },
      });

      return adjustment;
    });
  },

  /** Adjustment tab history — richer than the plain stock ledger (type + reason). */
  async listAdjustments() {
    return prisma.stockAdjustment.findMany({
      include: {
        stockItem: { select: { id: true, code: true, name: true, unit: true } },
        createdByUser: { select: { id: true, displayName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  },
};
