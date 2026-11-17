import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { pharmacyService } from '../src/modules/pharmacy/pharmacy.service';
import { loadFinancialData, financialReport } from '../src/modules/reports/financialRecognition';
import { cashService } from '../src/modules/cash/cash.service';
import { recordHmsCollection } from '../src/modules/hms-requests/hms-requests.service';

const db = new PrismaClient();
const rollback = new Error('ROLLBACK_FINANCIAL_INTEGRITY');
let checks = 0;

function eq(actual: unknown, expected: unknown, label: string) {
  assert.deepEqual(actual, expected, label);
  checks++;
  console.log(`[PASS] ${label}`);
}

const at = (day: number) => new Date(`2026-11-${String(day).padStart(2, '0')}T12:00:00Z`);
const dayRange = (day: number) => ({
  gte: new Date(`2026-11-${String(day).padStart(2, '0')}T00:00:00.000Z`),
  lte: new Date(`2026-11-${String(day).padStart(2, '0')}T23:59:59.999Z`),
});

async function main() {
  console.log('=== STARTING BATCH 6: FINANCIAL INTEGRITY & CANONICAL ACCOUNTING SUITE ===\n');

  try {
    await db.$transaction(async (tx) => {
      const marker = 'FIN-B6-' + randomUUID().slice(0, 8);
      const user = await tx.portalUser.create({
        data: { username: marker, fullName: marker, passwordHash: 'NO-LOGIN', role: 'SUPER_ADMIN' },
      });
      const bank = await tx.paymentAccount.create({ data: { name: `${marker}-Meezan` } });
      const unit = await tx.unit.create({ data: { name: `${marker}-Tab`, shortCode: 'TAB' } });

      // ── EXACT EXAMPLE FROM PROMPT §4 ──
      // 2 tablets, purchase cost PKR 12 each (= 24), fully paid sale PKR 20 with no tax or expenses.
      // Expected: Revenue = 20, COGS = 24, Operating Profit = -4
      const medExample = await tx.medicineMaster.create({
        data: {
          code: `${marker}-EX`,
          name: `${marker}-Example Medicine`,
          unit: 'Tablet',
          baseUnitId: unit.id,
          batchManaged: false,
          saleRate: 10, // 2 * 10 = 20 PKR
          purchaseRate: 12, // 2 * 12 = 24 PKR cost
          taxPercent: 0,
          packagingLevels: {
            create: { unitId: unit.id, level: 0, conversionToBase: 1, isSaleUnit: true, isPurchaseUnit: true },
          },
        },
      });

      await tx.stockLedgerEntry.create({
        data: { medicineId: medExample.id, movementType: 'OPENING_STOCK', quantityDelta: 10, actorId: user.id, referenceTable: 'test', referenceId: medExample.id },
      });

      const saleEx = await pharmacyService.dispenseRetail(
        {
          customerName: 'Prompt Example Patient',
          invoiceDiscount: 0,
          lines: [{ medicineId: medExample.id, saleUnitQuantity: 2, discountAmount: 0 }],
          payments: [{ amount: 20, method: 'CASH' }],
        },
        user.id,
        tx
      );

      await tx.pharmacyInvoice.update({ where: { id: saleEx.id }, data: { createdAt: at(1) } });
      await tx.pharmacyPayment.updateMany({ where: { invoiceId: saleEx.id }, data: { paidAt: at(1) } });
      await tx.cashLedgerEntry.updateMany({ where: { referenceId: saleEx.id }, data: { occurredAt: at(1) } });

      const exData = await loadFinancialData(tx, dayRange(1));
      const exReport = financialReport({ ...exData, invoices: exData.invoices.filter((i) => i.id === saleEx.id) }, dayRange(1));
      eq(Number(exReport.totals.recognizedRevenue), 20, 'Prompt Example: Revenue = 20 PKR');
      eq(Number(exReport.totals.recognizedCogs), 24, 'Prompt Example: COGS = 24 PKR (2 * 12)');
      eq(Number(exReport.totals.operatingProfit), -4, 'Prompt Example: Operating Profit = -4 PKR (loss-making, un-clamped)');

      // ── PARTIAL SALE + SEPARATE REMAINING COLLECTION ROWS (Nov 5 & Nov 16) ──
      const medNormal = await tx.medicineMaster.create({
        data: {
          code: `${marker}-MED-NORM`,
          name: `${marker}-Normal Medicine`,
          unit: 'Tablet',
          baseUnitId: unit.id,
          batchManaged: false,
          saleRate: 100,
          purchaseRate: 50,
          taxPercent: 0,
          packagingLevels: {
            create: { unitId: unit.id, level: 0, conversionToBase: 1, isSaleUnit: true, isPurchaseUnit: true },
          },
        },
      });
      await tx.stockLedgerEntry.create({
        data: { medicineId: medNormal.id, movementType: 'OPENING_STOCK', quantityDelta: 100, actorId: user.id, referenceTable: 'test', referenceId: medNormal.id },
      });

      // Sale on Nov 5: 10 units @ 100 = 1000 PKR, Paid 400
      const salePartial = await pharmacyService.dispenseRetail(
        {
          customerName: 'Patient Installment',
          invoiceDiscount: 0,
          lines: [{ medicineId: medNormal.id, saleUnitQuantity: 10, discountAmount: 0 }],
          payments: [{ amount: 400, method: 'CASH' }],
        },
        user.id,
        tx
      );
      await tx.pharmacyInvoice.update({ where: { id: salePartial.id }, data: { createdAt: at(5) } });
      await tx.pharmacyPayment.updateMany({ where: { invoiceId: salePartial.id }, data: { paidAt: at(5) } });
      await tx.cashLedgerEntry.updateMany({ where: { referenceId: salePartial.id }, data: { occurredAt: at(5) } });

      // Nov 5 report: 0 revenue recognized
      const nov5Report = financialReport(await loadFinancialData(tx, dayRange(5)), dayRange(5));
      eq(Number(nov5Report.totals.grossSales), 1000, 'Nov 5 Gross Sales 1000');
      eq(Number(nov5Report.totals.collections), 400, 'Nov 5 Collections 400');
      eq(Number(nov5Report.totals.outstanding), 600, 'Nov 5 Outstanding 600');
      eq(Number(nov5Report.totals.recognizedRevenue), 0, 'Nov 5 Partial payment recognizes 0 revenue');
      eq(Number(nov5Report.totals.recognizedCogs), 0, 'Nov 5 Partial payment recognizes 0 COGS');

      // Final payment on Nov 16: Remaining 600 paid via BANK
      const keyFinal = randomUUID();
      const payFinal = await pharmacyService.addPayment(
        salePartial.id,
        { amount: 600, method: 'BANK', paymentAccountId: bank.id, requestKey: keyFinal },
        user.id,
        tx
      );
      const pFinal = payFinal.payments.find((p) => p.requestKey === keyFinal)!;
      await tx.pharmacyPayment.update({ where: { id: pFinal.id }, data: { paidAt: at(16) } });
      await tx.cashLedgerEntry.updateMany({ where: { referenceId: salePartial.id, note: 'Receipt PAY-' + pFinal.id }, data: { occurredAt: at(16) } });

      // Verify separate transaction rows
      const txRows = (await pharmacyService.listInvoices({ transactions: 'true' }, tx)).filter(
        (r) => 'invoiceId' in r && r.invoiceId === salePartial.id
      ) as any[];
      eq(txRows.length, 2, 'Two distinct transaction rows: Original Sale and Remaining Collection');
      eq(
        txRows.map((r) => [r.transactionType, r.billingAmount, r.collectedAmount, r.outstanding]),
        [
          ['Remaining Collection', 0, 600, 0],
          ['Original Sale', 1000, 400, 0],
        ],
        'Correct distinct billing and collected amounts on rows with current zero outstanding'
      );

      // Nov 16 report: Revenue recognized ON NOV 16
      const nov16Data = await loadFinancialData(tx, dayRange(16));
      const nov16Report = financialReport({ ...nov16Data, invoices: nov16Data.invoices.filter((i) => i.id === salePartial.id) }, dayRange(16));
      eq(Number(nov16Report.totals.grossSales), 0, 'Nov 16 New Gross Sales 0');
      eq(Number(nov16Report.totals.collections), 600, 'Nov 16 Collections 600');
      eq(Number(nov16Report.totals.recognizedRevenue), 1000, 'Nov 16 Full Revenue 1000 recognized on clearance date');
      eq(Number(nov16Report.totals.recognizedCogs), 500, 'Nov 16 Matched COGS 500 recognized on clearance date');
      eq(Number(nov16Report.totals.operatingProfit), 500, 'Nov 16 Operating Profit 500');

      // ── TAX EXCLUSION FROM REVENUE ──
      const medTax = await tx.medicineMaster.create({
        data: {
          code: `${marker}-TAX`,
          name: `${marker}-Taxed Medicine`,
          unit: 'Tablet',
          baseUnitId: unit.id,
          batchManaged: false,
          saleRate: 100,
          purchaseRate: 40,
          taxPercent: 15, // 15% tax
          packagingLevels: {
            create: { unitId: unit.id, level: 0, conversionToBase: 1, isSaleUnit: true, isPurchaseUnit: true },
          },
        },
      });
      await tx.stockLedgerEntry.create({
        data: { medicineId: medTax.id, movementType: 'OPENING_STOCK', quantityDelta: 50, actorId: user.id, referenceTable: 'test', referenceId: medTax.id },
      });

      // 10 units @ 100 = 1000 + 150 tax = 1150 PKR
      const saleTax = await pharmacyService.dispenseRetail(
        {
          customerName: 'Patient Tax',
          invoiceDiscount: 0,
          lines: [{ medicineId: medTax.id, saleUnitQuantity: 10, discountAmount: 0 }],
          payments: [{ amount: 1150, method: 'CASH' }],
        },
        user.id,
        tx
      );
      await tx.pharmacyInvoice.update({ where: { id: saleTax.id }, data: { createdAt: at(20) } });
      await tx.pharmacyPayment.updateMany({ where: { invoiceId: saleTax.id }, data: { paidAt: at(20) } });
      await tx.cashLedgerEntry.updateMany({ where: { referenceId: saleTax.id }, data: { occurredAt: at(20) } });

      const taxData = await loadFinancialData(tx, dayRange(20));
      const taxReport = financialReport({ ...taxData, invoices: taxData.invoices.filter((i) => i.id === saleTax.id) }, dayRange(20));
      eq(Number(taxReport.totals.total), 1150, 'Tax Sale Total Invoiced 1150 (net 1000 + tax 150)');
      eq(Number(taxReport.totals.taxBilled), 150, 'Tax liability 150 recorded');
      eq(Number(taxReport.totals.recognizedRevenue), 1000, 'Tax is STRICTLY EXCLUDED from Recognized Revenue (1000 PKR, not 1150)');

      // ── VENDOR PAYMENTS EXCLUDED FROM OPERATING EXPENSES ──
      const vendor = await tx.vendor.create({ data: { name: `${marker}-PharmaDist`, code: `${marker}-V` } });
      await tx.vendorLedgerEntry.create({
        data: { vendorId: vendor.id, entryType: 'PURCHASE_CREDIT', amount: 8000, description: 'Bulk order', actorId: user.id, createdAt: at(22) },
      });
      await tx.vendorLedgerEntry.create({
        data: { vendorId: vendor.id, entryType: 'PAYMENT', amount: -8000, description: 'Settlement', actorId: user.id, createdAt: at(22) },
      });

      const { incomeExpenseReport } = await import('../src/modules/reports/incomeExpense');
      const ieVendor = await incomeExpenseReport(tx, dayRange(22));
      eq(Number(ieVendor.totals.operatingExpenses), 0, 'Vendor payment 8000 PKR is NOT an operating expense');
      eq(Number(ieVendor.totals.vendorPayments), 8000, 'Vendor payment 8000 PKR reported strictly in Vendor Settlements');

      // ── USER-WISE CASH BALANCE SHEET & DRAWER SETTLEMENT ──
      const drawerExpected = await cashService.expectedCash(user.id, tx);
      // Collections: 20 (SaleEx) + 400 (SalePartial) + 1150 (SaleTax) = 1570 PKR CASH (SalePartial final was BANK)
      eq(Number(drawerExpected), 1570, 'User-wise physical cash drawer expected is 1570 PKR');

      // Submit account settlement
      const settlement = await cashService.submitSettlement(
        user.id,
        {
          periodFrom: at(1),
          periodTo: at(25),
          expectedCash: 1570,
          physicalCash: 1570,
          varianceReason: 'Exact match',
          settlementAmount: 1570,
        },
        tx
      );
      eq(settlement.status, 'SUBMITTED', 'Account settlement successfully submitted');
      eq(Number(settlement.variance), 0, 'Zero settlement variance');

      // ── HMS-LINKED DISPENSE & INTEGRATION RECONCILIATION ──
      const hmsInv = await tx.pharmacyInvoice.create({
        data: {
          invoiceNumber: `${marker}-HMS-01`,
          channel: 'HMS_LINKED',
          collectionOwner: 'HMS_FRONT_DESK',
          createdAt: at(24),
          subtotal: 500,
          total: 500,
          outstanding: 500,
          clearanceStatus: 'OUTSTANDING',
          dispensedById: user.id,
        },
      });

      // Record HMS front desk collection callback
      await recordHmsCollection(hmsInv.invoiceNumber, new Prisma.Decimal(500), false, `${marker}-HMS-REC-1`, at(24), 'CASH', 'Hospital Cashier', tx);
      const hmsSaved = await tx.pharmacyInvoice.findUniqueOrThrow({ where: { id: hmsInv.id } });
      eq(Number(hmsSaved.hmsCollectedAmount), 500, 'HMS collection callback recorded 500 PKR');
      eq(hmsSaved.clearanceStatus, 'CLEARED', 'HMS invoice marked CLEARED upon full payment');

      console.log('Rolling back financial integrity test transaction...');
      throw rollback;
    });
  } catch (err: any) {
    if (err !== rollback) throw err;
  }

  await db.$disconnect();
  console.log(`\n=== ALL ${checks} FINANCIAL INTEGRITY & ACCOUNTING ASSERTIONS PASSED! ===\n`);
}

main().catch((err) => {
  console.error('FAILED FINANCIAL INTEGRITY ASSERTIONS:', err);
  process.exit(1);
});
