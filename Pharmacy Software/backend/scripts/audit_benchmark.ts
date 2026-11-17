import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { pharmacyService } from '../src/modules/pharmacy/pharmacy.service';

const prisma = new PrismaClient();

async function runBenchmark() {
  console.log('=== PHARMACY INVOICES SCALABILITY AUDIT & BENCHMARK ===\n');

  // Check current DB counts
  const currentInvoices = await prisma.pharmacyInvoice.count();
  const currentPayments = await prisma.pharmacyPayment.count();
  console.log(`Current Database State: ${currentInvoices} invoices, ${currentPayments} payments.\n`);

  // We will run tests inside a transaction that is rolled back so no test fixtures remain
  const rollback = new Error('BENCHMARK_ROLLBACK');

  try {
    await prisma.$transaction(async (tx) => {
      // Create user fixture
      const marker = 'BENCH-' + randomUUID().slice(0, 8);
      const user = await tx.portalUser.create({
        data: { username: marker, fullName: 'Bench User ' + marker, passwordHash: 'NO', role: 'ADMIN' },
      });
      const unit = await tx.unit.create({ data: { name: marker, shortCode: marker.slice(-6) } });
      const medicine = await tx.medicineMaster.create({
        data: {
          code: marker,
          name: marker,
          unit: 'Tablet',
          baseUnitId: unit.id,
          batchManaged: false,
          saleRate: 100,
          purchaseRate: 50,
          packagingLevels: { create: { unitId: unit.id, conversionToBase: 1, isSaleUnit: true, level: 0 } },
        },
      });

      // Benchmark datasets: 100, 1,000, and 5,000/10,000
      const testScales = [100, 1000, 5000];

      for (const scale of testScales) {
        console.log(`--- Creating dataset of ${scale} synthetic invoices + partial collections ---`);
        const invData: Prisma.PharmacyInvoiceCreateManyInput[] = [];
        const baseDate = new Date('2026-11-01T10:00:00Z').getTime();

        for (let i = 0; i < scale; i++) {
          const invId = randomUUID();
          const createdAt = new Date(baseDate + (i * 3600000) % (30 * 86400000));
          invData.push({
            id: invId,
            invoiceNumber: `${marker}-${scale}-${String(i).padStart(6, '0')}`,
            channel: i % 5 === 0 ? 'HMS_LINKED' : 'RETAIL',
            customerName: `Customer ${i} ${marker}`,
            subtotal: 1000,
            discountTotal: 0,
            taxTotal: 0,
            total: 1000,
            paidTotal: i % 2 === 0 ? 500 : 1000,
            outstanding: i % 2 === 0 ? 500 : 0,
            status: i % 2 === 0 ? 'PARTIALLY_PAID' : 'PAID',
            dispensedById: user.id,
            createdAt,
          });
        }

        // Bulk insert invoices
        await tx.pharmacyInvoice.createMany({ data: invData });

        // Add payments for these invoices (1 initial + 1 subsequent installment for half of them)
        const payData: Prisma.PharmacyPaymentCreateManyInput[] = [];
        for (let i = 0; i < scale; i++) {
          const inv = invData[i];
          // Initial payment
          payData.push({
            id: randomUUID(),
            invoiceId: inv.id,
            amount: 500,
            method: 'CASH',
            isInitial: true,
            collectedById: user.id,
            paidAt: inv.createdAt,
          });

          // Subsequent payment on a later date for odd invoices
          if (i % 2 !== 0) {
            payData.push({
              id: randomUUID(),
              invoiceId: inv.id,
              amount: 500,
              method: 'CARD',
              isInitial: false,
              collectedById: user.id,
              paidAt: new Date(new Date(inv.createdAt).getTime() + 5 * 86400000), // 5 days later
            });
          }
        }
        await tx.pharmacyPayment.createMany({ data: payData });

        // Measure Current Implementation Execution
        console.log(`Dataset created. Total invoices in tx: ${await tx.pharmacyInvoice.count()}`);
        console.log(`Total payments in tx: ${await tx.pharmacyPayment.count()}`);

        // Force GC if available or record initial memory
        const memBefore = process.memoryUsage().heapUsed;
        const tStart = performance.now();

        // Call listInvoices with page=1, limit=25
        const res = (await pharmacyService.listInvoices(
          { transactions: 'true', page: 1, limit: 25 },
          tx
        )) as any;

        const tEnd = performance.now();
        const memAfter = process.memoryUsage().heapUsed;

        const durationMs = Math.round(tEnd - tStart);
        const memDeltaMb = Math.round(((memAfter - memBefore) / 1024 / 1024) * 100) / 100;

        console.log(`\n[MEASURED METRICS @ ${scale} INVOICES]`);
        console.log(`- Total Duration: ${durationMs} ms`);
        console.log(`- Heap Delta: ${memDeltaMb} MB`);
        console.log(`- Total Transactions Processed in Node: ${res.total}`);
        console.log(`- Page 1 Items Returned: ${res.items.length}`);
        console.log(`- Page 1 Execution Time: ${durationMs} ms\n`);
      }

      throw rollback;
    }, { timeout: 180000 });
  } catch (err) {
    if (err !== rollback) console.error('Error during benchmark:', err);
    else console.log('Benchmark finished cleanly. All synthetic test records rolled back.');
  } finally {
    await prisma.$disconnect();
  }
}

runBenchmark().catch(console.error);
