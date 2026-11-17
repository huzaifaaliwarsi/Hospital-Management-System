import 'dotenv/config';
import assert from 'node:assert/strict';
import { prisma } from '../src/db/client';
import { dashboardService } from '../src/modules/dashboard/dashboard.service';
import { cashService } from '../src/modules/cash/cash.service';
import { Decimal } from '@prisma/client/runtime/library';

function startOfDay(d = new Date()) {
  return new Date(new Date(d.getTime() + 5 * 3600000).toISOString().slice(0, 10) + 'T00:00:00+05:00');
}

async function main() {
  const admin = await prisma.portalUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) throw new Error('No admin user');

  const baseline = await dashboardService.getSalesSummary(admin.id);
  console.log('Baseline getSalesSummary:', baseline);

  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 86_400_000);

  const [mySales, pendingHmsRequests, expected, paymentAggregates, refundAggregates] = await Promise.all([
    prisma.pharmacyInvoice.aggregate({
      where: { dispensedById: admin.id, createdAt: { gte: today, lt: tomorrow } },
      _sum: { total: true, paidTotal: true },
      _count: true,
    }),
    prisma.medicineRequest.count({ where: { status: { in: ['REQUESTED', 'PARTIALLY_ACCEPTED'] } } }),
    cashService.expectedCash(admin.id),
    prisma.pharmacyPayment.groupBy({
      by: ['method'],
      where: {
        collectedById: admin.id,
        paidAt: { gte: today, lt: tomorrow },
        invoice: { channel: 'RETAIL' },
      },
      _sum: { amount: true },
    }),
    prisma.cashLedgerEntry.groupBy({
      by: ['isPhysicalCash'],
      where: {
        portalUserId: admin.id,
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

  const optimized = {
    mySalesToday: mySales._sum.total ?? new Decimal(0),
    mySalesCountToday: mySales._count,
    cashCollectionToday,
    cardOnlineCollectionToday,
    pendingHmsRequests,
    expectedCash: expected,
  };
  console.log('Optimized getSalesSummary:', optimized);

  assert.equal(optimized.mySalesToday.toString(), baseline.mySalesToday.toString());
  assert.equal(optimized.mySalesCountToday, baseline.mySalesCountToday);
  assert.equal(optimized.cashCollectionToday.toString(), baseline.cashCollectionToday.toString());
  assert.equal(optimized.cardOnlineCollectionToday.toString(), baseline.cardOnlineCollectionToday.toString());
  assert.equal(optimized.pendingHmsRequests, baseline.pendingHmsRequests);
  assert.equal(optimized.expectedCash.toString(), baseline.expectedCash.toString());

  console.log('PASS: getSalesSummary parity verified 100%!');
  await prisma.$disconnect();
}

main().catch(console.error);

