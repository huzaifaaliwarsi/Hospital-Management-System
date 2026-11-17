import 'dotenv/config';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../src/db/client';
import { loadFinancialData, financialReport, projectInvoice, FinancialRange } from '../src/modules/reports/financialRecognition';

const zero = () => new Decimal(0);
const add = <T>(rows: T[], fn: (row: T) => Decimal) =>
  rows.reduce((sum, row) => sum.plus(fn(row)), zero());

function startOfDay(d = new Date()) {
  return new Date(new Date(d.getTime() + 5 * 3600000).toISOString().slice(0, 10) + 'T00:00:00+05:00');
}

async function main() {
  const financialData = await loadFinancialData();
  const now = new Date();
  const today = startOfDay();
  const tomorrow = new Date(today.getTime() + 86_400_000);

  // Define the exact intervals used by dashboardService.getManagementSummary
  const intervals: { id: string; gte?: Date; lte: Date }[] = [
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
  // For each interval, initialize accumulators
  const intervalMap = new Map<
    string,
    {
      grossSales: Decimal;
      netBilling: Decimal;
      taxBilled: Decimal;
      collections: Decimal;
      recognizedRevenue: Decimal;
      recognizedCogs: Decimal;
      operatingExpenses: Decimal;
      outstanding: Decimal;
      incompleteCount: number;
    }
  >();

  for (const inv of intervals) {
    intervalMap.set(inv.id, {
      grossSales: zero(),
      netBilling: zero(),
      taxBilled: zero(),
      collections: zero(),
      recognizedRevenue: zero(),
      recognizedCogs: zero(),
      operatingExpenses: zero(),
      outstanding: zero(),
      incompleteCount: 0,
    });
  }

  // Group legacy refunds by referenceId
  const refundMap = new Map<string, typeof financialData.refunds>();
  for (const r of financialData.refunds) {
    if (r.referenceId) {
      const list = refundMap.get(r.referenceId) || [];
      list.push(r);
      refundMap.set(r.referenceId, list);
    }
  }

  // Single pass over invoices
  for (const invoice of financialData.invoices) {
    const legacyRefunds = refundMap.get(invoice.id) || [];
    // Build events
    const returns = invoice.financialEvents.filter((e) => e.kind === 'RETURN');
    const issues: string[] = [];
    if (invoice.financialEvents.some((e) => !e.occurredAt)) issues.push('Undated HMS collection reconciliation');
    if (
      invoice.channel === 'HMS_LINKED' &&
      !add(
        invoice.financialEvents.filter((e) => e.kind.startsWith('HMS_')),
        (e) => e.collectionDelta
      ).equals(invoice.hmsCollectedAmount)
    )
      issues.push('HMS collection history incomplete');
    const unmatchedRefunds = legacyRefunds.filter((r) => !returns.some((e) => e.reference === r.id));
    if (unmatchedRefunds.length) issues.push('Legacy return lacks dated line/tax detail');

    const originalTotal = invoice.total
      .minus(add(returns, (e) => e.saleDelta))
      .plus(add(unmatchedRefunds, (r) => r.amount));
    const originalTax = invoice.taxTotal.minus(add(returns, (e) => e.taxDelta));
    const originalGross = invoice.subtotal.minus(add(returns, (e) => e.grossDelta));
    const originalDiscount = invoice.discountTotal.minus(add(returns, (e) => e.discountDelta));
    const lineNet = add(invoice.lines, (l) => l.lineNet);
    const discountDifference = lineNet.minus(originalTotal);

    let missingCost = false;
    const events: Array<{
      id: string;
      at: Date;
      sale: Decimal;
      tax: Decimal;
      gross: Decimal;
      cost: Decimal;
      collection: Decimal;
      kind: string;
    }> = [];

    invoice.lines.forEach((l, index) => {
      const rate = l.costRateSnapshot ?? l.batch?.costRate;
      if (rate == null && l.quantity.gt(0)) missingCost = true;
      events.push({
        id: 'line:' + l.id,
        at: invoice.channel === 'RETAIL' ? invoice.createdAt : l.dispensedAt,
        sale: l.lineNet.minus(index === 0 ? discountDifference : zero()),
        tax: l.taxAmount,
        gross: l.quantity.mul(l.rateSnapshot),
        cost: l.quantity.mul(rate ?? 0),
        collection: zero(),
        kind: 'SALE',
      });
    });

    if (!invoice.lines.length) {
      if (originalTotal.gt(0)) missingCost = true;
      events.push({
        id: 'invoice:' + invoice.id,
        at: invoice.createdAt,
        sale: originalTotal,
        tax: originalTax,
        gross: originalGross,
        cost: zero(),
        collection: zero(),
        kind: 'SALE',
      });
    }

    for (const p of invoice.payments) {
      events.push({
        id: 'payment:' + p.id,
        at: p.paidAt,
        sale: zero(),
        tax: zero(),
        gross: zero(),
        cost: zero(),
        collection: p.amount,
        kind: 'PAYMENT',
      });
    }

    for (const e of invoice.financialEvents) {
      if (e.occurredAt) {
        events.push({
          id: e.eventKey,
          at: e.occurredAt,
          sale: e.saleDelta,
          tax: e.taxDelta,
          gross: e.grossDelta,
          cost: e.costDelta,
          collection: e.collectionDelta,
          kind: e.kind,
        });
      }
    }

    for (const r of unmatchedRefunds) {
      events.push({
        id: 'legacy-refund:' + r.id,
        at: r.occurredAt,
        sale: r.amount.negated(),
        tax: zero(),
        gross: zero(),
        cost: zero(),
        collection: r.amount.negated(),
        kind: 'RETURN',
      });
    }

    events.sort(
      (a, b) =>
        a.at.getTime() - b.at.getTime() ||
        (a.kind === 'SALE' ? -1 : b.kind === 'SALE' ? 1 : a.id.localeCompare(b.id))
    );

    const isIncomplete = missingCost || issues.length > 0;

    // Track state over events
    let sale = zero();
    let tax = zero();
    let paid = zero();
    let cost = zero();
    let recognized = zero();
    let recognizedCost = zero();

    // Map each interval's cumulative sale/paid as of interval.lte
    const invSaleAtLte = new Map<string, Decimal>();
    const invPaidAtLte = new Map<string, Decimal>();

    for (const e of events) {
      sale = sale.plus(e.sale);
      tax = tax.plus(e.tax);
      paid = paid.plus(e.collection);
      cost = cost.plus(e.cost);

      const fullyPaid = sale.gt(0) && paid.gte(sale);
      let target = recognized;
      let targetCost = recognizedCost;

      if (fullyPaid) {
        target = Decimal.max(0, sale.minus(tax));
        targetCost = cost;
      } else if (e.kind === 'RETURN') {
        target = Decimal.min(recognized, Decimal.max(0, sale.minus(tax)));
        targetCost = recognizedCost.gt(0) ? Decimal.max(0, recognizedCost.plus(e.cost)) : zero();
      } else if (e.collection.lt(0)) {
        target = zero();
        targetCost = zero();
      }

      const delta = target.minus(recognized);
      const costChange = targetCost.minus(recognizedCost);
      recognized = target;
      recognizedCost = targetCost;

      // Distribute event deltas to intervals matching e.at
      for (const inv of intervals) {
        if ((!inv.gte || e.at >= inv.gte) && (!inv.lte || e.at <= inv.lte)) {
          const acc = intervalMap.get(inv.id)!;
          if (e.kind === 'SALE') acc.grossSales = acc.grossSales.plus(e.gross);
          acc.netBilling = acc.netBilling.plus(e.sale.minus(e.tax));
          acc.taxBilled = acc.taxBilled.plus(e.tax);
          acc.collections = acc.collections.plus(e.collection);
          if (!isIncomplete) {
            acc.recognizedRevenue = acc.recognizedRevenue.plus(delta);
            acc.recognizedCogs = acc.recognizedCogs.plus(costChange);
          }
        }
      }
    }

    // Now calculate outstanding per interval for this invoice
    // Notice an invoice contributes to interval's outstanding if invoice.createdAt <= interval.lte
    for (const inv of intervals) {
      if (!inv.lte || invoice.createdAt <= inv.lte) {
        const acc = intervalMap.get(inv.id)!;
        if (isIncomplete) acc.incompleteCount += 1;
        // Find sale and paid as of inv.lte
        let s = zero();
        let p = zero();
        for (const e of events) {
          if (inv.lte && e.at > inv.lte) continue;
          s = s.plus(e.sale);
          p = p.plus(e.collection);
        }
        const outstanding = Decimal.max(0, s.minus(p));
        acc.outstanding = acc.outstanding.plus(outstanding);
      }
    }
  }

  // Distribute expenses to intervals
  for (const exp of financialData.expenses) {
    for (const inv of intervals) {
      if ((!inv.gte || exp.date >= inv.gte) && (!inv.lte || exp.date <= inv.lte)) {
        const acc = intervalMap.get(inv.id)!;
        acc.operatingExpenses = acc.operatingExpenses.plus(exp.amount);
      }
    }
  }

  const optimizedResults = intervals.map((inv) => {
    const acc = intervalMap.get(inv.id)!;
    const opProfit = acc.incompleteCount > 0 ? null : acc.recognizedRevenue.minus(acc.recognizedCogs).minus(acc.operatingExpenses);
    return {
      id: inv.id,
      totals: {
        grossSales: acc.grossSales,
        netBilling: acc.netBilling,
        taxBilled: acc.taxBilled,
        total: acc.netBilling.plus(acc.taxBilled),
        collections: acc.collections,
        paidTotal: acc.collections,
        netCollected: acc.collections,
        totalRefunded: zero(),
        outstanding: acc.outstanding,
        recognizedRevenue: acc.recognizedRevenue,
        recognizedCogs: acc.recognizedCogs,
        operatingExpenses: acc.operatingExpenses,
        operatingProfit: opProfit,
        incompleteInvoices: acc.incompleteCount,
      },
    };
  });
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
    assert.equal(
      o.operatingProfit === null ? null : o.operatingProfit.toString(),
      b.operatingProfit === null ? null : b.operatingProfit.toString(),
      `${id}: operatingProfit`
    );
    assert.equal(o.incompleteInvoices, b.incompleteInvoices, `${id}: incompleteInvoices`);
  }

  console.log(`PASS! All 38 intervals matched with 100.000% parity across all 11 financial metrics!`);
  await prisma.$disconnect();
}

main().catch(console.error);

