import { incomeExpenseReport } from './incomeExpense';
import { operatingProfitReport } from './operatingProfit';
import { financialReport, loadFinancialData } from './financialRecognition';
import { prisma } from '@/db/client';
import type { Prisma } from '@prisma/client';
import { ValidationError } from '@/shared/errors/AppError';
import type { ReportQuery } from './reports.schemas';

const DEFAULT_ROW_LIMIT = 2000;

/** Inclusive `to` — a date-only `to` from the query should still capture that whole day. */
function endOfDayIfDateOnly(to?: Date) {
  if (!to) return undefined;
  if (to.getUTCHours() === 0 && to.getUTCMinutes() === 0 && to.getUTCSeconds() === 0) {
    return new Date(to.getTime() + 86_400_000 - 1);
  }
  return to;
}

function dateRange(query: ReportQuery) {
  const to = endOfDayIfDateOnly(query.to);
  if (query.from && to) return { gte: query.from, lte: to };
  if (query.from) return { gte: query.from };
  if (to) return { lte: to };
  return undefined;
}

/** pharmacy.md §14 — every row carries the real actor (Sold/Dispensed/Entered/Paid/Approved By), never just "Pharmacy". */
export const reportsService = {
  async run(query: ReportQuery) {
    const range = dateRange(query);
    const limit = query.limit ?? DEFAULT_ROW_LIMIT;
    switch (query.type) {
      case 'INCOME_EXPENSE':
        return incomeExpenseReport(prisma, range);
      case 'OPERATING_PROFIT':
        return operatingProfitReport(prisma, range);
      case 'SALES_COLLECTION':
        return financialReport(await loadFinancialData(prisma, range), range, query);
      case 'HMS_DISPENSE':
        return hmsDispense(range, limit);
      case 'PURCHASE':
        return purchase(range, limit);
      case 'STOCK_MOVEMENT':
        return stockMovement(range, limit);
      case 'VENDOR_LEDGER':
        return vendorLedger(range, limit);
      case 'EXPENSE':
        return expense(range, limit);
      case 'RETURN_REFUND':
        return returnRefund(range, limit);
      case 'BALANCE_SETTLEMENT':
        return balanceSettlement(range, limit);
      default:
        throw new ValidationError(`Unknown report type`);
    }
  },
};

