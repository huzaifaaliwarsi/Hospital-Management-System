import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { cashService } from '../cash/cash.service';

const NEAR_EXPIRY_DAYS = 90;

function startOfDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** pharmacy.md §5 — every KPI here is a real Prisma query. No hardcoded numbers. */
export const dashboardService = {
  async getManagementSummary(userId: string) {
    const today = startOfDay();
    const tomorrow = new Date(today.getTime() + 86_400_000);

    const [salesToday, purchasesToday, medicines, vendorLedger, pendingSettlements, pendingHmsRequests, expected] = await Promise.all([
      prisma.pharmacyInvoice.aggregate({ where: { createdAt: { gte: today, lt: tomorrow } }, _sum: { total: true }, _count: true }),
      prisma.purchase.aggregate({ where: { createdAt: { gte: today, lt: tomorrow } }, _sum: { total: true }, _count: true }),
      prisma.medicineMaster.findMany({ where: { isActive: true }, include: { batches: true, stockEntries: { select: { quantityDelta: true } } } }),
      prisma.vendorLedgerEntry.aggregate({ _sum: { amount: true } }),
      prisma.accountSettlement.count({ where: { status: 'SUBMITTED' } }),
      prisma.medicineRequest.count({ where: { status: { in: ['REQUESTED', 'PARTIALLY_ACCEPTED'] } } }),
      cashService.expectedCash(userId),
    ]);

    const now = new Date();
    const nearExpiryCutoff = new Date(now.getTime() + NEAR_EXPIRY_DAYS * 86_400_000);
    let stockValue = new Decimal(0);
    let lowStock = 0;
    let outOfStock = 0;
    let nearExpiry = 0;
    let expired = 0;
    for (const m of medicines) {
      const stock = m.stockEntries.reduce((s, e) => s.plus(e.quantityDelta), new Decimal(0));
      stockValue = stockValue.plus(stock.mul(m.purchaseRate ?? m.saleRate));
      if (stock.lessThanOrEqualTo(0)) outOfStock += 1;
      else if (stock.lessThanOrEqualTo(m.reorderLevel)) lowStock += 1;
      if (m.batches.some((b) => b.expiryDate <= now)) expired += 1;
      else if (m.batches.some((b) => b.expiryDate <= nearExpiryCutoff)) nearExpiry += 1;
    }

    return {
      salesToday: salesToday._sum.total ?? new Decimal(0),
      salesCountToday: salesToday._count,
      purchasesToday: purchasesToday._sum.total ?? new Decimal(0),
      purchasesCountToday: purchasesToday._count,
      currentStockValue: stockValue,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
      nearExpiryCount: nearExpiry,
      expiredCount: expired,
      vendorPayable: vendorLedger._sum.amount ?? new Decimal(0),
      pendingSettlements,
      pendingHmsRequests,
      expectedCash: expected,
    };
  },

  async getSalesSummary(userId: string) {
    const today = startOfDay();
    const tomorrow = new Date(today.getTime() + 86_400_000);

    const [mySales, pendingHmsRequests, expected] = await Promise.all([
      prisma.pharmacyInvoice.aggregate({ where: { dispensedById: userId, createdAt: { gte: today, lt: tomorrow } }, _sum: { total: true, paidTotal: true }, _count: true }),
      prisma.medicineRequest.count({ where: { status: { in: ['REQUESTED', 'PARTIALLY_ACCEPTED'] } } }),
      cashService.expectedCash(userId),
    ]);

    const payments = await prisma.pharmacyPayment.findMany({ where: { collectedById: userId, paidAt: { gte: today, lt: tomorrow } } });
    const cash = payments.filter((p) => p.method === 'CASH').reduce((s, p) => s.plus(p.amount), new Decimal(0));
    const nonCash = payments.filter((p) => p.method !== 'CASH').reduce((s, p) => s.plus(p.amount), new Decimal(0));

    return {
      mySalesToday: mySales._sum.total ?? new Decimal(0),
      mySalesCountToday: mySales._count,
      cashCollectionToday: cash,
      cardOnlineCollectionToday: nonCash,
      pendingHmsRequests,
      expectedCash: expected,
    };
  },
};
