import 'dotenv/config';
import assert from 'node:assert/strict';
import { prisma } from '../src/db/client';
import { loadFinancialData, financialReport, summarizeFinancialTimeline, TimelineInterval } from '../src/modules/reports/financialRecognition';

function startOfDay(d = new Date()) {
  return new Date(new Date(d.getTime() + 5 * 3600000).toISOString().slice(0, 10) + 'T00:00:00+05:00');
}

async function main() {
  const financialData = await loadFinancialData();
  const now = new Date();
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 86_400_000);

  // Define the exact intervals used by dashboardService.getManagementSummary
  const intervals: TimelineInterval[] = [
    { id: 'today', gte: today, lte: new Date(tomorrow.getTime() - 1) },
    { id: 'lifetime', lte: now },
  ];

  // 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mIdx = d.getMonth();
    const y = d.getFullYear();
    const mStart = new Date(Date.UTC(y, mIdx, 1));
    const mEnd = new Date(Date.UTC(y, mIdx + 1, 1));
    intervals.push({
      id: `m-${i}`,
      gte: mStart,
      lte: new Date(Math.min(mEnd.getTime() - 1, now.getTime())),
    });
  }

  // 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = d.getMonth();
    const dayNum = d.getDate();
    const dayStart = new Date(Date.UTC(y, m, dayNum, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, m, dayNum + 1, 0, 0, 0));
    intervals.push({
      id: `d-${i}`,
      gte: dayStart,
      lte: new Date(Math.min(dayEnd.getTime() - 1, now.getTime())),
    });
  }

  console.log(`Testing ${intervals.length} intervals (should be 2 + 6 + 30 = 38)...`);

  // Baseline: run financialReport 38 times
  const t0 = performance.now();
  const baselineResults = intervals.map((inv) => ({
    id: inv.id,
    totals: financialReport(financialData, { gte: inv.gte, lte: inv.lte }).totals,
  }));
  const baselineMs = performance.now() - t0;
  console.log(`Baseline (38 financialReport calls): ${baselineMs.toFixed(2)} ms`);

  // Optimized single-pass timeline summary
  const t1 = performance.now();
  const summaryMap = summarizeFinancialTimeline(financialData, intervals);
  const optimizedResults = intervals.map((inv) => ({
    id: inv.id,
    totals: summaryMap.get(inv.id)!,
  }));
  const optimizedMs = performance.now() - t1;
  console.log(`Optimized (1 pass over data): ${optimizedMs.toFixed(2)} ms`);

  // Verify 100% parity
  for (let i = 0; i < intervals.length; i++) {
    const b = baselineResults[i].totals;
    const o = optimizedResults[i].totals;
    const id = intervals[i].id;
    assert.equal(o.grossSales.toString(), b.grossSales.toString(), `${id}: grossSales`);
    assert.equal(o.netBilling.toString(), b.netBilling.toString(), `${id}: netBilling`);
    assert.equal(o.taxBilled.toString(), b.taxBilled.toString(), `${id}: taxBilled`);
    assert.equal(o.total.toString(), b.total.toString(), `${id}: total`);
    assert.equal(o.collections.toString(), b.collections.toString(), `${id}: collections`);
    assert.equal(o.outstanding.toString(), b.outstanding.toString(), `${id}: outstanding`);
    assert.equal(o.recognizedRevenue.toString(), b.recognizedRevenue.toString(), `${id}: recognizedRevenue`);
    assert.equal(o.recognizedCogs.toString(), b.recognizedCogs.toString(), `${id}: recognizedCogs`);
    assert.equal(o.operatingExpenses.toString(), b.operatingExpenses.toString(), `${id}: operatingExpenses`);
    assert.equal(o.inventoryLosses.toString(), b.inventoryLosses.toString(), `${id}: inventoryLosses`);
    assert.equal(
      o.operatingProfit === null ? null : o.operatingProfit.toString(),
      b.operatingProfit === null ? null : b.operatingProfit.toString(),
      `${id}: operatingProfit`
    );
    assert.equal(o.incompleteInvoices, b.incompleteInvoices, `${id}: incompleteInvoices`);
  }

  console.log(`PASS! All 38 intervals matched with 100.000% parity across all financial metrics!`);
  await prisma.$disconnect();
}

main().catch(console.error);
