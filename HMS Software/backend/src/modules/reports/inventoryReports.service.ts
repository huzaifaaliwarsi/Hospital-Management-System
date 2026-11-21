import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { resolveDateRange } from './dashboard.service';
import { cashService } from '@/modules/cash/cash.service';
import { settlementService } from '@/modules/cash/settlement.service';
import { getPositiveBatchBalances } from '@/shared/inventoryBatchBalances';
import type {
  InventorySummaryQuery,
  StockMovementReportQuery,
  PurchaseReportQuery,
  DepartmentIssueReturnReportQuery,
  SupplierReportQuery,
  InventoryExpenseReportQuery,
  StockStatusReportQuery,
  CashSettlementReportQuery,
} from './inventoryReports.schemas';

/**
 * Inventory Reporting Center (inventory.md §7/§8, §9 step 7) — one report
 * per PDF's 8-report list, each reading real posted source tables (no mock
 * rows), same convention as `frontdeskReportsService`.
 */

const userSummarySelect = { id: true, displayName: true, username: true } as const;

/** `preset: 'all'` → no date filter (full history); anything else resolves normally. */
function resolveRangeOrAll(query: { preset: string; fromDate?: string; toDate?: string }) {
  if (query.preset === 'all') return null;
  return resolveDateRange(query as Parameters<typeof resolveDateRange>[0]);
}

const ALL_TIME_PERIOD = { label: 'All Time', start: null as string | null, end: null as string | null };

