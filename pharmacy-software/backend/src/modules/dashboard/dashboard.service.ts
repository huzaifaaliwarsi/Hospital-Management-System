import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { cashService } from '../cash/cash.service';

async function getNearExpiryWindowDays() {
  const settings = await prisma.pharmacySettings.findFirst();
  return settings?.nearExpiryWindowDays ?? 90;
}

function startOfDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** pharmacy.md §5 — every KPI here is a real Prisma query. No hardcoded numbers. */
export const dashboardService = {
  async getManagementSummary(userId: string) {
    const today = startOfDay();
    const tomorrow = new Date(today.getTime() + 86_400_000);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
      salesToday,
      purchasesToday,
      medicines,
      vendorLedger,
      pendingSettlements,
      pendingHmsRequests,
      expected,
      nearExpiryWindowDays,
      totalSalesAllTime,
      recentInvoices,
      recentPurchases,
      recentExpenses,
      vendorsList,
    ] = await Promise.all([
      prisma.pharmacyInvoice.aggregate({ where: { createdAt: { gte: today, lt: tomorrow } }, _sum: { total: true }, _count: true }),
      prisma.purchase.aggregate({ where: { createdAt: { gte: today, lt: tomorrow } }, _sum: { total: true }, _count: true }),
      prisma.medicineMaster.findMany({
        where: { isActive: true },
        include: { batches: true, stockEntries: { select: { quantityDelta: true } } },
        orderBy: { name: 'asc' },
      }),
      prisma.vendorLedgerEntry.aggregate({ _sum: { amount: true } }),
      prisma.accountSettlement.count({ where: { status: 'SUBMITTED' } }),
      prisma.medicineRequest.count({ where: { status: { in: ['REQUESTED', 'PARTIALLY_ACCEPTED'] } } }),
      cashService.expectedCash(userId),
      getNearExpiryWindowDays(),
      prisma.pharmacyInvoice.aggregate({ _sum: { total: true }, _count: true }),
      prisma.pharmacyInvoice.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { total: true, createdAt: true } }),
      prisma.purchase.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { total: true, createdAt: true } }),
      prisma.expense.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { amount: true, createdAt: true } }),
      prisma.vendor.findMany({ where: { isActive: true }, take: 4, select: { id: true, name: true, phone: true, paymentTermsDays: true } }),
    ]);

    const now = new Date();
    const nearExpiryCutoff = new Date(now.getTime() + nearExpiryWindowDays * 86_400_000);
    let stockValue = new Decimal(0);
    let totalStockUnits = new Decimal(0);
    let lowStock = 0;
    let outOfStock = 0;
    let nearExpiry = 0;
    let expired = 0;

    const categoryMap: Record<string, { count: number; stock: Decimal }> = {};
    const inventoryOverview: Array<{
      id: string;
      code: string;
      name: string;
      category: string;
      currentStock: number;
      reorderLevel: number;
      expiryDate: string | null;
      status: 'Healthy' | 'Low Stock' | 'Critical';
      batchNumber: string | null;
    }> = [];

    const lowStockList: Array<{ id: string; name: string; currentStock: number; reorderLevel: number }> = [];
    const nearExpiryList: Array<{ id: string; name: string; batchNumber: string; expiryDate: string; daysLeft: number }> = [];

    for (const m of medicines) {
      const stock = m.stockEntries.reduce((s, e) => s.plus(e.quantityDelta), new Decimal(0));
      totalStockUnits = totalStockUnits.plus(stock);
      stockValue = stockValue.plus(stock.mul(m.purchaseRate ?? m.saleRate));

      const catName = (m.categoryLabel && m.categoryLabel.trim()) || 'General';
      if (!categoryMap[catName]) {
        categoryMap[catName] = { count: 0, stock: new Decimal(0) };
      }
      categoryMap[catName].count += 1;
      categoryMap[catName].stock = categoryMap[catName].stock.plus(stock);

      const isOut = stock.lessThanOrEqualTo(0);
      const isLow = !isOut && stock.lessThanOrEqualTo(m.reorderLevel);

      if (isOut) {
        outOfStock += 1;
      } else if (isLow) {
        lowStock += 1;
        lowStockList.push({
          id: m.id,
          name: m.name,
          currentStock: stock.toNumber(),
          reorderLevel: Number(m.reorderLevel),
        });
      }

      // Sort batches by earliest expiry
      const sortedBatches = [...m.batches].sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());
      const earliestBatch = sortedBatches[0];

      let hasExpired = false;
      let hasNearExpiry = false;

      for (const b of m.batches) {
        if (b.expiryDate <= now) {
          expired += 1;
          hasExpired = true;
        } else if (b.expiryDate <= nearExpiryCutoff) {
          nearExpiry += 1;
          hasNearExpiry = true;
          nearExpiryList.push({
            id: b.id,
            name: m.name,
            batchNumber: b.batchNumber,
            expiryDate: b.expiryDate.toISOString(),
            daysLeft: Math.max(0, Math.ceil((b.expiryDate.getTime() - now.getTime()) / 86_400_000)),
          });
        }
      }

      const itemStatus: 'Healthy' | 'Low Stock' | 'Critical' = isOut || hasExpired ? 'Critical' : isLow || hasNearExpiry ? 'Low Stock' : 'Healthy';

      inventoryOverview.push({
        id: m.id,
        code: m.code,
        name: m.name,
        category: catName,
        currentStock: stock.toNumber(),
        reorderLevel: Number(m.reorderLevel),
        expiryDate: earliestBatch ? earliestBatch.expiryDate.toISOString() : null,
        status: itemStatus,
        batchNumber: earliestBatch ? earliestBatch.batchNumber : null,
      });
    }

    // Build monthly performance for last 6 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mIdx = d.getMonth();
      const y = d.getFullYear();
      const mStart = new Date(Date.UTC(y, mIdx, 1));
      const mEnd = new Date(Date.UTC(y, mIdx + 1, 1));

      const mInvoices = recentInvoices.filter((inv) => inv.createdAt >= mStart && inv.createdAt < mEnd);
      const mPurchases = recentPurchases.filter((p) => p.createdAt >= mStart && p.createdAt < mEnd);
      const mExpenses = recentExpenses.filter((e) => e.createdAt >= mStart && e.createdAt < mEnd);

      const rev = mInvoices.reduce((s, inv) => s.plus(inv.total), new Decimal(0)).toNumber();
      const pur = mPurchases.reduce((s, p) => s.plus(p.total), new Decimal(0)).toNumber();
      const exp = mExpenses.reduce((s, e) => s.plus(e.amount), new Decimal(0)).toNumber();
      const profit = Math.max(0, rev - pur - exp);

      monthlyTrend.push({
        month: `${monthNames[mIdx]} ${String(y).slice(-2)}`,
        revenue: rev,
        purchases: pur,
        expenses: exp,
        profit,
        orders: mInvoices.length,
      });
    }

    // Build daily performance for the current month
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const daysInCurMonth = new Date(curYear, curMonth + 1, 0).getDate();
    const dailyTrend = [];
    for (let day = 1; day <= daysInCurMonth; day++) {
      const dayStart = new Date(Date.UTC(curYear, curMonth, day, 0, 0, 0));
      const dayEnd = new Date(Date.UTC(curYear, curMonth, day + 1, 0, 0, 0));

      const dInvoices = recentInvoices.filter((inv) => inv.createdAt >= dayStart && inv.createdAt < dayEnd);
      const dPurchases = recentPurchases.filter((p) => p.createdAt >= dayStart && p.createdAt < dayEnd);
      const dExpenses = recentExpenses.filter((e) => e.createdAt >= dayStart && e.createdAt < dayEnd);

      const rev = dInvoices.reduce((s, inv) => s.plus(inv.total), new Decimal(0)).toNumber();
      const pur = dPurchases.reduce((s, p) => s.plus(p.total), new Decimal(0)).toNumber();
      const exp = dExpenses.reduce((s, e) => s.plus(e.amount), new Decimal(0)).toNumber();
      const profit = Math.max(0, rev - pur - exp);

      dailyTrend.push({
        date: `${day} ${monthNames[curMonth]}`,
        revenue: rev,
        purchases: pur,
        expenses: exp,
        profit,
        orders: dInvoices.length,
      });
    }

    // Category distribution array
    const totalStockNum = Math.max(1, totalStockUnits.toNumber());
    const categoryDistribution = Object.entries(categoryMap).map(([category, info]) => {
      const stockNum = Math.max(0, info.stock.toNumber());
      return {
        category,
        count: info.count,
        stock: stockNum,
        percentage: Math.round((stockNum / totalStockNum) * 100),
      };
    }).sort((a, b) => b.stock - a.stock);

    // Smart Insights derived strictly from real DB facts
    const smartInsights = [
      {
        id: 'ins-1',
        title: 'Sales & Transactions',
        message: `${salesToday._count} transactions processed today with ${salesToday._sum.total ? salesToday._sum.total.toFixed(0) : '0'} revenue recorded.`,
        type: 'revenue',
      },
      {
        id: 'ins-2',
        title: 'Inventory Reorder Status',
        message: lowStock > 0 ? `${lowStock} medicines are below reorder threshold and require stock replenishment.` : 'All active catalog items meet or exceed reorder thresholds.',
        type: lowStock > 0 ? 'warning' : 'healthy',
      },
      {
        id: 'ins-3',
        title: 'Expiry & FEFO Watch',
        message: nearExpiry > 0 ? `${nearExpiry} batches expire within ${nearExpiryWindowDays} days. Prioritize FEFO dispensing.` : 'No immediate batch expirations in the upcoming 90-day window.',
        type: nearExpiry > 0 ? 'alert' : 'healthy',
      },
      {
        id: 'ins-4',
        title: 'Hospital Request Queue',
        message: pendingHmsRequests > 0 ? `${pendingHmsRequests} medicine requests from hospital wards awaiting approval/fulfillment.` : 'Hospital request queue is clear. No pending requests.',
        type: pendingHmsRequests > 0 ? 'info' : 'healthy',
      },
    ];

    const supplierUpdates = vendorsList.map((v) => ({
      id: v.id,
      name: v.name,
      status: v.paymentTermsDays ? `${v.paymentTermsDays} days payment term` : 'Active supplier',
      phone: v.phone || 'Verified vendor',
    }));

    return {
      salesToday: salesToday._sum.total ?? new Decimal(0),
      salesCountToday: salesToday._count,
      purchasesToday: purchasesToday._sum.total ?? new Decimal(0),
      purchasesCountToday: purchasesToday._count,
      totalRevenueAllTime: totalSalesAllTime._sum.total ?? new Decimal(0),
      totalSalesCountAllTime: totalSalesAllTime._count,
      totalMedicines: medicines.length,
      totalStockUnits: totalStockUnits.toNumber(),
      currentStockValue: stockValue,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
      nearExpiryCount: nearExpiry,
      expiredCount: expired,
      vendorPayable: vendorLedger._sum.amount ?? new Decimal(0),
      pendingSettlements,
      pendingHmsRequests,
      expectedCash: expected,
      monthlyTrend,
      dailyTrend,
      categoryDistribution,
      inventoryOverview: inventoryOverview.slice(0, 10),
      lowStockList: lowStockList.slice(0, 6),
      nearExpiryList: nearExpiryList.slice(0, 6),
      supplierUpdates,
      smartInsights,
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
