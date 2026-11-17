import { summarizeFinancialTimeline, loadFinancialData, TimelineInterval } from '../reports/financialRecognition';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { cashService } from '../cash/cash.service';

async function getNearExpiryWindowDays() {
  const settings = await prisma.pharmacySettings.findFirst();
  return settings?.nearExpiryWindowDays ?? 90;
}

function startOfDay(d = new Date()) {
  return new Date(new Date(d.getTime() + 5 * 3600000).toISOString().slice(0, 10) + 'T00:00:00+05:00');
}

/** pharmacy.md §5 — every KPI here is a real Prisma/SQL query. No hardcoded numbers. */
export const dashboardService = {
  async getManagementSummary(userId: string) {
    const today = startOfDay();
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const now = new Date();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Build timeline intervals for single-pass timeline summarizer
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const intervals: TimelineInterval[] = [
      { id: 'today', gte: today, lte: new Date(tomorrow.getTime() - 1) },
      { id: 'lifetime', lte: now },
    ];

    const monthDefs: Array<{ id: string; monthLabel: string; mStart: Date; mEnd: Date }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mIdx = d.getMonth();
      const y = d.getFullYear();
      const mStart = new Date(Date.UTC(y, mIdx, 1));
      const mEnd = new Date(Date.UTC(y, mIdx + 1, 1));
      const id = `m-${i}`;
      monthDefs.push({
        id,
        monthLabel: `${monthNames[mIdx]} ${String(y).slice(-2)}`,
        mStart,
        mEnd,
      });
      intervals.push({
        id,
        gte: mStart,
        lte: new Date(Math.min(mEnd.getTime() - 1, now.getTime())),
      });
    }

    const dayDefs: Array<{ id: string; dateLabel: string; fullDateLabel: string; dayStart: Date; dayEnd: Date }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = d.getMonth();
      const dayNum = d.getDate();
      const dayStart = new Date(Date.UTC(y, m, dayNum, 0, 0, 0));
      const dayEnd = new Date(Date.UTC(y, m, dayNum + 1, 0, 0, 0));
      const id = `d-${i}`;
      dayDefs.push({
        id,
        dateLabel: i === 0 ? 'Today' : `${dayNum} ${monthNames[m]}`,
        fullDateLabel: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
        dayStart,
        dayEnd,
      });
      intervals.push({
        id,
        gte: dayStart,
        lte: new Date(Math.min(dayEnd.getTime() - 1, now.getTime())),
      });
    }

    const [
      financialData,
      salesToday,
      purchasesToday,
      activeMedicines,
      positiveBatches,
      vendorLedger,
      pendingSettlements,
      pendingHmsRequests,
      expected,
      nearExpiryWindowDays,
      totalSalesAllTime,
      recentInvoices,
      recentPurchases,
      vendorsList,
      openPurchaseOrdersCount,
    ] = await Promise.all([
      loadFinancialData(),
      prisma.pharmacyInvoice.aggregate({ where: { createdAt: { gte: today, lt: tomorrow } }, _sum: { total: true }, _count: true }),
      prisma.purchase.aggregate({ where: { createdAt: { gte: today, lt: tomorrow } }, _sum: { total: true }, _count: true }),
      prisma.$queryRaw<Array<{
        id: string;
        code: string;
        name: string;
        categoryLabel: string;
        reorderLevel: number;
        rate: number;
        unitCode: string;
        currentStock: number;
      }>>`
        SELECT 
          m.id,
          m.code,
          m.name,
          COALESCE(NULLIF(TRIM(m.category), ''), 'General') AS "categoryLabel",
          m.reorder_level::numeric AS "reorderLevel",
          COALESCE(m.purchase_rate, m.sale_rate, 0)::numeric AS "rate",
          COALESCE(u.short_code, u.name, m.unit, 'units') AS "unitCode",
          COALESCE(s.stock, 0)::numeric AS "currentStock"
        FROM medicine_masters m
        LEFT JOIN units u ON m.base_unit_id = u.id
        LEFT JOIN (
          SELECT medicine_id, SUM(quantity_delta) AS stock
          FROM stock_ledger_entries
          GROUP BY medicine_id
        ) s ON s.medicine_id = m.id
        WHERE m.is_active = true
        ORDER BY m.name ASC
      `,
      prisma.$queryRaw<Array<{
        id: string;
        medicineId: string;
        name: string;
        batchNumber: string;
        expiryDate: Date;
        batchStock: number;
      }>>`
        SELECT 
          b.id,
          b.medicine_id AS "medicineId",
          m.name,
          b.batch_number AS "batchNumber",
          b.expiry_date AS "expiryDate",
          bs.stock::numeric AS "batchStock"
        FROM medicine_batches b
        JOIN medicine_masters m ON b.medicine_id = m.id
        JOIN (
          SELECT batch_id, SUM(quantity_delta) AS stock
          FROM stock_ledger_entries
          WHERE batch_id IS NOT NULL
          GROUP BY batch_id
          HAVING SUM(quantity_delta) > 0
        ) bs ON bs.batch_id = b.id
        WHERE m.is_active = true
        ORDER BY b.expiry_date ASC
      `,
      prisma.vendorLedgerEntry.aggregate({ _sum: { amount: true } }),
      prisma.accountSettlement.count({ where: { status: 'SUBMITTED' } }),
      prisma.medicineRequest.count({ where: { status: { in: ['REQUESTED', 'PARTIALLY_ACCEPTED'] } } }),
      cashService.expectedCash(userId),
      getNearExpiryWindowDays(),
      prisma.pharmacyInvoice.aggregate({ _sum: { total: true }, _count: true }),
      prisma.pharmacyInvoice.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { total: true, createdAt: true } }),
      prisma.purchase.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { total: true, createdAt: true } }),
      prisma.vendor.findMany({
        where: { isActive: true },
        take: 6,
        orderBy: { name: 'asc' },
        include: {
          purchaseOrders: {
            where: { status: 'OPEN' },
            select: { id: true, orderNumber: true, isUrgent: true },
          },
          ledgerEntries: {
            select: { amount: true },
          },
        },
      }),
      prisma.purchaseOrder.count({ where: { status: 'OPEN' } }),
    ]);

    // Single-pass timeline summarizer across all 38 intervals
    const timelineResults = summarizeFinancialTimeline(financialData, intervals);
    const todayFinancial = timelineResults.get('today')!;
    const lifetimeFinancial = timelineResults.get('lifetime')!;

    // Expiry and inventory calculations from SQL aggregated records
    const nearExpiryCutoff = new Date(now.getTime() + nearExpiryWindowDays * 86_400_000);
    let stockValue = new Decimal(0);
    let totalStockUnits = new Decimal(0);
    let lowStock = 0;
    let outOfStock = 0;
    let nearExpiry = 0;
    let expired = 0;

    const batchesByMedicine = new Map<string, typeof positiveBatches>();
    const nearExpiryList: Array<{
      id: string;
      medicineId: string;
      name: string;
      batchNumber: string;
      expiryDate: string;
      daysLeft: number;
      quantityRemaining: number;
    }> = [];

    for (const b of positiveBatches) {
      const list = batchesByMedicine.get(b.medicineId) || [];
      list.push(b);
      batchesByMedicine.set(b.medicineId, list);

      const exp = new Date(b.expiryDate);
      if (exp <= now) {
        expired += 1;
      } else if (exp <= nearExpiryCutoff) {
        nearExpiry += 1;
        nearExpiryList.push({
          id: b.id,
          medicineId: b.medicineId,
          name: b.name,
          batchNumber: b.batchNumber,
          expiryDate: exp.toISOString(),
          daysLeft: Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / 86_400_000)),
          quantityRemaining: Number(b.batchStock),
        });
      }
    }

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

    const lowStockList: Array<{
      id: string;
      name: string;
      currentStock: number;
      reorderLevel: number;
      unit: string;
      isOutOfStock: boolean;
    }> = [];

    for (const m of activeMedicines) {
      const stock = new Decimal(m.currentStock);
      totalStockUnits = totalStockUnits.plus(stock);
      stockValue = stockValue.plus(stock.mul(m.rate));

      const catName = m.categoryLabel || 'General';
      if (!categoryMap[catName]) categoryMap[catName] = { count: 0, stock: new Decimal(0) };
      categoryMap[catName].count += 1;
      categoryMap[catName].stock = categoryMap[catName].stock.plus(stock);

      const isOut = stock.lessThanOrEqualTo(0);
      const isLow = !isOut && stock.lessThanOrEqualTo(m.reorderLevel);

      if (isOut) {
        outOfStock += 1;
        lowStockList.push({
          id: m.id,
          name: m.name,
          currentStock: 0,
          reorderLevel: Number(m.reorderLevel),
          unit: m.unitCode,
          isOutOfStock: true,
        });
      } else if (isLow) {
        lowStock += 1;
        lowStockList.push({
          id: m.id,
          name: m.name,
          currentStock: stock.toNumber(),
          reorderLevel: Number(m.reorderLevel),
          unit: m.unitCode,
          isOutOfStock: false,
        });
      }

      const medBatches = batchesByMedicine.get(m.id) || [];
      const earliestBatch = medBatches[0];
      const hasExpired = medBatches.some((b) => new Date(b.expiryDate) <= now);
      const hasNearExpiry = medBatches.some((b) => {
        const exp = new Date(b.expiryDate);
        return exp > now && exp <= nearExpiryCutoff;
      });

      const itemStatus: 'Healthy' | 'Low Stock' | 'Critical' = isOut || hasExpired ? 'Critical' : isLow || hasNearExpiry ? 'Low Stock' : 'Healthy';
      inventoryOverview.push({
        id: m.id,
        code: m.code,
        name: m.name,
        category: catName,
        currentStock: stock.toNumber(),
        reorderLevel: Number(m.reorderLevel),
        expiryDate: earliestBatch ? new Date(earliestBatch.expiryDate).toISOString() : null,
        status: itemStatus,
        batchNumber: earliestBatch ? earliestBatch.batchNumber : null,
      });
    }

    // Sort lowStockList: out of stock items first, then lowest remaining vs reorder
    lowStockList.sort((a, b) => {
      if (a.isOutOfStock && !b.isOutOfStock) return -1;
      if (!a.isOutOfStock && b.isOutOfStock) return 1;
      return (a.currentStock - a.reorderLevel) - (b.currentStock - b.reorderLevel);
    });

    // Sort nearExpiryList: expiring earliest first
    nearExpiryList.sort((a, b) => a.daysLeft - b.daysLeft);

    // Build monthly performance for last 6 months from pre-computed timeline map
    const monthlyTrend = monthDefs.map((def) => {
      const financial = timelineResults.get(def.id)!;
      const mInvoices = recentInvoices.filter((inv) => inv.createdAt >= def.mStart && inv.createdAt < def.mEnd);
      const mPurchases = recentPurchases.filter((p) => p.createdAt >= def.mStart && p.createdAt < def.mEnd);
      const pur = mPurchases.reduce((s, p) => s.plus(p.total), new Decimal(0)).toNumber();
      const exp = Number(financial.operatingExpenses);
      const profit = financial.operatingProfit === null ? null : Number(financial.operatingProfit);

      return {
        month: def.monthLabel,
        revenue: Number(financial.recognizedRevenue),
        grossSales: Number(financial.grossSales),
        netBilling: Number(financial.netBilling),
        collections: Number(financial.collections),
        outstanding: Number(financial.outstanding),
        cogs: Number(financial.recognizedCogs),
        purchases: pur,
        expenses: exp,
        profit,
        orders: mInvoices.length,
      };
    });

    // Build rolling daily performance for the last 30 days from pre-computed timeline map
    const dailyTrend = dayDefs.map((def) => {
      const financial = timelineResults.get(def.id)!;
      const dInvoices = recentInvoices.filter((inv) => inv.createdAt >= def.dayStart && inv.createdAt < def.dayEnd);
      const dPurchases = recentPurchases.filter((p) => p.createdAt >= def.dayStart && p.createdAt < def.dayEnd);
      const pur = dPurchases.reduce((s, p) => s.plus(p.total), new Decimal(0)).toNumber();
      const exp = Number(financial.operatingExpenses);
      const profit = financial.operatingProfit === null ? null : Number(financial.operatingProfit);

      return {
        date: def.dateLabel,
        fullDate: def.fullDateLabel,
        revenue: Number(financial.recognizedRevenue),
        grossSales: Number(financial.grossSales),
        netBilling: Number(financial.netBilling),
        collections: Number(financial.collections),
        outstanding: Number(financial.outstanding),
        cogs: Number(financial.recognizedCogs),
        purchases: pur,
        expenses: exp,
        profit,
        orders: dInvoices.length,
      };
    });

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
        message: `${salesToday._count} transactions processed today with ${salesToday._sum.total ? salesToday._sum.total.toFixed(0) : '0'} billed (not recognized revenue).`,
        type: 'revenue',
      },
      {
        id: 'ins-2',
        title: 'Inventory Reorder Status',
        message: (lowStock + outOfStock) > 0 ? `${lowStock + outOfStock} medicines are below reorder threshold or out of stock.` : 'All active catalog items meet or exceed reorder thresholds.',
        type: (lowStock + outOfStock) > 0 ? 'warning' : 'healthy',
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

    const supplierUpdates = vendorsList.map((v) => {
      const balance = v.ledgerEntries.reduce((s, e) => s.plus(e.amount), new Decimal(0)).toNumber();
      const openOrdersCount = v.purchaseOrders.length;
      const termsLabel = v.paymentTermsDays === 0 ? 'Immediate / COD' : `Net ${v.paymentTermsDays} Days`;
      let statusText = termsLabel;
      if (openOrdersCount > 0) {
        statusText = `${openOrdersCount} Open PO`;
      } else if (balance > 0) {
        statusText = `PKR ${balance.toLocaleString()} payable`;
      }

      return {
        id: v.id,
        name: v.name,
        code: v.code,
        status: statusText,
        phone: v.phone || 'Verified vendor',
        paymentTerms: termsLabel,
        openOrdersCount,
        balance,
      };
    });

    return {
      salesToday: todayFinancial.total,
      salesCountToday: salesToday._count,
      purchasesToday: purchasesToday._sum.total ?? new Decimal(0),
      purchasesCountToday: purchasesToday._count,
      totalRevenueAllTime: lifetimeFinancial.recognizedRevenue,
      recognizedRevenueToday: todayFinancial.recognizedRevenue,
      collectionsToday: todayFinancial.collections,
      outstanding: todayFinancial.outstanding,
      operatingProfitToday: todayFinancial.operatingProfit,
      incompleteInvoices: lifetimeFinancial.incompleteInvoices,
      totalSalesCountAllTime: totalSalesAllTime._count,
      totalMedicines: activeMedicines.length,
      totalStockUnits: totalStockUnits.toNumber(),
      currentStockValue: stockValue,
      lowStockCount: lowStock + outOfStock,
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
      openPurchaseOrdersCount,
      smartInsights,
    };
  },

  async getSalesSummary(userId: string) {
    const today = startOfDay();
    const tomorrow = new Date(today.getTime() + 86_400_000);

    const [mySales, pendingHmsRequests, expected, paymentAggregates, refundAggregates] = await Promise.all([
      prisma.pharmacyInvoice.aggregate({
        where: { dispensedById: userId, createdAt: { gte: today, lt: tomorrow } },
        _sum: { total: true, paidTotal: true },
        _count: true,
      }),
      prisma.medicineRequest.count({ where: { status: { in: ['REQUESTED', 'PARTIALLY_ACCEPTED'] } } }),
      cashService.expectedCash(userId),
      prisma.pharmacyPayment.groupBy({
        by: ['method'],
        where: {
          collectedById: userId,
          paidAt: { gte: today, lt: tomorrow },
          invoice: { channel: 'RETAIL' },
        },
        _sum: { amount: true },
      }),
      prisma.cashLedgerEntry.groupBy({
        by: ['isPhysicalCash'],
        where: {
          portalUserId: userId,
          occurredAt: { gte: today, lt: tomorrow },
          category: 'REFUND',
          referenceTable: 'pharmacy_invoices',
        },
        _sum: { amount: true },
      }),
    ]);

    const cashPayments = paymentAggregates.find((p) => p.method === 'CASH')?._sum.amount ?? new Decimal(0);
    const nonCashPayments = paymentAggregates
      .filter((p) => p.method !== 'CASH')
      .reduce((sum, p) => sum.plus(p._sum.amount ?? 0), new Decimal(0));
    const cashRefunds = refundAggregates.find((r) => r.isPhysicalCash)?._sum.amount ?? new Decimal(0);
    const nonCashRefunds = refundAggregates.find((r) => !r.isPhysicalCash)?._sum.amount ?? new Decimal(0);

    const cashCollectionToday = cashPayments.minus(cashRefunds);
    const cardOnlineCollectionToday = nonCashPayments.minus(nonCashRefunds);

    return {
      mySalesToday: mySales._sum.total ?? new Decimal(0),
      mySalesCountToday: mySales._count,
      cashCollectionToday,
      cardOnlineCollectionToday,
      pendingHmsRequests,
      expectedCash: expected,
    };
  },
};