export const inventoryReportsService = {
  /** Report 1 — Inventory Summary: stock, purchases, issues, returns, low stock, expiry, supplier due. */
  async getInventorySummary(query: InventorySummaryQuery) {
    const range = resolveRangeOrAll(query);
    const nearExpiryThreshold = new Date(Date.now() + query.nearExpiryDays * 24 * 60 * 60 * 1000);

    const [items, purchasesInRange, movementsInRange, supplierLedgerAll, nearExpiryBatches] = await Promise.all([
      prisma.stockItem.findMany({
        where: { isActive: true, ...(query.category ? { category: query.category } : {}) },
        include: {
          stockLedgerEntries: { select: { quantityDelta: true, batchNo: true, expiryDate: true, createdAt: true } },
          purchaseOrderLines: { select: { batchNo: true, rate: true }, orderBy: { id: 'desc' } },
        },
      }),
      prisma.purchaseOrder.findMany({
        where: range ? { createdAt: { gte: range.start, lte: range.end } } : {},
        select: { totalAmount: true },
      }),
      prisma.stockLedger.findMany({
        where: range ? { createdAt: { gte: range.start, lte: range.end } } : {},
        select: { movementType: true },
      }),
      prisma.supplierLedger.findMany({ select: { entryType: true, amount: true } }).catch(() => []),
      getPositiveBatchBalances(nearExpiryThreshold),
    ]);

    let totalStockValue = new Decimal(0);
    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const item of items) {
      const currentStock = item.stockLedgerEntries.reduce((sum, e) => sum.plus(e.quantityDelta), new Decimal(0));
      const defaultRate = item.purchaseOrderLines.length > 0 && item.purchaseOrderLines[0]
        ? new Decimal(item.purchaseOrderLines[0].rate)
        : new Decimal(0);

      // Compute actual batch/lot valuation from positive batch balances and historical lot purchase rates
      const batchMap = new Map<string, { batchNo: string | null; available: Decimal }>();
      for (const entry of item.stockLedgerEntries) {
        const bNo = entry.batchNo?.trim() || null;
        const key = bNo ?? '__UNBATCHED__';
        const existing = batchMap.get(key);
        const delta = new Decimal(entry.quantityDelta);
        if (!existing) {
          batchMap.set(key, { batchNo: bNo, available: delta });
        } else {
          existing.available = existing.available.plus(delta);
        }
      }

      for (const b of batchMap.values()) {
        if (b.available.greaterThan(0)) {
          let batchRate = defaultRate;
          if (b.batchNo) {
            const matched = item.purchaseOrderLines.find(
              (pol) => pol.batchNo?.trim().toLowerCase() === b.batchNo!.trim().toLowerCase(),
            );
            if (matched) {
              batchRate = new Decimal(matched.rate);
            }
          }
          totalStockValue = totalStockValue.plus(b.available.mul(batchRate));
        }
      }

      if (currentStock.lessThanOrEqualTo(0)) outOfStockCount += 1;
      else if (currentStock.lessThanOrEqualTo(item.reorderLevel)) lowStockCount += 1;
    }

    const issuesInRange = movementsInRange.filter((m) => m.movementType === 'DEPARTMENT_ISSUE').length;
    const stockInCount = movementsInRange.filter((m) => m.movementType === 'PURCHASE_RECEIPT').length;
    const returnsInRange = movementsInRange.filter(
      (m) => m.movementType === 'DEPARTMENT_RETURN' || m.movementType === 'SUPPLIER_RETURN',
    ).length;

    const supplierPayable = supplierLedgerAll.reduce(
      (acc, e) => {
        if (e.entryType === 'PURCHASE_CREDIT') return acc.plus(e.amount);
        if ((e.entryType as string) === 'ADJUSTMENT') return acc.plus(e.amount);
        return acc.minus(e.amount);
      },
      new Decimal(0),
    );

    return {
      period: range ? { label: range.label, start: range.start.toISOString(), end: range.end.toISOString() } : ALL_TIME_PERIOD,
      totalItems: items.length,
      // Valued using actual historical lot/batch purchase rates
      totalStockValue,
      lowStockCount,
      outOfStockCount,
      nearExpiryCount: nearExpiryBatches.length,
      purchasesInRangeCount: purchasesInRange.length,
      purchasesInRangeAmount: purchasesInRange.reduce((s, p) => s.plus(p.totalAmount), new Decimal(0)),
      stockInCountInRange: stockInCount,
      issuesInRangeCount: issuesInRange,
      returnsInRangeCount: returnsInRange,
      supplierPayable,
    };
  },

  /** Report 2 — Stock Movement: every StockLedger entry in one ledger. */
  async getStockMovementReport(query: StockMovementReportQuery) {
    const range = resolveRangeOrAll(query);
    const where: Prisma.StockLedgerWhereInput = {
      ...(range ? { createdAt: { gte: range.start, lte: range.end } } : {}),
      ...(query.movementType ? { movementType: query.movementType } : {}),
      ...(query.stockItemId ? { stockItemId: query.stockItemId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.category ? { stockItem: { category: query.category } } : {}),
    };

    const rows = await prisma.stockLedger.findMany({
      where,
      include: { stockItem: { select: { id: true, code: true, name: true, unit: true, category: true } }, actor: { select: userSummarySelect } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    return {
      period: range ? { label: range.label, start: range.start.toISOString(), end: range.end.toISOString() } : ALL_TIME_PERIOD,
      totalMovements: rows.length,
      rows,
    };
  },

  /** Report 3 — Purchase / Stock In: GRN/purchase details, supplier, totals, paid/due accounting for returns and payments. */
  async getPurchaseReport(query: PurchaseReportQuery) {
    const range = resolveRangeOrAll(query);
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(range ? { createdAt: { gte: range.start, lte: range.end } } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
    };

    const rows = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        createdByUser: { select: userSummarySelect },
        lines: {
          select: {
            stockItemId: true,
            quantity: true,
            rate: true,
            batchNo: true,
            expiryDate: true,
            stockItem: { select: { code: true, name: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Fetch linked supplier ledger records (returns, payments against POs)
    const poIds = rows.map((r) => r.id);
    const poLedgerEntries = poIds.length > 0
      ? await prisma.supplierLedger.findMany({
          where: {
            referenceTable: 'purchase_orders',
            referenceId: { in: poIds },
          },
          select: { referenceId: true, entryType: true, amount: true },
        })
      : [];

    const ledgerByPo = new Map<string, { returns: Decimal; payments: Decimal }>();
    for (const e of poLedgerEntries) {
      if (!e.referenceId) continue;
      const cur = ledgerByPo.get(e.referenceId) ?? { returns: new Decimal(0), payments: new Decimal(0) };
      if (e.entryType === 'RETURN' || e.entryType === 'CREDIT_NOTE') {
        cur.returns = cur.returns.plus(e.amount);
      } else if (e.entryType === 'PAYMENT') {
        cur.payments = cur.payments.plus(e.amount);
      }
      ledgerByPo.set(e.referenceId, cur);
    }

    let totalAmount = new Decimal(0);
    let totalPaid = new Decimal(0);
    let totalDue = new Decimal(0);
    let totalReturned = new Decimal(0);

    const enrichedRows = rows.map((r) => {
      const linked = ledgerByPo.get(r.id) ?? { returns: new Decimal(0), payments: new Decimal(0) };
      totalAmount = totalAmount.plus(r.totalAmount);

      const returnedAmount = linked.returns;
      const netPayable = Decimal.max(new Decimal(0), r.totalAmount.minus(returnedAmount));
      let paidAmount = new Decimal(0);
      let dueAmount = new Decimal(0);

      if (r.paymentMethod !== 'CREDIT') {
        // Immediate non-credit purchase (Petty Cash, Management Direct, Online/Bank)
        paidAmount = netPayable;
        dueAmount = new Decimal(0);
      } else {
        // Credit purchase: accounted from actual ledger payments
        paidAmount = Decimal.min(netPayable, linked.payments);
        dueAmount = Decimal.max(new Decimal(0), netPayable.minus(paidAmount));
      }

      totalPaid = totalPaid.plus(paidAmount);
      totalDue = totalDue.plus(dueAmount);
      totalReturned = totalReturned.plus(returnedAmount);

      return {
        ...r,
        paidAmount,
        dueAmount,
        returnedAmount,
      };
    });

    return {
      period: range ? { label: range.label, start: range.start.toISOString(), end: range.end.toISOString() } : ALL_TIME_PERIOD,
      totalPurchases: rows.length,
      totalAmount,
      totalPaid,
      totalDue,
      totalReturned,
      rows: enrichedRows,
    };
  },

  /** Report 4 — Department Issue & Return: issued, returned and net quantity per requisition. */
  async getDepartmentIssueReturnReport(query: DepartmentIssueReturnReportQuery) {
    const range = resolveRangeOrAll(query);
    const where: Prisma.DepartmentRequisitionWhereInput = {
      ...(range ? { issuedAt: { gte: range.start, lte: range.end } } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.issuedById ? { issuedById: query.issuedById } : {}),
    };

    const rows = await prisma.departmentRequisition.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        issuedBy: { select: userSummarySelect },
        lines: { include: { stockItem: { select: { id: true, code: true, name: true, unit: true } } } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 500,
    });

    return {
      period: range ? { label: range.label, start: range.start.toISOString(), end: range.end.toISOString() } : ALL_TIME_PERIOD,
      totalRequisitions: rows.length,
      rows: rows.map((r) => ({
        id: r.id,
        department: r.department.name,
        status: r.status,
        issuedBy: r.issuedBy.displayName || r.issuedBy.username,
        issuedAt: r.issuedAt,
        receivedByName: r.receivedByName,
        lines: r.lines.map((l) => ({
          id: l.id,
          stockItemId: l.stockItemId,
          item: l.stockItem.name,
          unit: l.stockItem.unit,
          issuedQty: l.quantity,
          returnedQty: l.returnedQuantity,
          netQty: l.quantity.minus(l.returnedQuantity),
          batchNo: l.batchNo,
          expiryDate: l.expiryDate,
          costRate: l.costRate,
        })),
      })),
    };
  },

  /** Report 5 — Supplier Report: ledger statement with Opening Balance, Purchases, Payments, Returns, Running Balance & Closing. */
  async getSupplierReport(query: SupplierReportQuery) {
    const range = resolveRangeOrAll(query);
    const supplierFilter = query.supplierId ? { supplierId: query.supplierId } : {};
    const typeFilter = query.transactionType ? { entryType: query.transactionType } : {};

    // 1. Calculate opening balance (all entries strictly before range.start)
    let openingBalance = new Decimal(0);
    if (range) {
      const priorEntries = await prisma.supplierLedger.findMany({
        where: {
          createdAt: { lt: range.start },
          ...supplierFilter,
        },
        select: { entryType: true, amount: true },
      });
      openingBalance = priorEntries.reduce((acc, e) => {
        const amt = new Decimal(e.amount);
        if (e.entryType === 'PURCHASE_CREDIT') return acc.plus(amt);
        if ((e.entryType as string) === 'ADJUSTMENT') return acc.plus(amt);
        return acc.minus(amt);
      }, new Decimal(0));
    }

    // 2. Fetch in-range entries in chronological order to compute running balance
    const where: Prisma.SupplierLedgerWhereInput = {
      ...(range ? { createdAt: { gte: range.start, lte: range.end } } : {}),
      ...supplierFilter,
      ...typeFilter,
    };

    const inRangeEntries = await prisma.supplierLedger.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        actor: { select: userSummarySelect },
      },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });

    let running = new Decimal(openingBalance);
    let totalPurchases = new Decimal(0);
    let totalPayments = new Decimal(0);
    let totalReturns = new Decimal(0);

    const rowsWithBalance = inRangeEntries.map((e) => {
      const amt = new Decimal(e.amount);
      let debit = new Decimal(0);
      let credit = new Decimal(0);

      if (e.entryType === 'PURCHASE_CREDIT') {
        credit = amt;
        totalPurchases = totalPurchases.plus(amt);
        running = running.plus(amt);
      } else if (e.entryType === 'PAYMENT') {
        debit = amt;
        totalPayments = totalPayments.plus(amt);
        running = running.minus(amt);
      } else if (e.entryType === 'RETURN' || e.entryType === 'CREDIT_NOTE') {
        debit = amt;
        totalReturns = totalReturns.plus(amt);
        running = running.minus(amt);
      } else if ((e.entryType as string) === 'ADJUSTMENT') {
        if (amt.greaterThanOrEqualTo(0)) {
          credit = amt;
          totalPurchases = totalPurchases.plus(amt);
          running = running.plus(amt);
        } else {
          debit = amt.abs();
          totalReturns = totalReturns.plus(amt.abs());
          running = running.minus(amt.abs());
        }
      }

      return {
        ...e,
        debit,
        credit,
        runningBalance: running,
      };
    });

    // Return most recent first for display, preserving accurate per-row runningBalance
    const rows = [...rowsWithBalance].reverse();
    const closingPayable = running;
    const netMovement = totalPurchases.minus(totalPayments).minus(totalReturns);

    return {
      period: range ? { label: range.label, start: range.start.toISOString(), end: range.end.toISOString() } : ALL_TIME_PERIOD,
      totalEntries: rows.length,
      openingBalance,
      totalPurchases,
      totalPayments,
      totalReturns,
      netMovement,
      closingPayable,
      rows,
    };
  },

  /** Report 6 — Expense Report: Inventory Expenses by category/method/user. */
  async getInventoryExpenseReport(query: InventoryExpenseReportQuery) {
    const range = resolveRangeOrAll(query);
    const where: Prisma.InventoryExpenseWhereInput = {
      ...(range ? { expenseDate: { gte: range.start, lte: range.end } } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
    };

    const rows = await prisma.inventoryExpense.findMany({
      where,
      include: { createdByUser: { select: userSummarySelect } },
      orderBy: { expenseDate: 'desc' },
      take: 1000,
    });

    return {
      period: range ? { label: range.label, start: range.start.toISOString(), end: range.end.toISOString() } : ALL_TIME_PERIOD,
      totalExpenses: rows.length,
      totalAmount: rows.reduce((s, r) => s.plus(r.amount), new Decimal(0)),
      rows,
    };
  },

  /** Report 7 — Stock Status: current stock, low/out-of-stock, batch/expiry. */
  async getStockStatusReport(query: StockStatusReportQuery) {
    const items = await prisma.stockItem.findMany({
      where: {
        isActive: true,
        ...(query.category ? { category: query.category } : {}),
        ...(query.stockItemId ? { id: query.stockItemId } : {}),
      },
      include: { stockLedgerEntries: { select: { quantityDelta: true } } },
      orderBy: { name: 'asc' },
    });

    const expiryThreshold = query.expiryWindowDays
      ? new Date(Date.now() + query.expiryWindowDays * 24 * 60 * 60 * 1000)
      : undefined;
    const batches = await getPositiveBatchBalances(expiryThreshold);
    const batchesByItem = new Map<string, typeof batches>();
    for (const b of batches) {
      const list = batchesByItem.get(b.stockItemId) ?? [];
      list.push(b);
      batchesByItem.set(b.stockItemId, list);
    }

    const rows = items
      .map((item) => {
        const currentStock = item.stockLedgerEntries.reduce((sum, e) => sum.plus(e.quantityDelta), new Decimal(0));
        const status: 'OUT' | 'LOW' | 'NORMAL' = currentStock.lessThanOrEqualTo(0)
          ? 'OUT'
          : currentStock.lessThanOrEqualTo(item.reorderLevel)
            ? 'LOW'
            : 'NORMAL';
        return {
          id: item.id,
          code: item.code,
          name: item.name,
          category: item.category,
          unit: item.unit,
          currentStock,
          reorderLevel: item.reorderLevel,
          status,
          batches: (batchesByItem.get(item.id) ?? []).map((b) => ({ batchNo: b.batchNo, expiryDate: b.expiryDate, quantity: b.balance })),
        };
      })
      .filter((r) => !query.status || r.status === query.status);

    return { totalItems: rows.length, rows };
  },

  /** Report 8 — Cash & Settlement: the calling Inventory user's own Balance Sheet + Settlement history. */
  async getCashSettlementReport(portalUserId: string, query: CashSettlementReportQuery) {
    // Balance Sheet has no "all time" concept — 'all' falls back to 'shift'
    // (current unsettled custody); Settlement history supports 'all' natively.
    const balanceSheetPreset = query.preset === 'all' ? 'shift' : query.preset;
    const [balanceSheet, settlements] = await Promise.all([
      cashService.getCashierBalanceSheet(portalUserId, { preset: balanceSheetPreset, fromDate: query.fromDate, toDate: query.toDate }),
      settlementService.listMySettlements(portalUserId, {
        preset: query.preset,
        fromDate: query.fromDate,
        toDate: query.toDate,
        status: query.status,
      }),
    ]);

    return { balanceSheet, settlements };
  },
};
