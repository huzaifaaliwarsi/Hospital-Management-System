import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { pharmacyService } from '../src/modules/pharmacy/pharmacy.service';
import { loadFinancialData, financialReport } from '../src/modules/reports/financialRecognition';
import { dashboardService } from '../src/modules/dashboard/dashboard.service';
import { reportsService } from '../src/modules/reports/reports.service';

const db = new PrismaClient();
const rollback = new Error('ROLLBACK_BATCH5_REPORTING_TEST');
const at = (day: number) => new Date(`2026-11-${String(day).padStart(2, '0')}T12:00:00Z`);
const dayRange = (day: number) => ({
  gte: new Date(`2026-11-${String(day).padStart(2, '0')}T00:00:00.000Z`),
  lte: new Date(`2026-11-${String(day).padStart(2, '0')}T23:59:59.999Z`),
});
let passCount = 0;

function eq(actual: unknown, expected: unknown, label: string) {
  assert.deepEqual(actual, expected, label);
  passCount++;
  console.log(`[PASS] ${label}`);
}

async function main() {
  console.log('=== STARTING BATCH 5 COMPREHENSIVE FINANCIAL & REPORTING VERIFICATION ===');
  try {
    await db.$transaction(async (tx) => {
      const marker = 'B5-' + randomUUID();
      const admin = await tx.portalUser.create({
        data: { username: marker + '-admin', fullName: marker + '-Admin', passwordHash: 'NO-LOGIN', role: 'SUPER_ADMIN' },
      });
      const cashier = await tx.portalUser.create({
        data: { username: marker + '-cashier', fullName: marker + '-Cashier', passwordHash: 'NO-LOGIN', role: 'SALES_DISPENSING' },
      });
      const bank = await tx.paymentAccount.create({ data: { name: marker + '-Bank' } });
      const unit = await tx.unit.create({ data: { name: marker + '-Unit', shortCode: marker.slice(-6) } });
      
      // Medicine 1: Normal profit (sale: 1000, cost: 600)
      const medNormal = await tx.medicineMaster.create({
        data: {
          code: marker + '-MED1',
          name: marker + '-Paracetamol',
          unit: 'Tablet',
          baseUnitId: unit.id,
          batchManaged: false,
          saleRate: 100,
          purchaseRate: 60,
          packagingLevels: { create: { unitId: unit.id, conversionToBase: 1, isSaleUnit: true, level: 0 } },
        },
      });
      await tx.stockLedgerEntry.create({
        data: { medicineId: medNormal.id, movementType: 'OPENING_STOCK', quantityDelta: 500, actorId: admin.id, referenceTable: 'test_fixture', referenceId: medNormal.id },
      });

      // Medicine 2: Loss-making medicine (sale: 50, cost: 80 -> cost > sale)
      const medLoss = await tx.medicineMaster.create({
        data: {
          code: marker + '-MED2',
          name: marker + '-Subsidized',
          unit: 'Tablet',
          baseUnitId: unit.id,
          batchManaged: false,
          saleRate: 50,
          purchaseRate: 80,
          packagingLevels: { create: { unitId: unit.id, conversionToBase: 1, isSaleUnit: true, level: 0 } },
        },
      });
      await tx.stockLedgerEntry.create({
        data: { medicineId: medLoss.id, movementType: 'OPENING_STOCK', quantityDelta: 500, actorId: admin.id, referenceTable: 'test_fixture', referenceId: medLoss.id },
      });

      // ── SCENARIO A: Partial Sale on Nov 1 (Billed 1000, Paid 400) ──
      const saleA = await pharmacyService.dispenseRetail(
        { customerName: marker + '-PatientA', invoiceDiscount: 0, lines: [{ medicineId: medNormal.id, saleUnitQuantity: 10, discountAmount: 0 }], payments: [{ amount: 400, method: 'CASH' }] },
        cashier.id,
        tx
      );
      await tx.pharmacyInvoice.update({ where: { id: saleA.id }, data: { createdAt: at(1) } });
      await tx.pharmacyPayment.updateMany({ where: { invoiceId: saleA.id }, data: { paidAt: at(1) } });
      await tx.cashLedgerEntry.updateMany({ where: { referenceId: saleA.id }, data: { occurredAt: at(1) } });

      const day1Report = financialReport(await loadFinancialData(tx, dayRange(1)), dayRange(1), {});
      eq(Number(day1Report.totals.grossSales), 1000, 'A: Nov 1 Gross Sales 1000');
      eq(Number(day1Report.totals.netBilling), 1000, 'A: Nov 1 Net Billing 1000');
      eq(Number(day1Report.totals.collections), 400, 'A: Nov 1 Collections 400');
      eq(Number(day1Report.totals.outstanding), 600, 'A: Nov 1 Outstanding 600');
      eq(Number(day1Report.totals.recognizedRevenue), 0, 'A: Partial Sale recognizes 0 revenue');
      eq(Number(day1Report.totals.recognizedCogs), 0, 'A: Partial Sale recognizes 0 COGS');

      // ── SCENARIO B: Second installment on Nov 5 (Paid 300) ──
      const key2 = randomUUID();
      const pay2 = await pharmacyService.addPayment(saleA.id, { amount: 300, method: 'ONLINE', paymentAccountId: bank.id, requestKey: key2 }, cashier.id, tx);
      const p2 = pay2.payments.find((p) => p.requestKey === key2)!;
      await tx.pharmacyPayment.update({ where: { id: p2.id }, data: { paidAt: at(5) } });
      await tx.cashLedgerEntry.updateMany({ where: { referenceId: saleA.id, note: 'Receipt PAY-' + p2.id }, data: { occurredAt: at(5) } });

      const day5Report = financialReport(await loadFinancialData(tx, dayRange(5)), dayRange(5), {});
      eq(Number(day5Report.totals.grossSales), 0, 'B: Nov 5 New Gross Sales 0');
      eq(Number(day5Report.totals.collections), 300, 'B: Nov 5 Collections 300');
      eq(Number(day5Report.totals.outstanding), 300, 'B: Nov 5 Outstanding 300');
      eq(Number(day5Report.totals.recognizedRevenue), 0, 'B: Still partial -> 0 revenue');

      // ── SCENARIO C: Final Clearance on Nov 10 (Paid 300) -> Full Recognition! ──
      const key3 = randomUUID();
      const pay3 = await pharmacyService.addPayment(saleA.id, { amount: 300, method: 'BANK', paymentAccountId: bank.id, requestKey: key3 }, cashier.id, tx);
      const p3 = pay3.payments.find((p) => p.requestKey === key3)!;
      await tx.pharmacyPayment.update({ where: { id: p3.id }, data: { paidAt: at(10) } });
      await tx.cashLedgerEntry.updateMany({ where: { referenceId: saleA.id, note: 'Receipt PAY-' + p3.id }, data: { occurredAt: at(10) } });

      const day10Report = financialReport(await loadFinancialData(tx, dayRange(10)), dayRange(10), {});
      eq(Number(day10Report.totals.grossSales), 0, 'C: Nov 10 New Gross Sales 0');
      eq(Number(day10Report.totals.collections), 300, 'C: Nov 10 Collections 300');
      eq(Number(day10Report.totals.outstanding), 0, 'C: Nov 10 Outstanding 0 (fully cleared)');
      eq(Number(day10Report.totals.recognizedRevenue), 1000, 'C: Nov 10 Recognized Revenue 1000 on final clearance');
      eq(Number(day10Report.totals.recognizedCogs), 600, 'C: Nov 10 Matched COGS 600 recognized on clearance date');
      eq(Number(day10Report.totals.operatingProfit), 400, 'C: Nov 10 Operating Profit 400 recognized on clearance date');

      // Day 11: No repeated recognition
      const day11Report = financialReport(await loadFinancialData(tx, dayRange(11)), dayRange(11), {});
      eq(Number(day11Report.totals.recognizedRevenue), 0, 'C: Nov 11 zero repeated revenue');
      eq(Number(day11Report.totals.recognizedCogs), 0, 'C: Nov 11 zero repeated COGS');

      // ── SCENARIO D: Loss-Making Sale (Cost: 800 > Revenue: 500) ──
      const saleLoss = await pharmacyService.dispenseRetail(
        { customerName: marker + '-PatientLoss', invoiceDiscount: 0, lines: [{ medicineId: medLoss.id, saleUnitQuantity: 10, discountAmount: 0 }], payments: [{ amount: 500, method: 'CASH' }] },
        cashier.id,
        tx
      );
      await tx.pharmacyInvoice.update({ where: { id: saleLoss.id }, data: { createdAt: at(12) } });
      await tx.pharmacyPayment.updateMany({ where: { invoiceId: saleLoss.id }, data: { paidAt: at(12) } });
      await tx.cashLedgerEntry.updateMany({ where: { referenceId: saleLoss.id }, data: { occurredAt: at(12) } });

      const day12Report = financialReport(await loadFinancialData(tx, dayRange(12)), dayRange(12), {});
      eq(Number(day12Report.totals.recognizedRevenue), 500, 'D: Loss-making sale recognized revenue 500');
      eq(Number(day12Report.totals.recognizedCogs), 800, 'D: Loss-making sale recognized COGS 800');
      eq(Number(day12Report.totals.operatingProfit), -300, 'D: Operating profit is NEGATIVE (-300), not clamped to zero');

      // ── SCENARIO E: Sales Return on Nov 15 (Refund 100, Restock 1 unit) ──
      const originalLines = await tx.pharmacyInvoiceLine.findMany({ where: { invoiceId: saleA.id } });
      const refund = await pharmacyService.salesReturn(
        { invoiceId: saleA.id, requestKey: randomUUID(), reason: 'Customer return', refundMethod: 'BANK', paymentAccountId: bank.id, lines: [{ invoiceLineId: originalLines[0]!.id, quantity: 1, restock: true }] },
        admin.id,
        tx
      );
      await tx.pharmacyFinancialEvent.updateMany({ where: { reference: refund.cashLedgerEntryId }, data: { occurredAt: at(15) } });
      await tx.cashLedgerEntry.updateMany({ where: { id: refund.cashLedgerEntryId }, data: { occurredAt: at(15) } });

      const day15Report = financialReport(await loadFinancialData(tx, dayRange(15)), dayRange(15), {});
      eq(Number(day15Report.totals.recognizedRevenue), -100, 'E: Nov 15 Return reverses recognized revenue by -100');
      eq(Number(day15Report.totals.recognizedCogs), -60, 'E: Nov 15 Return reverses recognized COGS by -60');
      eq(Number(day15Report.totals.collections), -100, 'E: Nov 15 Collections reduced by -100 refund');

      // ── SCENARIO F: Vendor Payment on Nov 18 (PKR 5000) ──
      const vendor = await tx.vendor.create({ data: { name: marker + '-Vendor', code: marker + '-V1', paymentTermsDays: 30 } });
      await tx.vendorLedgerEntry.create({
        data: { vendorId: vendor.id, entryType: 'PURCHASE_CREDIT', amount: 5000, description: 'Stock Purchase', actorId: admin.id, createdAt: at(17) },
      });
      await tx.vendorLedgerEntry.create({
        data: { vendorId: vendor.id, entryType: 'PAYMENT', amount: -5000, description: 'Vendor Settlement', actorId: admin.id, createdAt: at(18) },
      });

      // Operating expenses on Nov 18: Electricity 200 PKR
      await tx.expense.create({
        data: {
          expenseNumber: marker + '-EXP1',
          category: 'Utilities',
          date: at(18),
          amount: 200,
          paymentMethod: 'CASH',
          description: 'Electricity bill',
          enteredById: admin.id,
        },
      });

      const day18Report = financialReport(await loadFinancialData(tx, dayRange(18)), dayRange(18), {});
      eq(Number(day18Report.totals.operatingExpenses), 200, 'F: Operating expense is ONLY electricity (200 PKR)');
      eq(Number(day18Report.totals.operatingProfit), -200, 'F: Vendor payment 5000 is EXCLUDED from operating expenses');

      // ── SCENARIO G: Cashier Drawer Segregation ──
      const cashierSales = await tx.pharmacyPayment.groupBy({
        by: ['method'],
        where: {
          collectedById: cashier.id,
          paidAt: { gte: at(1), lte: at(20) },
        },
        _sum: { amount: true },
      });
      const cashierCash = cashierSales.find((p) => p.method === 'CASH')?._sum.amount ?? 0;
      eq(Number(cashierCash), 900, 'G: Cashier collected exactly 400 (SaleA) + 500 (SaleLoss) = 900 cash');

      // ── SCENARIO H: Income & Expense and Operating Profit Reports with Scoped Data ──
      const { incomeExpenseReport } = await import('../src/modules/reports/incomeExpense');
      const { operatingProfitReport } = await import('../src/modules/reports/operatingProfit');

      const ieReport = await incomeExpenseReport(tx, dayRange(18));
      eq(Number(ieReport.totals.operatingExpenses), 200, 'H: Income/Expense report operating expenses 200');
      eq(Number(ieReport.totals.vendorPayments), 5000, 'H: Income/Expense report vendor payments 5000 (segregated)');

      const opReport = await operatingProfitReport(tx, dayRange(10));
      eq(Number(opReport.totals.recognizedRevenue), 1000, 'H: Operating Profit report recognized revenue 1000 on clearance day');
      eq(Number(opReport.totals.grossProfit), 400, 'H: Operating Profit report gross profit 400 on clearance day');
      eq(Number(opReport.totals.operatingProfit), 400, 'H: Operating Profit report net operating profit 400');

      console.log('Rolling back all test transactions...');
      throw rollback;
    });
  } catch (err: any) {
    if (err !== rollback) throw err;
  }

  // ── SCENARIO I: Live Dashboard & Report Suite Verification ──
  const admin = await db.portalUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (admin) {
    const mgmt = await dashboardService.getManagementSummary(admin.id);
    assert.ok(mgmt.salesToday !== undefined, 'Live Mgmt salesToday present');
    assert.ok(mgmt.monthlyTrend.length === 6, 'Live Mgmt monthlyTrend has 6 months');
    assert.ok(mgmt.dailyTrend.length === 30, 'Live Mgmt dailyTrend has 30 days');
    passCount += 3;
    console.log('[PASS] I: Live Management Dashboard structure verified');

    const sales = await dashboardService.getSalesSummary(admin.id);
    assert.ok(sales.cashCollectionToday !== undefined, 'Live Sales cashCollectionToday present');
    assert.ok(sales.cardOnlineCollectionToday !== undefined, 'Live Sales cardOnlineCollectionToday present');
    passCount += 2;
    console.log('[PASS] I: Live Sales Dashboard structure verified');

    const allReports = [
      'INCOME_EXPENSE',
      'OPERATING_PROFIT',
      'SALES_COLLECTION',
      'HMS_DISPENSE',
      'PURCHASE',
      'STOCK_MOVEMENT',
      'VENDOR_LEDGER',
      'EXPENSE',
      'RETURN_REFUND',
      'BALANCE_SETTLEMENT',
    ] as const;

    for (const rType of allReports) {
      const res = await reportsService.run({ type: rType });
      assert.ok(Array.isArray(res.rows), `Report ${rType} returns rows array`);
      passCount++;
      console.log(`[PASS] I: Report ${rType} executed successfully (${res.rows.length} rows)`);
    }
  }

  await db.$disconnect();
  console.log(`\n=== ALL ${passCount} BATCH 5 FINANCIAL & REPORTING ASSERTIONS PASSED! ===\n`);
}

main().catch((err) => {
  console.error('FAILED BATCH 5 ASSERTIONS:', err);
  process.exit(1);
});
