import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { pharmacyService } from '../src/modules/pharmacy/pharmacy.service';
import { loadFinancialData, financialReport } from '../src/modules/reports/financialRecognition';
import { reportsService } from '../src/modules/reports/reports.service';

const prisma = new PrismaClient();
const rollback = new Error('BATCH6_BENCHMARK_COMPLETE_ROLLBACK');

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function runScaleBenchmark() {
  console.log('================================================================');
  console.log('   PHARMACY ERP BATCH 6: REAL SCALE BENCHMARK & STRESS AUDIT    ');
  console.log('================================================================\n');

  try {
    await prisma.$transaction(async (tx) => {
      const marker = 'B6-' + randomUUID().slice(0, 6);
      const user = await tx.portalUser.create({
        data: { username: marker, fullName: 'Scale Benchmark Admin', passwordHash: 'HASH', role: 'SUPER_ADMIN' },
      });
      const unit = await tx.unit.create({ data: { name: `Unit-${marker}`, shortCode: marker } });

      const medicineScales = [700, 2000, 5000];

      for (const scale of medicineScales) {
        console.log(`\n>>> SEEDING SYNTHETIC DATASET: ${scale} MEDICINES & INVENTORY BATCHES <<<`);
        const t0Seed = performance.now();

        // 1. Bulk create medicines
        const medData: Prisma.MedicineMasterCreateManyInput[] = [];
        const baseIds: string[] = [];
        for (let i = 0; i < scale; i++) {
          const id = randomUUID();
          baseIds.push(id);
          medData.push({
            id,
            code: `${marker}-M${scale}-${String(i).padStart(5, '0')}`,
            name: `Medicine ${scale} Item ${i} ${marker}`,
            unit: 'Tablet',
            baseUnitId: unit.id,
            batchManaged: true,
            saleRate: 50 + (i % 200),
            purchaseRate: 30 + (i % 150),
          });
        }
        await tx.medicineMaster.createMany({ data: medData });

        // 2. Bulk create packaging levels (level 0 base unit)
        const pkgData = baseIds.map((medicineId) => ({
          medicineId,
          unitId: unit.id,
          level: 0,
          conversionToBase: 1,
          isPurchaseUnit: true,
          isSaleUnit: true,
        }));
        await tx.medicinePackagingLevel.createMany({ data: pkgData });

        // 3. Bulk create batches
        const batchIds: string[] = [];
        const batchData = baseIds.slice(0, Math.min(scale, 1000)).map((medicineId, idx) => {
          const batchId = randomUUID();
          batchIds.push(batchId);
          return {
            id: batchId,
            medicineId,
            batchNumber: `BATCH-${marker}-${idx}`,
            expiryDate: new Date('2028-12-31'),
            costRate: 30,
            saleRate: 50,
          };
        });
        await tx.medicineBatch.createMany({ data: batchData });

        // 4. Bulk create stock ledger entries (opening stock of 100 units per medicine)
        const stockEntriesData = baseIds.map((medicineId, idx) => ({
          medicineId,
          batchId: idx < batchIds.length ? batchIds[idx] : null,
          movementType: 'OPENING_STOCK' as const,
          quantityDelta: 100,
          referenceTable: 'medicine_masters',
          referenceId: medicineId,
          actorId: user.id,
        }));
        await tx.stockLedgerEntry.createMany({ data: stockEntriesData });

        const seedDuration = (performance.now() - t0Seed).toFixed(1);
        console.log(`   Seeded ${scale} medicines in ${seedDuration} ms.`);

        // ── BENCHMARK 1: POS CATALOG QUERY ──
        const memBeforePos = process.memoryUsage().heapUsed;
        const t0Pos = performance.now();
        const posCatalog = await pharmacyService.getPosCatalog({}, tx);
        const t1Pos = performance.now();
        const memAfterPos = process.memoryUsage().heapUsed;

        const posPayloadBytes = Buffer.byteLength(JSON.stringify(posCatalog), 'utf8');
        const posLatency = (t1Pos - t0Pos).toFixed(2);
        const posMemDelta = formatBytes(Math.max(0, memAfterPos - memBeforePos));

        console.log(`\n   [POS CATALOG QUERY @ ${scale} Medicines]`);
        console.log(`   - Records returned: ${posCatalog.length}`);
        console.log(`   - Latency (execution): ${posLatency} ms`);
        console.log(`   - JSON Payload Size: ${formatBytes(posPayloadBytes)}`);
        console.log(`   - Heap Memory Delta: ${posMemDelta}`);

        // ── BENCHMARK 2: POS CATALOG SEARCH FILTER (e.g. "Item 10") ──
        const t0PosSearch = performance.now();
        const posFiltered = await pharmacyService.getPosCatalog({ search: 'Item 10' }, tx);
        const t1PosSearch = performance.now();
        const posSearchPayloadBytes = Buffer.byteLength(JSON.stringify(posFiltered), 'utf8');

        console.log(`   [POS FILTERED SEARCH: 'Item 10' @ ${scale} Medicines]`);
        console.log(`   - Matching rows: ${posFiltered.length}`);
        console.log(`   - Search Latency: ${(t1PosSearch - t0PosSearch).toFixed(2)} ms`);
        console.log(`   - Payload Size: ${formatBytes(posSearchPayloadBytes)}`);

        // ── BENCHMARK 3: INVENTORY PAGINATED LIST (25 per page with stock aggregation) ──
        const t0Inv = performance.now();
        const invPage = (await pharmacyService.listMedicines({ page: 1, limit: 25 }, tx)) as any;
        const t1Inv = performance.now();
        const invPayloadBytes = Buffer.byteLength(JSON.stringify(invPage), 'utf8');

        console.log(`   [INVENTORY PAGINATED QUERY @ ${scale} Medicines]`);
        console.log(`   - Total count in DB: ${invPage.total}`);
        console.log(`   - Rows returned: ${invPage.items?.length ?? invPage.length}`);
        console.log(`   - Paginated Latency: ${(t1Inv - t0Inv).toFixed(2)} ms`);
        console.log(`   - Payload Size (Page 1): ${formatBytes(invPayloadBytes)}`);

        // ── BENCHMARK 4: INVENTORY FULL-TEXT SEARCH ──
        const t0InvSearch = performance.now();
        const invSearch = (await pharmacyService.listMedicines({ search: 'Item 5', page: 1, limit: 25 }, tx)) as any;
        const t1InvSearch = performance.now();

        console.log(`   [INVENTORY SEARCH 'Item 5' @ ${scale} Medicines]`);
        console.log(`   - Search matches: ${invSearch.total ?? invSearch.length}`);
        console.log(`   - Search Latency: ${(t1InvSearch - t0InvSearch).toFixed(2)} ms`);
      }

      // ── BENCHMARK 5: FINANCIAL REPORTING & DATE-SCOPED AGGREGATION AT SCALE ──
      console.log(`\n>>> SEEDING SYNTHETIC TRANSACTION HISTORY: 1,000 INVOICES & PAYMENTS <<<`);
      const invCount = 1000;
      const invData: Prisma.PharmacyInvoiceCreateManyInput[] = [];
      const baseDate = new Date('2026-11-01T00:00:00Z').getTime();

      for (let i = 0; i < invCount; i++) {
        const invDate = new Date(baseDate + (i * 3600000 * 24 * 30) / invCount);
        invData.push({
          invoiceNumber: `${marker}-INV-${String(i).padStart(5, '0')}`,
          channel: i % 4 === 0 ? 'HMS_LINKED' : 'RETAIL',
          collectionOwner: i % 4 === 0 ? 'HMS_FRONT_DESK' : 'PHARMACY_RETAIL',
          customerName: `Customer ${i}`,
          subtotal: 1000,
          discountTotal: 0,
          taxTotal: 0,
          total: 1000,
          paidTotal: 1000,
          outstanding: 0,
          status: 'PAID',
          clearanceStatus: 'CLEARED',
          dispensedById: user.id,
          createdAt: invDate,
        });
      }
      await tx.pharmacyInvoice.createMany({ data: invData });

      // Financial Engine Scoped Query Benchmark
      const dayRange = {
        from: new Date('2026-11-15T00:00:00.000Z'),
        to: new Date('2026-11-15T23:59:59.999Z'),
      };
      const t0FinScoped = performance.now();
      const finScopedData = await loadFinancialData(tx, dayRange);
      const finScopedReport = financialReport(finScopedData, dayRange);
      const t1FinScoped = performance.now();

      console.log(`\n   [FINANCIAL ENGINE: SINGLE-DAY SCOPED QUERY]`);
      console.log(`   - Invoices retrieved for day: ${finScopedData.invoices.length} / 1000 total`);
      console.log(`   - Execution Time: ${(t1FinScoped - t0FinScoped).toFixed(2)} ms`);
      console.log(`   - Recognized Revenue: ${finScopedReport.totals.recognizedRevenue} PKR`);

      // Database Aggregate Report Benchmark (All-time canonical totals)
      const t0RepAgg = performance.now();
      const repAgg = await reportsService.run({ type: 'PURCHASE' });
      const t1RepAgg = performance.now();

      console.log(`\n   [REPORT SERVICE: CANONICAL DB-LEVEL AGGREGATE]`);
      console.log(`   - Aggregation Latency: ${(t1RepAgg - t0RepAgg).toFixed(2)} ms`);
      console.log(`   - Reported Total Count: ${repAgg.totalCount}`);

      console.log('\nRolling back benchmark transaction to leave database pristine...');
      throw rollback;
    }, { maxWait: 60000, timeout: 60000 });
  } catch (err) {
    if (err === rollback) {
      console.log('\n=== BENCHMARK SUCCESSFULLY COMPLETED & ROLLED BACK ===');
    } else {
      console.error('Benchmark failed:', err);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

runScaleBenchmark();