async function hmsDispense(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const [requests, totalCount] = await Promise.all([
    prisma.medicineRequest.findMany({
      where: { requestedAt: range },
      include: {
        lines: { include: { medicine: { select: { name: true, code: true } } } },
        invoice: { select: { invoiceNumber: true, total: true, paidTotal: true, outstanding: true, clearanceStatus: true } },
        handledByUser: { select: { fullName: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    }),
    prisma.medicineRequest.count({ where: { requestedAt: range } }),
  ]);
  const rows = requests.map((r) => ({
    requestNumber: r.requestNumber,
    admissionRef: r.externalAdmissionRef,
    patientName: r.patientNameSnapshot,
    medicines: r.lines.map((l) => `${l.medicine.name} (req ${l.requestedQuantity}, disp ${l.dispensedQuantity})`).join('; '),
    status: r.status,
    requestedByExternal: r.requestedByExternal,
    dispensedBy: r.handledByUser?.fullName ?? null,
    invoiceNumber: r.invoice?.invoiceNumber ?? null,
    invoiceTotal: r.invoice?.total ?? null,
    outstanding: r.invoice?.outstanding ?? null,
    clearanceStatus: r.invoice?.clearanceStatus ?? null,
    requestedAt: r.requestedAt,
  }));
  return { rows, totals: null, totalCount, limit };
}

async function purchase(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const purchaseWhere: Prisma.PurchaseWhereInput = {
    status: 'POSTED',
    ...(range?.gte || range?.lte ? { purchaseDate: range } : {}),
  };

  const returnWhere: Prisma.VendorLedgerEntryWhereInput = {
    entryType: 'RETURN_CREDIT',
    ...(range?.gte || range?.lte ? { createdAt: range } : {}),
  };

  const [purchases, aggregates, vendorReturns] = await Promise.all([
    prisma.purchase.findMany({
      where: purchaseWhere,
      include: {
        vendor: { select: { name: true, code: true } },
        createdByUser: { select: { fullName: true } },
      },
      orderBy: { purchaseDate: 'desc' },
      take: limit,
    }),
    prisma.purchase.aggregate({
      where: purchaseWhere,
      _sum: {
        subtotal: true,
        discountTotal: true,
        taxTotal: true,
        freightTotal: true,
        total: true,
        paidNow: true,
        vendorDue: true,
      },
      _count: true,
    }),
    prisma.vendorLedgerEntry.aggregate({
      where: returnWhere,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const grossPurchases = aggregates._sum.subtotal ? Number(aggregates._sum.subtotal) : 0;
  const discountTotal = aggregates._sum.discountTotal ? Number(aggregates._sum.discountTotal) : 0;
  const postedAcquisitionCost = aggregates._sum.total ? Number(aggregates._sum.total) : 0;
  const returnCost = vendorReturns._sum.amount ? Math.abs(Number(vendorReturns._sum.amount)) : 0;
  const netPurchases = Math.max(0, postedAcquisitionCost - returnCost);
  const paidNow = aggregates._sum.paidNow ? Number(aggregates._sum.paidNow) : 0;
  const vendorDue = aggregates._sum.vendorDue ? Number(aggregates._sum.vendorDue) : 0;

  const rows = purchases.map((p) => ({
    purchaseNumber: p.purchaseNumber,
    vendor: p.vendor.name,
    purchaseDate: p.purchaseDate,
    vendorInvoiceNo: p.vendorInvoiceNo,
    paymentType: p.paymentType,
    subtotal: p.subtotal,
    discountTotal: p.discountTotal,
    total: p.total,
    paidNow: p.paidNow,
    vendorDue: p.vendorDue,
    status: p.status,
    receivedBy: p.createdByUser.fullName,
    enteredBy: p.createdByUser.fullName,
    createdAt: p.createdAt,
  }));

  const totals = {
    grossPurchases,
    discountTotal,
    postedPurchases: postedAcquisitionCost,
    purchaseReturns: returnCost,
    netPurchases,
    total: netPurchases,
    paidNow,
    vendorDue,
  };

  return { rows, totals, totalCount: aggregates._count, limit };
}

async function stockMovement(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const movementWhere: Prisma.StockLedgerEntryWhereInput = {
    ...(range?.gte || range?.lte ? { createdAt: range } : {}),
  };

  const [entries, totalCount] = await Promise.all([
    prisma.stockLedgerEntry.findMany({
      where: movementWhere,
      include: {
        medicine: { select: { name: true, code: true, purchaseRate: true } },
        batch: { select: { batchNumber: true, costRate: true, expiryDate: true } },
        actor: { select: { fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.stockLedgerEntry.count({ where: movementWhere }),
  ]);

  let totalInQuantity = 0;
  let totalOutQuantity = 0;
  let netQuantityDelta = 0;
  let totalInValuation = 0;
  let totalOutValuation = 0;
  let netValuation = 0;

  const rows = entries.map((e) => {
    const qty = Number(e.quantityDelta);
    const cost = e.batch?.costRate != null ? Number(e.batch.costRate) : (e.medicine?.purchaseRate != null ? Number(e.medicine.purchaseRate) : null);
    const valuation = cost != null ? Math.abs(qty) * cost : null;

    if (qty >= 0) {
      totalInQuantity += qty;
      if (valuation != null) totalInValuation += valuation;
    } else {
      totalOutQuantity += Math.abs(qty);
      if (valuation != null) totalOutValuation += valuation;
    }
    netQuantityDelta += qty;
    if (valuation != null) {
      netValuation += (qty >= 0 ? valuation : -valuation);
    }

    const ref = e.referenceTable && e.referenceId
      ? `${e.referenceTable}: ${e.referenceId}`
      : e.referenceId ?? e.note ?? '—';

    return {
      itemCode: e.medicine.code,
      medicine: e.medicine.name,
      batch: e.batch?.batchNumber ?? '—',
      batchNumber: e.batch?.batchNumber ?? '—',
      expiryDate: e.batch?.expiryDate ?? null,
      movementType: e.movementType,
      quantityDelta: e.quantityDelta,
      unitCost: cost,
      lineValuation: valuation,
      reference: ref,
      referenceId: e.referenceId,
      note: e.note,
      actor: e.actor.fullName,
      performedBy: e.actor.fullName,
      createdAt: e.createdAt,
    };
  });

  const totals = {
    quantityDelta: netQuantityDelta,
    lineValuation: netValuation,
    totalInQuantity,
    totalOutQuantity,
    netQuantityDelta,
    totalInValuation,
    totalOutValuation,
    netValuation,
  };

  return { rows, totals, totalCount, limit };
}

async function vendorLedger(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const ledgerWhere: Prisma.VendorLedgerEntryWhereInput = {
    ...(range?.gte || range?.lte ? { createdAt: range } : {}),
  };

  const [entries, aggregates, openingAgg] = await Promise.all([
    prisma.vendorLedgerEntry.findMany({
      where: ledgerWhere,
      include: {
        vendor: { select: { id: true, name: true, code: true } },
        actor: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.vendorLedgerEntry.aggregate({
      where: ledgerWhere,
      _sum: { amount: true },
      _count: true,
    }),
    range?.gte
      ? prisma.vendorLedgerEntry.aggregate({
          where: { createdAt: { lt: range.gte } },
          _sum: { amount: true },
        })
      : Promise.resolve(null),
  ]);

  // Per-vendor opening balances prior to range.gte
  const vendorIds = [...new Set(entries.map((e) => e.vendorId))];
  const vendorOpenings = range?.gte && vendorIds.length > 0
    ? await prisma.vendorLedgerEntry.groupBy({
        by: ['vendorId'],
        where: { vendorId: { in: vendorIds }, createdAt: { lt: range.gte } },
        _sum: { amount: true },
      })
    : [];

  const vendorOpeningMap = new Map<string, number>();
  for (const vo of vendorOpenings) {
    vendorOpeningMap.set(vo.vendorId, vo._sum.amount ? Number(vo._sum.amount) : 0);
  }

  // To compute running balance accurately, process in chronological order (asc)
  const chronological = [...entries].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
  );

  const vendorRunning = new Map<string, number>(vendorOpeningMap);
  const rowRunningMap = new Map<string, number>();

  let creditPurchases = 0;
  let supplierPayments = 0;
  let purchaseReturnCredits = 0;
  let adjustments = 0;

  for (const e of chronological) {
    const amt = Number(e.amount);
    const prev = vendorRunning.get(e.vendorId) ?? 0;
    const curr = prev + amt;
    vendorRunning.set(e.vendorId, curr);
    rowRunningMap.set(e.id, curr);

    if (e.entryType === 'PURCHASE_CREDIT') creditPurchases += amt;
    else if (e.entryType === 'PAYMENT') supplierPayments += Math.abs(amt);
    else if (e.entryType === 'RETURN_CREDIT') purchaseReturnCredits += Math.abs(amt);
    else if (e.entryType === 'ADJUSTMENT') adjustments += amt;
  }

  const openingBalance = openingAgg?._sum.amount ? Number(openingAgg._sum.amount) : 0;
  const netMovement = aggregates._sum.amount ? Number(aggregates._sum.amount) : 0;
  const closingBalance = openingBalance + netMovement;

  const rows = entries.map((e) => ({
    vendor: e.vendor.name,
    vendorCode: e.vendor.code,
    entryType: e.entryType,
    amount: e.amount,
    runningBalance: rowRunningMap.get(e.id) ?? Number(e.amount),
    referenceId: e.referenceNo ?? e.referenceId ?? '—',
    referenceNo: e.referenceNo ?? '—',
    description: e.description,
    enteredBy: e.actor.fullName,
    actor: e.actor.fullName,
    occurredAt: e.createdAt,
    createdAt: e.createdAt,
  }));

  const totals = {
    openingBalance,
    creditPurchases,
    supplierPayments,
    purchaseReturnCredits,
    adjustments,
    netMovement,
    closingBalance,
    vendorPayables: Math.max(0, closingBalance),
    supplierAdvances: Math.max(0, -closingBalance),
    amount: netMovement,
  };

  return { rows, totals, totalCount: aggregates._count, limit };
}

async function expense(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const expenseWhere: Prisma.ExpenseWhereInput = {
    ...(range?.gte || range?.lte ? { date: range } : {}),
  };

  const [expenses, aggregates] = await Promise.all([
    prisma.expense.findMany({
      where: expenseWhere,
      include: { enteredByUser: { select: { fullName: true } }, approvedByUser: { select: { fullName: true } } },
      orderBy: { date: 'desc' },
      take: limit,
    }),
    prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const categoryTotals: Record<string, number> = {};
  for (const e of expenses) {
    const cat = e.category || 'Uncategorized';
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + Number(e.amount);
  }

  const rows = expenses.map((e) => ({
    category: e.category,
    date: e.date,
    amount: e.amount,
    paymentMethod: e.paymentMethod,
    payeeOrVendor: e.payeeOrVendor,
    description: e.description,
    enteredBy: e.enteredByUser.fullName,
    approvedBy: e.approvedByUser?.fullName ?? null,
  }));

  const totalAmount = aggregates._sum.amount ? Number(aggregates._sum.amount) : 0;
  const totals = {
    amount: totalAmount,
    operatingExpenses: totalAmount,
    totalExpense: totalAmount,
    categoryTotals,
  };
  return { rows, totals, totalCount: aggregates._count, limit };
}

async function returnRefund(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const refundWhere: Prisma.CashLedgerEntryWhereInput = {
    category: 'REFUND',
    ...(range?.gte || range?.lte ? { occurredAt: range } : {}),
  };

  const vendorReturnWhere: Prisma.VendorLedgerEntryWhereInput = {
    entryType: 'RETURN_CREDIT',
    ...(range?.gte || range?.lte ? { createdAt: range } : {}),
  };

  const [refunds, refundAggregates, vendorReturns, vendorAggregates] = await Promise.all([
    prisma.cashLedgerEntry.findMany({
      where: refundWhere,
      include: { portalUser: { select: { fullName: true } } },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    }),
    prisma.cashLedgerEntry.aggregate({
      where: refundWhere,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.vendorLedgerEntry.findMany({
      where: vendorReturnWhere,
      include: { vendor: { select: { name: true } }, actor: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.vendorLedgerEntry.aggregate({
      where: vendorReturnWhere,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const invoiceIds = refunds
    .filter((r) => r.referenceTable === 'pharmacy_invoices' && r.referenceId)
    .map((r) => r.referenceId as string);

  const invoices = invoiceIds.length > 0
    ? await prisma.pharmacyInvoice.findMany({
        where: { id: { in: invoiceIds } },
        select: { id: true, invoiceNumber: true, customerName: true },
      })
    : [];
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]));

  const salesReturnRows = refunds.map((r) => {
    const inv = r.referenceId ? invoiceMap.get(r.referenceId) : null;
    return {
      type: 'Sales Return',
      returnNumber: r.referenceNo ?? '—',
      returnReferenceNo: r.referenceNo ?? '—',
      originalRef: inv?.invoiceNumber ?? '—',
      invoiceNumber: inv?.invoiceNumber ?? '—',
      party: inv?.customerName ?? 'Walk-In Customer',
      customerName: inv?.customerName ?? 'Walk-In Customer',
      refundAmount: r.amount,
      amount: r.amount,
      isPhysicalCash: r.isPhysicalCash,
      paymentMethod: r.isPhysicalCash ? 'CASH' : 'NON_CASH',
      reason: r.note ? r.note.replace(/^RET-\d+:\s*/, '') : 'Sales Return Refund',
      processedBy: r.portalUser?.fullName ?? 'Pharmacy Staff',
      createdAt: r.occurredAt,
      occurredAt: r.occurredAt,
    };
  });

  const purchaseReturnRows = vendorReturns.map((vr) => ({
    type: 'Purchase Return',
    returnNumber: vr.referenceNo ?? '—',
    returnReferenceNo: vr.referenceNo ?? '—',
    originalRef: vr.referenceTable === 'purchases' && vr.referenceId ? vr.referenceId : '—',
    invoiceNumber: '—',
    party: vr.vendor?.name ?? 'Vendor',
    customerName: vr.vendor?.name ?? 'Vendor',
    refundAmount: vr.amount.abs(), // Positive return value!
    amount: vr.amount.abs(),
    isPhysicalCash: false,
    paymentMethod: 'VENDOR_CREDIT',
    reason: vr.description ?? 'Purchase Return Credit',
    processedBy: vr.actor?.fullName ?? 'Pharmacy Staff',
    createdAt: vr.createdAt,
    occurredAt: vr.createdAt,
  }));

  const allRows = [...salesReturnRows, ...purchaseReturnRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const customerRefunds = refundAggregates._sum.amount ? Number(refundAggregates._sum.amount) : 0;
  const vendorCredits = vendorAggregates._sum.amount ? Math.abs(Number(vendorAggregates._sum.amount)) : 0;
  const combinedTotal = customerRefunds + vendorCredits;

  const totals = {
    customerRefunds,
    vendorCredits,
    customerRefundCount: refundAggregates._count,
    vendorCreditCount: vendorAggregates._count,
    totalReturns: combinedTotal,
    refundAmount: combinedTotal,
    amount: combinedTotal,
  };

  const totalCount = refundAggregates._count + vendorAggregates._count;
  return { rows: allRows.slice(0, limit), totals, totalCount, limit };
}

async function balanceSettlement(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const settlementWhere: Prisma.AccountSettlementWhereInput = {
    ...(range?.gte || range?.lte ? { submittedAt: range } : {}),
  };

  const [settlements, aggregates] = await Promise.all([
    prisma.accountSettlement.findMany({
      where: settlementWhere,
      include: {
        submittedByUser: { select: { id: true, fullName: true, username: true } },
        reviewedByUser: { select: { id: true, fullName: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: limit,
    }),
    prisma.accountSettlement.aggregate({
      where: settlementWhere,
      _sum: { expectedCash: true, physicalCash: true, variance: true, settlementAmount: true },
      _count: true,
    }),
  ]);

  let acceptedCount = 0;
  let submittedCount = 0;
  let rejectedCount = 0;
  let totalAcceptedSettled = 0;

  for (const s of settlements) {
    if (s.status === 'ACCEPTED') {
      acceptedCount++;
      totalAcceptedSettled += Number(s.settlementAmount || s.physicalCash);
    } else if (s.status === 'SUBMITTED') {
      submittedCount++;
    } else if (s.status === 'REJECTED') {
      rejectedCount++;
    }
  }

  const rows = settlements.map((s) => ({
    submittedBy: s.submittedByUser.fullName,
    cashier: s.submittedByUser.fullName,
    periodFrom: s.periodFrom,
    periodTo: s.periodTo,
    expectedCash: s.expectedCash,
    physicalCash: s.physicalCash,
    variance: s.variance,
    varianceReason: s.varianceReason ?? (s.variance.isZero() ? 'Exact match' : '—'),
    settlementAmount: s.settlementAmount,
    status: s.status,
    reviewedBy: s.reviewedByUser?.fullName ?? 'Pending Review',
    submittedAt: s.submittedAt,
    reviewedAt: s.reviewedAt,
  }));

  const expectedCashTotal = aggregates._sum.expectedCash ? Number(aggregates._sum.expectedCash) : 0;
  const physicalCashTotal = aggregates._sum.physicalCash ? Number(aggregates._sum.physicalCash) : 0;
  const varianceTotal = aggregates._sum.variance ? Number(aggregates._sum.variance) : 0;

  const totals = {
    expectedCash: expectedCashTotal,
    physicalCash: physicalCashTotal,
    variance: varianceTotal,
    settlementAmount: totalAcceptedSettled,
    acceptedCount,
    submittedCount,
    rejectedCount,
    totalCount: aggregates._count,
  };

  return { rows, totals, totalCount: aggregates._count, limit };
}
