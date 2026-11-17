import 'dotenv/config';
import { prisma } from '../src/db/client';
import { dashboardService } from '../src/modules/dashboard/dashboard.service';
import { reportsService } from '../src/modules/reports/reports.service';

async function measure<T>(name: string, fn: () => Promise<T>): Promise<{ durationMs: number; heapMb: number; result: T }> {
  if (global.gc) global.gc();
  const startMem = process.memoryUsage().heapUsed;
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  const endMem = process.memoryUsage().heapUsed;
  const heapMb = (endMem - startMem) / (1024 * 1024);
  console.log(`[BENCHMARK] ${name}: ${durationMs.toFixed(2)} ms, Heap delta: ${heapMb.toFixed(2)} MB`);
  return { durationMs, heapMb, result };
}

async function run() {
  const admin = await prisma.portalUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) throw new Error('No admin user found');

  const todayStr = new Date().toISOString().slice(0, 10);

  console.log({
    invoices: await prisma.pharmacyInvoice.count(),
    medicines: await prisma.medicineMaster.count(),
    entries: await prisma.stockLedgerEntry.count(),
    payments: await prisma.pharmacyPayment.count(),
    financialEvents: await prisma.pharmacyFinancialEvent.count(),
    expenses: await prisma.expense.count(),
  });
  console.log('--- STARTING BATCH 5 BASELINE BENCHMARKS ---');
  await measure('1. dashboardService.getManagementSummary', () => dashboardService.getManagementSummary(admin.id));
  await measure('2. dashboardService.getSalesSummary', () => dashboardService.getSalesSummary(admin.id));
  await measure('3. reportsService.run(SALES_COLLECTION - Today)', () =>
    reportsService.run({ type: 'SALES_COLLECTION', from: new Date(`${todayStr}T00:00:00Z`), to: new Date(`${todayStr}T23:59:59.999Z`) })
  );
  await measure('4. reportsService.run(OPERATING_PROFIT - Today)', () =>
    reportsService.run({ type: 'OPERATING_PROFIT', from: new Date(`${todayStr}T00:00:00Z`), to: new Date(`${todayStr}T23:59:59.999Z`) })
  );
  await measure('5. reportsService.run(INCOME_EXPENSE - Today)', () =>
    reportsService.run({ type: 'INCOME_EXPENSE', from: new Date(`${todayStr}T00:00:00Z`), to: new Date(`${todayStr}T23:59:59.999Z`) })
  );
  console.log('--- FINISHED BATCH 5 BASELINE BENCHMARKS ---');
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
