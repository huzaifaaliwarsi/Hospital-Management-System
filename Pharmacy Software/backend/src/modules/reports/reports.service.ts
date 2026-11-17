import { incomeExpenseReport } from './incomeExpense';
import { operatingProfitReport } from './operatingProfit';
import { financialReport, loadFinancialData } from './financialRecognition';
import { prisma } from '@/db/client';
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
  const [purchases, aggregates] = await Promise.all([
    prisma.purchase.findMany({
      where: { purchaseDate: range },
      include: { vendor: { select: { name: true, code: true } }, createdByUser: { select: { fullName: true } } },
      orderBy: { purchaseDate: 'desc' },
      take: limit,
    }),
    prisma.purchase.aggregate({
      where: { purchaseDate: range },
      _sum: { total: true, paidNow: true, vendorDue: true },
      _count: true,
    }),
  ]);
  const rows = purchases.map((p) => ({
    purchaseNumber: p.purchaseNumber,
    vendor: p.vendor.name,
    purchaseDate: p.purchaseDate,
    vendorInvoiceNo: p.vendorInvoiceNo,
    paymentType: p.paymentType,
    total: p.total,
    paidNow: p.paidNow,
    vendorDue: p.vendorDue,
    status: p.status,
    receivedBy: p.createdByUser.fullName,
  }));
  const totals = {
    total: aggregates._sum.total ? Number(aggregates._sum.total) : 0,
    paidNow: aggregates._sum.paidNow ? Number(aggregates._sum.paidNow) : 0,
    vendorDue: aggregates._sum.vendorDue ? Number(aggregates._sum.vendorDue) : 0,
  };
  return { rows, totals, totalCount: aggregates._count, limit };
}

async function stockMovement(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const [entries, totalCount] = await Promise.all([
    prisma.stockLedgerEntry.findMany({
      where: { createdAt: range },
      include: { medicine: { select: { name: true, code: true } }, batch: { select: { batchNumber: true } }, actor: { select: { fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.stockLedgerEntry.count({ where: { createdAt: range } }),
  ]);
  const rows = entries.map((e) => ({
    itemCode: e.medicine.code,
    medicine: e.medicine.name,
    batch: e.batch?.batchNumber ?? null,
    movementType: e.movementType,
    quantityDelta: e.quantityDelta,
    note: e.note,
    performedBy: e.actor.fullName,
    createdAt: e.createdAt,
  }));
  return { rows, totals: null, totalCount, limit };
}

async function vendorLedger(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const [entries, aggregates] = await Promise.all([
    prisma.vendorLedgerEntry.findMany({
      where: { createdAt: range },
      include: { vendor: { select: { name: true, code: true } }, actor: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.vendorLedgerEntry.aggregate({
      where: { createdAt: range },
      _sum: { amount: true },
      _count: true,
    }),
  ]);
  const rows = entries.map((e) => ({
    vendor: e.vendor.name,
    entryType: e.entryType,
    amount: e.amount,
    description: e.description,
    actor: e.actor.fullName,
    createdAt: e.createdAt,
  }));
  const totals = { amount: aggregates._sum.amount ? Number(aggregates._sum.amount) : 0 };
  return { rows, totals, totalCount: aggregates._count, limit };
}

async function expense(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const [expenses, aggregates] = await Promise.all([
    prisma.expense.findMany({
      where: { date: range },
      include: { enteredByUser: { select: { fullName: true } }, approvedByUser: { select: { fullName: true } } },
      orderBy: { date: 'desc' },
      take: limit,
    }),
    prisma.expense.aggregate({
      where: { date: range },
      _sum: { amount: true },
      _count: true,
    }),
  ]);
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
  const totals = { amount: aggregates._sum.amount ? Number(aggregates._sum.amount) : 0 };
  return { rows, totals, totalCount: aggregates._count, limit };
}

async function returnRefund(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const [refunds, refundAggregates, vendorReturns, vendorAggregates] = await Promise.all([
    prisma.cashLedgerEntry.findMany({
      where: { category: 'REFUND', occurredAt: range },
      include: { portalUser: { select: { fullName: true } } },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    }),
    prisma.cashLedgerEntry.aggregate({
      where: { category: 'REFUND', occurredAt: range },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.vendorLedgerEntry.findMany({
      where: { entryType: 'RETURN_CREDIT', createdAt: range },
      include: { vendor: { select: { name: true } }, actor: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.vendorLedgerEntry.aggregate({
      where: { entryType: 'RETURN_CREDIT', createdAt: range },
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
    refundAmount: vr.amount,
    amount: vr.amount,
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

  const totalCount = refundAggregates._count + vendorAggregates._count;
  const totalAmount =
    (refundAggregates._sum.amount ? Number(refundAggregates._sum.amount) : 0) +
    (vendorAggregates._sum.amount ? Number(vendorAggregates._sum.amount) : 0);

  const totals = {
    refundAmount: totalAmount,
    amount: totalAmount,
  };

  return { rows: allRows.slice(0, limit), totals, totalCount, limit };
}

async function balanceSettlement(range?: { gte?: Date; lte?: Date }, limit = DEFAULT_ROW_LIMIT) {
  const [settlements, totalCount] = await Promise.all([
    prisma.accountSettlement.findMany({
      where: { submittedAt: range },
      include: { submittedByUser: { select: { fullName: true } }, reviewedByUser: { select: { fullName: true } } },
      orderBy: { submittedAt: 'desc' },
      take: limit,
    }),
    prisma.accountSettlement.count({ where: { submittedAt: range } }),
  ]);
  const rows = settlements.map((s) => ({
    submittedBy: s.submittedByUser.fullName,
    periodFrom: s.periodFrom,
    periodTo: s.periodTo,
    expectedCash: s.expectedCash,
    physicalCash: s.physicalCash,
    variance: s.variance,
    settlementAmount: s.settlementAmount,
    status: s.status,
    reviewedBy: s.reviewedByUser?.fullName ?? null,
    submittedAt: s.submittedAt,
  }));
  return { rows, totals: null, totalCount, limit };
}
