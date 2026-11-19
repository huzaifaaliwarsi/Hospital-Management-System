/**
 * Pharmacy ERP — Batch 1 Financial Accrual Accounting Verification Suite
 * Tests all 8 scenarios mandated by Batch 1 specifications in a live PostgreSQL transaction with automatic rollback.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { financialReport, loadFinancialData } from '../src/modules/reports/financialRecognition';
import { incomeExpenseReport } from '../src/modules/reports/incomeExpense';
import { operatingProfitReport } from '../src/modules/reports/operatingProfit';

const db = new PrismaClient();
const ROLLBACK_ERROR = new Error('ROLLBACK_BATCH1_TEST_TRANSACTION');

let passedTests = 0;
function pass(testName: string) {
  passedTests++;
  console.log(`[PASS] ${testName}`);
}

const dayRange = (dateStr: string) => ({
  gte: new Date(`${dateStr}T00:00:00.000Z`),
  lte: new Date(`${dateStr}T23:59:59.999Z`),
});

const monthRange = (yearMonth: string) => {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { gte: start, lte: end };
};

async function run() {
  console.log('--- STARTING PHARMACY BATCH 1 ACCRUAL FINANCIAL TESTS ---');

  try {
    await db.$transaction(async (tx) => {
      const runId = randomUUID().slice(0, 8);

      // Create test portal user
      const user = await tx.portalUser.create({
        data: {
          username: `user_${runId}`,
          fullName: `Batch1 Auditor ${runId}`,
          passwordHash: 'test-hash-unused',
          role: 'SUPER_ADMIN',
        },
      });

      // Create test unit and medicine
      const unit = await tx.unit.create({
        data: { name: `Unit_${runId}`, shortCode: `u_${runId}` },
      });

      const medicine = await tx.medicineMaster.create({
        data: {
          code: `MED_${runId}`,
          name: `Accrual Test Med ${runId}`,
          unit: 'Tablet',
          baseUnitId: unit.id,
          saleRate: new Prisma.Decimal(100),
          purchaseRate: new Prisma.Decimal(50),
        },
      });

      const batch = await tx.medicineBatch.create({
        data: {
          medicineId: medicine.id,
          batchNumber: `BATCH_${runId}`,
          expiryDate: new Date('2095-12-31'),
          costRate: new Prisma.Decimal(50),
          saleRate: new Prisma.Decimal(100),
        },
      });

      // ─────────────────────────────────────────────────────────────────────────────
      // SCENARIO 1 & 2: Accrual Revenue Recognition & Multi-Date Installments
      // Sale Rs. 1,000 (tax 0), Cost Rs. 500, Paid Rs. 500 on 2092-01-10
      // Balance Rs. 500 paid on 2092-01-20
      // ─────────────────────────────────────────────────────────────────────────────
      const inv1Date = new Date('2092-01-10T10:00:00Z');
      const inv1 = await tx.pharmacyInvoice.create({
        data: {
          invoiceNumber: `INV1-${runId}`,
          channel: 'RETAIL',
          collectionOwner: 'PHARMACY_RETAIL',
          createdAt: inv1Date,
          subtotal: new Prisma.Decimal(1000),
          total: new Prisma.Decimal(1000),
          taxTotal: new Prisma.Decimal(0),
          outstanding: new Prisma.Decimal(500),
          paidTotal: new Prisma.Decimal(500),
          status: 'PARTIALLY_PAID',
          dispensedById: user.id,
          lines: {
            create: {
              medicineId: medicine.id,
              batchId: batch.id,
              quantity: new Prisma.Decimal(10),
              rateSnapshot: new Prisma.Decimal(100),
              lineNet: new Prisma.Decimal(1000),
              taxAmount: new Prisma.Decimal(0),
              costRateSnapshot: new Prisma.Decimal(50),
              dispensedAt: inv1Date,
            },
          },
          payments: {
            create: {
              amount: new Prisma.Decimal(500),
              method: 'CASH',
              collectedById: user.id,
              paidAt: inv1Date,
            },
          },
        },
        include: { lines: true, payments: true },
      });

      // Check Scenario 1: On Sale Date (2092-01-10)
      const dataDay10 = await loadFinancialData(tx, dayRange('2092-01-10'));
      const repDay10 = financialReport(dataDay10, dayRange('2092-01-10'));
      const row1Day10 = repDay10.rows.find((r) => r.invoiceNumber === inv1.invoiceNumber)!;

      assert.ok(row1Day10, 'Scenario 1: Invoice 1 must be present on 2092-01-10');
      assert.equal(row1Day10.recognizedRevenue.toNumber(), 1000, 'Scenario 1: Revenue must be 1,000 on dispense date');
      assert.equal(row1Day10.recognizedCogs.toNumber(), 500, 'Scenario 1: COGS must be 500 on dispense date');
      assert.equal(row1Day10.grossProfit?.toNumber(), 500, 'Scenario 1: Gross profit must be 500');
      assert.equal(row1Day10.collections.toNumber(), 500, 'Scenario 1: Collections must be 500');
      assert.equal(row1Day10.outstanding.toNumber(), 500, 'Scenario 1: Outstanding must be 500');
      pass('Scenario 1: Sale 1,000 / Paid 500 -> Rev 1,000, COGS 500, Gross Profit 500, Outstanding 500');

      // Now pay the second installment Rs. 500 on 2092-01-20
      const pay2Date = new Date('2092-01-20T14:00:00Z');
      await tx.pharmacyPayment.create({
        data: {
          invoiceId: inv1.id,
          amount: new Prisma.Decimal(500),
          method: 'ONLINE',
          collectedById: user.id,
          paidAt: pay2Date,
        },
      });
      await tx.pharmacyInvoice.update({
        where: { id: inv1.id },
        data: {
          paidTotal: new Prisma.Decimal(1000),
          outstanding: new Prisma.Decimal(0),
          status: 'PAID',
        },
      });

      // Check Scenario 2: On Later Installment Date (2092-01-20)
      const dataDay20 = await loadFinancialData(tx, dayRange('2092-01-20'));
      const repDay20 = financialReport(dataDay20, dayRange('2092-01-20'));
      const row1Day20 = repDay20.rows.find((r) => r.invoiceNumber === inv1.invoiceNumber)!;

      assert.ok(row1Day20, 'Scenario 2: Invoice 1 must be loaded on 2092-01-20 for payment projection');
      assert.equal(row1Day20.recognizedRevenue.toNumber(), 0, 'Scenario 2: Revenue on installment date must be 0 (earned at sale)');
      assert.equal(row1Day20.recognizedCogs.toNumber(), 0, 'Scenario 2: COGS on installment date must be 0');
      assert.equal(row1Day20.collections.toNumber(), 500, 'Scenario 2: Collections must be 500');
      assert.equal(row1Day20.outstanding.toNumber(), 0, 'Scenario 2: Outstanding as of 2092-01-20 must be 0');
      pass('Scenario 2: Remaining 500 collected later -> In later period: Rev 0, COGS 0, Collections 500, Due 0');

      // ─────────────────────────────────────────────────────────────────────────────
      // SCENARIO 3: Operating Profit Calculation
      // Sale Rs. 1,000 / COGS Rs. 600 / Opex Rs. 150 -> Operating Profit Rs. 250
      // ─────────────────────────────────────────────────────────────────────────────
      const inv3Date = new Date('2092-02-05T11:00:00Z');
      const inv3 = await tx.pharmacyInvoice.create({
        data: {
          invoiceNumber: `INV3-${runId}`,
          channel: 'RETAIL',
          collectionOwner: 'PHARMACY_RETAIL',
          createdAt: inv3Date,
          subtotal: new Prisma.Decimal(1000),
          total: new Prisma.Decimal(1000),
          taxTotal: new Prisma.Decimal(0),
          outstanding: new Prisma.Decimal(0),
          paidTotal: new Prisma.Decimal(1000),
          status: 'PAID',
          dispensedById: user.id,
          lines: {
            create: {
              medicineId: medicine.id,
              quantity: new Prisma.Decimal(10),
              rateSnapshot: new Prisma.Decimal(100),
              lineNet: new Prisma.Decimal(1000),
              taxAmount: new Prisma.Decimal(0),
              costRateSnapshot: new Prisma.Decimal(60),
              dispensedAt: inv3Date,
            },
          },
          payments: {
            create: {
              amount: new Prisma.Decimal(1000),
              method: 'CASH',
              collectedById: user.id,
              paidAt: inv3Date,
            },
          },
        },
      });

      // Operating expense of Rs. 150
      await tx.expense.create({
        data: {
          expenseNumber: `EXP-${runId}`,
          date: inv3Date,
          category: 'Utilities',
          description: 'Electricity bill',
          amount: new Prisma.Decimal(150),
          paymentMethod: 'CASH',
          enteredById: user.id,
        },
      });

      const opRep = await operatingProfitReport(tx, dayRange('2092-02-05'));
      const rowInv3 = opRep.rows;
      assert.equal(opRep.totals.recognizedRevenue.toNumber(), 1000, 'Scenario 3: Revenue 1,000');
      assert.equal(opRep.totals.recognizedCogs.toNumber(), 600, 'Scenario 3: COGS 600');
      assert.equal(opRep.totals.grossProfit?.toNumber(), 400, 'Scenario 3: Gross Profit 400');
      assert.equal(opRep.totals.operatingExpenses.toNumber(), 150, 'Scenario 3: Operating expenses 150');
      assert.equal(opRep.totals.operatingProfit?.toNumber(), 250, 'Scenario 3: Operating profit 250');
      pass('Scenario 3: Sale 1,000 / COGS 600 / Opex 150 -> Operating Profit 250');

      // ─────────────────────────────────────────────────────────────────────────────
      // SCENARIO 4: Missing Historical Cost Snapshot
      // If cost is missing, preserve null / incomplete; do NOT override to positive profit
      // ─────────────────────────────────────────────────────────────────────────────
      const inv4Date = new Date('2092-02-15T10:00:00Z');
      const inv4 = await tx.pharmacyInvoice.create({
        data: {
          invoiceNumber: `INV4-${runId}`,
          channel: 'RETAIL',
          collectionOwner: 'PHARMACY_RETAIL',
          createdAt: inv4Date,
          subtotal: new Prisma.Decimal(500),
          total: new Prisma.Decimal(500),
          taxTotal: new Prisma.Decimal(0),
          outstanding: new Prisma.Decimal(0),
          paidTotal: new Prisma.Decimal(500),
          status: 'PAID',
          dispensedById: user.id,
          lines: {
            create: {
              medicineId: medicine.id,
              // batchId is null, and costRateSnapshot is null -> missing historical cost!
              quantity: new Prisma.Decimal(5),
              rateSnapshot: new Prisma.Decimal(100),
              lineNet: new Prisma.Decimal(500),
              taxAmount: new Prisma.Decimal(0),
              costRateSnapshot: null,
              dispensedAt: inv4Date,
            },
          },
          payments: {
            create: {
              amount: new Prisma.Decimal(500),
              method: 'CASH',
              collectedById: user.id,
              paidAt: inv4Date,
            },
          },
        },
      });

      const opRep4 = await operatingProfitReport(tx, dayRange('2092-02-15'));
      assert.equal(opRep4.totals.incompleteInvoices, 1, 'Scenario 4: Incomplete invoices count must be 1');
      assert.equal(opRep4.totals.grossProfit, null, 'Scenario 4: Gross profit must be null');
      assert.equal(opRep4.totals.operatingProfit, null, 'Scenario 4: Operating profit must be null');
      pass('Scenario 4: Missing historical cost -> grossProfit: null, operatingProfit: null');

      // ─────────────────────────────────────────────────────────────────────────────
      // SCENARIO 5: Historical Candidate Cutoff Query
      // October invoice paid in November -> When queried at Oct 31, due must be 1,000
      // ─────────────────────────────────────────────────────────────────────────────
      const octDate = new Date('2092-10-15T10:00:00Z');
      const novPayDate = new Date('2092-11-15T14:00:00Z');

      const inv5 = await tx.pharmacyInvoice.create({
        data: {
          invoiceNumber: `INV5-${runId}`,
          channel: 'RETAIL',
          collectionOwner: 'PHARMACY_RETAIL',
          createdAt: octDate,
          subtotal: new Prisma.Decimal(1000),
          total: new Prisma.Decimal(1000),
          taxTotal: new Prisma.Decimal(0),
          outstanding: new Prisma.Decimal(0), // Currently PAID in DB!
          paidTotal: new Prisma.Decimal(1000),
          status: 'PAID',
          dispensedById: user.id,
          lines: {
            create: {
              medicineId: medicine.id,
              batchId: batch.id,
              quantity: new Prisma.Decimal(10),
              rateSnapshot: new Prisma.Decimal(100),
              lineNet: new Prisma.Decimal(1000),
              taxAmount: new Prisma.Decimal(0),
              costRateSnapshot: new Prisma.Decimal(50),
              dispensedAt: octDate,
            },
          },
          payments: {
            create: {
              amount: new Prisma.Decimal(1000),
              method: 'CASH',
              collectedById: user.id,
              paidAt: novPayDate, // Paid in November!
            },
          },
        },
      });

      // Load for October (2092-10-01 to 2092-10-31)
      const dataOct = await loadFinancialData(tx, monthRange('2092-10'));
      const repOct = financialReport(dataOct, monthRange('2092-10'));
      const row5Oct = repOct.rows.find((r) => r.invoiceNumber === inv5.invoiceNumber);

      assert.ok(row5Oct, 'Scenario 5: October invoice must be included in October report even though currently PAID in DB');
      assert.equal(row5Oct.collections.toNumber(), 0, 'Scenario 5: Collections in October must be 0');
      assert.equal(row5Oct.outstanding.toNumber(), 1000, 'Scenario 5: Outstanding on Oct 31 must be 1,000');
      pass('Scenario 5: October invoice paid in Nov -> Oct 31 report correctly shows Outstanding = 1,000');

      // ─────────────────────────────────────────────────────────────────────────────
      // SCENARIO 6: Tax Exclusions & Partial Returns
      // Gross 1,200, Discount 200, Tax 100 -> Total 1,100. Return 1 unit (gross 120, cost 50, tax 10)
      // ─────────────────────────────────────────────────────────────────────────────
      const inv6Date = new Date('2092-03-01T10:00:00Z');
      const retDate = new Date('2092-03-02T12:00:00Z');

      const inv6 = await tx.pharmacyInvoice.create({
        data: {
          invoiceNumber: `INV6-${runId}`,
          channel: 'RETAIL',
          collectionOwner: 'PHARMACY_RETAIL',
          createdAt: inv6Date,
          subtotal: new Prisma.Decimal(900),
          discountTotal: new Prisma.Decimal(0),
          taxTotal: new Prisma.Decimal(90),
          total: new Prisma.Decimal(990),
          outstanding: new Prisma.Decimal(0),
          paidTotal: new Prisma.Decimal(990),
          status: 'PAID',
          dispensedById: user.id,
          lines: {
            create: {
              medicineId: medicine.id,
              batchId: batch.id,
              quantity: new Prisma.Decimal(10),
              rateSnapshot: new Prisma.Decimal(100),
              lineNet: new Prisma.Decimal(1100),
              taxAmount: new Prisma.Decimal(100),
              costRateSnapshot: new Prisma.Decimal(50),
              dispensedAt: inv6Date,
            },
          },
          payments: {
            create: {
              amount: new Prisma.Decimal(1100),
              method: 'CASH',
              collectedById: user.id,
              paidAt: inv6Date,
            },
          },
          financialEvents: {
            create: {
              eventKey: `return_${runId}`,
              occurredAt: retDate,
              kind: 'RETURN',
              saleDelta: new Prisma.Decimal(-110), // -(100 net + 10 tax)
              costDelta: new Prisma.Decimal(-50),  // 1 unit cost reversed
              taxDelta: new Prisma.Decimal(-10),   // 10 tax reversed
              grossDelta: new Prisma.Decimal(-100), // 100 gross reversed
              collectionDelta: new Prisma.Decimal(-110), // refund
            },
          },
        },
      });

      const dataDay1 = await loadFinancialData(tx, dayRange('2092-03-01'));
      const repDay1 = financialReport(dataDay1, dayRange('2092-03-01'));
      const row6Day1 = repDay1.rows.find((r) => r.invoiceNumber === inv6.invoiceNumber)!;

      assert.equal(row6Day1.recognizedRevenue.toNumber(), 1000, 'Scenario 6: Net Revenue excludes tax (1000, not 1100)');
      assert.equal(row6Day1.recognizedCogs.toNumber(), 500, 'Scenario 6: COGS on Day 1 is 500');

      const dataDay2 = await loadFinancialData(tx, dayRange('2092-03-02'));
      const repDay2 = financialReport(dataDay2, dayRange('2092-03-02'));
      const row6Day2 = repDay2.rows.find((r) => r.invoiceNumber === inv6.invoiceNumber)!;

      assert.equal(row6Day2.recognizedRevenue.toNumber(), -100, 'Scenario 6: Revenue reversed on return date is -100');
      assert.equal(row6Day2.recognizedCogs.toNumber(), -50, 'Scenario 6: COGS reversed on return date is -50');
      assert.equal(row6Day2.totalRefunded.toNumber(), 110, 'Scenario 6: Cash refund tracked as 110');
      pass('Scenario 6: Tax excluded from revenue; returns accurately adjust net revenue and batch COGS');

      // ─────────────────────────────────────────────────────────────────────────────
      // SCENARIO 7: Inventory Loss Deduction (Negative Stock Adjustment)
      // Damaged/expired stock negative adjustment of 50 PKR reduces operating profit
      // ─────────────────────────────────────────────────────────────────────────────
      const adjDate = new Date('2092-02-05T15:00:00Z'); // Same day as Scenario 3 (Rev 1000, COGS 600, Opex 150 -> Op Profit was 250)
      await tx.stockLedgerEntry.create({
        data: {
          medicineId: medicine.id,
          batchId: batch.id,
          movementType: 'NEGATIVE_ADJUSTMENT',
          quantityDelta: new Prisma.Decimal(-1), // 1 unit lost
          referenceTable: 'stock_adjustments',
          referenceId: `ADJ-${runId}`,
          note: 'Damaged vial write-off',
          actorId: user.id,
          createdAt: adjDate,
        },
      });

      const opRep7 = await operatingProfitReport(tx, dayRange('2092-02-05'));
      assert.equal(opRep7.totals.inventoryLosses.toNumber(), 50, 'Scenario 7: Inventory loss must be 50 PKR (1 unit * 50 batch cost)');
      assert.equal(opRep7.totals.operatingProfit?.toNumber(), 200, 'Scenario 7: Operating profit must be 200 (250 - 50 loss)');
      pass('Scenario 7: Inventory loss (damaged stock write-off 50 PKR) correctly reduces Operating Profit to 200');

      // ─────────────────────────────────────────────────────────────────────────────
      // SCENARIO 8: 100.00% Parity Assertion Between M01 and M02
      // ─────────────────────────────────────────────────────────────────────────────
      const testRange = {
        gte: new Date('2092-01-01T00:00:00Z'),
        lte: new Date('2092-03-31T23:59:59Z'),
      };

      const m01Rep = await incomeExpenseReport(tx, testRange);
      const m02Rep = await operatingProfitReport(tx, testRange);

      const m01Tot = m01Rep.totals;
      const m02Tot = m02Rep.totals;

      assert.equal(m01Tot.grossSales.toString(), m02Tot.grossSales.toString(), 'Parity: Gross Sales');
      assert.equal(m01Tot.netBilling.toString(), m02Tot.netBilling.toString(), 'Parity: Net Billing');
      assert.equal(m01Tot.collections.toString(), m02Tot.collections.toString(), 'Parity: Collections');
      assert.equal(m01Tot.outstanding.toString(), m02Tot.outstanding.toString(), 'Parity: Outstanding');
      assert.equal(m01Tot.recognizedRevenue.toString(), m02Tot.recognizedRevenue.toString(), 'Parity: Recognized Revenue');
      assert.equal(m01Tot.recognizedCogs.toString(), m02Tot.recognizedCogs.toString(), 'Parity: Recognized COGS');
      assert.equal(m01Tot.operatingExpenses.toString(), m02Tot.operatingExpenses.toString(), 'Parity: Operating Expenses');
      assert.equal(m01Tot.inventoryLosses.toString(), m02Tot.inventoryLosses.toString(), 'Parity: Inventory Losses');
      assert.equal(m01Tot.operatingProfit?.toString(), m02Tot.operatingProfit?.toString(), 'Parity: Operating Profit');

      pass('Scenario 8: 100.000% Mathematical Parity Confirmed Between M01 (Income & Expense) and M02 (Operating Profit)');

      // Always rollback the transaction so no test records pollute the database
      throw ROLLBACK_ERROR;
    });
  } catch (err) {
    if (err === ROLLBACK_ERROR) {
      console.log('\n[CLEANUP] Test transaction rolled back cleanly. No database changes persisted.');
    } else {
      console.error('\n[FAILED] Test execution failed:', err);
      process.exit(1);
    }
  }

  console.log(`\n========================================`);
  console.log(`ALL ${passedTests}/8 REGRESSION SCENARIOS PASSED!`);
  console.log(`========================================\n`);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
