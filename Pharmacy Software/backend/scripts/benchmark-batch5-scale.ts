import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { loadFinancialData, financialReport, summarizeFinancialTimeline, TimelineInterval } from '../src/modules/reports/financialRecognition';
import { dashboardService } from '../src/modules/dashboard/dashboard.service';

const db = new PrismaClient();
const rollback = new Error('ROLLBACK_BENCHMARK');

function startOfDay(d = new Date()) {
  return new Date(new Date(d.getTime() + 5 * 3600000).toISOString().slice(0, 10) + 'T00:00:00+05:00');
}

async function runScaleBenchmark() {
  console.log('=== RUNNING BATCH 5 MULTI-SCALE PERFORMANCE BENCHMARK ===');

  try {
    await db.$transaction(async (tx) => {
      const marker = 'BENCH-B5-' + randomUUID().slice(0, 8);
      const user = await tx.portalUser.create({
        data: { username: marker, fullName: marker, passwordHash: 'NO-LOGIN', role: 'SUPER_ADMIN' },
      });
      const unit = await tx.unit.create({ data: { name: marker, shortCode: marker.slice(-6) } });
      const med = await tx.medicineMaster.create({
        data: {
          code: marker,
          name: marker,
          unit: 'Tablet',
          baseUnitId: unit.id,
          batchManaged: false,
          saleRate: 100,
          purchaseRate: 60,
        },
      });

      const scales = [100, 500, 1000];

      for (const count of scales) {
        console.log(`\n--- Seeding scale: ${count} invoices ---`);
        const now = new Date();
        const baseTime = now.getTime() - 90 * 86_400_000; // Spread over 90 days

        // Generate synthetic invoices in bulk
        const invoicesData: Prisma.PharmacyInvoiceCreateManyInput[] = [];
        for (let i = 0; i < count; i++) {
          const createdAt = new Date(baseTime + (i / count) * 90 * 86_400_000);
          invoicesData.push({
            invoiceNumber: `${marker}-${count}-${i}`,
            channel: 'RETAIL',
            collectionOwner: 'PHARMACY_RETAIL',
            createdAt,
            subtotal: 1000,
            total: 1000,
            paidTotal: i % 2 === 0 ? 1000 : 500,
            outstanding: i % 2 === 0 ? 0 : 500,
            status: i % 2 === 0 ? 'PAID' : 'PARTIALLY_PAID',
            dispensedById: user.id,
          });
        }
        await tx.pharmacyInvoice.createMany({ data: invoicesData });

        // Retrieve created invoice IDs to generate payments and lines
        const createdInvoices = await tx.pharmacyInvoice.findMany({
          where: { invoiceNumber: { startsWith: `${marker}-${count}-` } },
          select: { id: true, createdAt: true, status: true },
        });

        const linesData: Prisma.PharmacyInvoiceLineCreateManyInput[] = [];
        const paymentsData: Prisma.PharmacyPaymentCreateManyInput[] = [];

        for (const inv of createdInvoices) {
          linesData.push({
            invoiceId: inv.id,
            medicineId: med.id,
            quantity: 10,
            rateSnapshot: 100,
            lineNet: 1000,
            costRateSnapshot: 60,
            dispensedAt: inv.createdAt,
          });
          paymentsData.push({
            invoiceId: inv.id,
            amount: 500,
            method: 'CASH',
            collectedById: user.id,
            paidAt: inv.createdAt,
          });
          if (inv.status === 'PAID') {
            paymentsData.push({
              invoiceId: inv.id,
              amount: 500,
              method: 'ONLINE',
              collectedById: user.id,
              paidAt: new Date(inv.createdAt.getTime() + 86_400_000), // cleared next day
            });
          }
        }
        await tx.pharmacyInvoiceLine.createMany({ data: linesData });
        await tx.pharmacyPayment.createMany({ data: paymentsData });

        console.log(`Seeded ${createdInvoices.length} invoices, ${linesData.length} lines, ${paymentsData.length} payments.`);

        // Build 38 intervals
        const today = startOfDay();
        const tomorrow = new Date(today.getTime() + 86_400_000);
        const intervals: TimelineInterval[] = [
          { id: 'today', gte: today, lte: new Date(tomorrow.getTime() - 1) },
          { id: 'lifetime', lte: now },
        ];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const y = d.getFullYear();
          const m = d.getMonth();
          intervals.push({
            id: `m-${i}`,
            gte: new Date(Date.UTC(y, m, 1)),
            lte: new Date(Math.min(new Date(Date.UTC(y, m + 1, 1)).getTime() - 1, now.getTime())),
          });
        }
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const y = d.getFullYear();
          const m = d.getMonth();
          const dayNum = d.getDate();
          intervals.push({
            id: `d-${i}`,
            gte: new Date(Date.UTC(y, m, dayNum, 0, 0, 0)),
            lte: new Date(Math.min(new Date(Date.UTC(y, m, dayNum + 1, 0, 0, 0)).getTime() - 1, now.getTime())),
          });
        }

        const data = await loadFinancialData(tx);

        // 1. Measure Old Unoptimized: 38 separate calls to financialReport
        if (global.gc) global.gc();
        const memBeforeOld = process.memoryUsage().heapUsed;
        const tStartOld = performance.now();
        for (const inv of intervals) {
          financialReport(data, { gte: inv.gte, lte: inv.lte });
        }
        const tOldMs = performance.now() - tStartOld;
        const memOldMb = (process.memoryUsage().heapUsed - memBeforeOld) / (1024 * 1024);

        // 2. Measure Optimized Batch 5: Single-pass timeline summarizer
        if (global.gc) global.gc();
        const memBeforeOpt = process.memoryUsage().heapUsed;
        const tStartOpt = performance.now();
        summarizeFinancialTimeline(data, intervals);
        const tOptMs = performance.now() - tStartOpt;
        const memOptMb = (process.memoryUsage().heapUsed - memBeforeOpt) / (1024 * 1024);

        const speedup = (tOldMs / tOptMs).toFixed(2);
        console.log(`[SCALE ${count} INVOICES]`);
        console.log(`  Old 38x Loop:       ${tOldMs.toFixed(2)} ms | Heap delta: ${memOldMb.toFixed(2)} MB`);
        console.log(`  Batch 5 Timeline:   ${tOptMs.toFixed(2)} ms | Heap delta: ${memOptMb.toFixed(2)} MB`);
        console.log(`  ⚡ Speedup:          ${speedup}x FASTER!`);
      }

      console.log('\nRolling back benchmark synthetic data...');
      throw rollback;
    });
  } catch (err: any) {
    if (err !== rollback) throw err;
  }
  await db.$disconnect();
}

runScaleBenchmark().catch(console.error);

