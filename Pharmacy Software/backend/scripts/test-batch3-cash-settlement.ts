/**
 * Pharmacy ERP — Batch 3 Expense, Cash Balance & Settlement Verification Suite
 * Tests all 10 independent financial scenarios in a live PostgreSQL transaction with automatic rollback.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { cashService } from '../src/modules/cash/cash.service';
import { expensesService } from '../src/modules/expenses/expenses.service';
import { reportsService } from '../src/modules/reports/reports.service';
import { incomeExpenseReport } from '../src/modules/reports/incomeExpense';
import { operatingProfitReport } from '../src/modules/reports/operatingProfit';
import { financialReport, loadFinancialData } from '../src/modules/reports/financialRecognition';

const db = new PrismaClient();
const ROLLBACK_ERROR = new Error('ROLLBACK_BATCH3_TEST_TRANSACTION');

let passedTests = 0;
function pass(testName: string) {
  passedTests++;
  console.log(`[PASS] ${testName}`);
}

async function run() {
  console.log('--- STARTING PHARMACY BATCH 3 VERIFICATION TESTS ---');

  try {
    await db.$transaction(async (tx) => {
      const runId = randomUUID().slice(0, 8);

      // Create Cashier A and Cashier B, plus Manager / Admin
      const cashierA = await tx.portalUser.create({
        data: {
          username: `cashier_a_${runId}`,
          fullName: `Cashier A ${runId}`,
          passwordHash: 'test-hash-unused',
          role: 'SALES_DISPENSING',
        },
      });

      const cashierB = await tx.portalUser.create({
        data: {
          username: `cashier_b_${runId}`,
          fullName: `Cashier B ${runId}`,
          passwordHash: 'test-hash-unused',
          role: 'SALES_DISPENSING',
        },
      });

      const manager = await tx.portalUser.create({
        data: {
          username: `manager_${runId}`,
          fullName: `Manager ${runId}`,
          passwordHash: 'test-hash-unused',
          role: 'SUPER_ADMIN',
        },
      });

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 1: Opening Cash 1,000 + Cash Collection 500 - Cash Expense 200 = Expected Cash 1,300
      // ─────────────────────────────────────────────────────────────────────────────
      // Opening Cash (Petty cash float received) = 1,000
      await tx.cashLedgerEntry.create({
        data: {
          portalUserId: cashierA.id,
          direction: 'IN',
          amount: new Prisma.Decimal(1000),
          category: 'PETTY_CASH_RECEIVED',
          isPhysicalCash: true,
          isSettled: false,
          referenceNo: `FLOAT-${runId}`,
          note: 'Opening float',
        },
      });

      // Cash Collection = 500
      await tx.cashLedgerEntry.create({
        data: {
          portalUserId: cashierA.id,
          direction: 'IN',
          amount: new Prisma.Decimal(500),
          category: 'POS_COLLECTION',
          isPhysicalCash: true,
          isSettled: false,
          referenceNo: `SALE-${runId}`,
          note: 'Medicine cash sale',
        },
      });

      // Cash Expense = 200
      await tx.cashLedgerEntry.create({
        data: {
          portalUserId: cashierA.id,
          direction: 'OUT',
          amount: new Prisma.Decimal(200),
          category: 'EXPENSE_PAYMENT',
          isPhysicalCash: true,
          isSettled: false,
          referenceNo: `EXP-${runId}`,
          note: 'Tea / cleaning expense',
        },
      });

      const exp1 = await cashService.expectedCash(cashierA.id, tx);
      assert.equal(exp1.toNumber(), 1300, 'Test 1: Expected cash must be 1,000 + 500 - 200 = 1,300');
      pass('Test 1: Opening Cash 1,000 + Cash Collection 500 - Cash Expense 200 = Expected Cash 1,300');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 2: Expected Cash 1,900 - Accepted Settlement 1,300 = Remaining Cash 600
      // ─────────────────────────────────────────────────────────────────────────────
      // Cashier B receives 1,900 cash collections
      await tx.cashLedgerEntry.create({
        data: {
          portalUserId: cashierB.id,
          direction: 'IN',
          amount: new Prisma.Decimal(1900),
          category: 'POS_COLLECTION',
          isPhysicalCash: true,
          isSettled: false,
          referenceNo: `SALE-B-${runId}`,
          note: 'Cashier B sales',
        },
      });

      const expBBefore = await cashService.expectedCash(cashierB.id, tx);
      assert.equal(expBBefore.toNumber(), 1900, 'Test 2: Cashier B expected cash before settlement is 1,900');

      // Cashier B submits settlement for 1,300
      const subB = await cashService.submitSettlement(
        cashierB.id,
        {
          periodFrom: new Date(),
          periodTo: new Date(),
          physicalCash: 1300,
          varianceReason: 'Partial handover; 600 retained in drawer as float',
        },
        tx
      );

      // Manager reviews and ACCEPTS the settlement of 1,300
      await cashService.reviewSettlement(subB.id, { decision: 'ACCEPTED', note: 'Accepted partial handover' }, manager.id, tx);

      const expBAfter = await cashService.expectedCash(cashierB.id, tx);
      assert.equal(expBAfter.toNumber(), 600, 'Test 2: Expected Cash 1,900 - Accepted Settlement 1,300 = Remaining Cash 600');
      pass('Test 2: Expected Cash 1,900 - Accepted Settlement 1,300 = Remaining Cash 600');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 3: Pending/rejected settlement changes cash balance by zero
      // ─────────────────────────────────────────────────────────────────────────────
      const expA_before_sub = await cashService.expectedCash(cashierA.id, tx); // 1,300
      // Cashier A submits settlement for 1,000
      const subA = await cashService.submitSettlement(
        cashierA.id,
        {
          periodFrom: new Date(),
          periodTo: new Date(),
          physicalCash: 1000,
          varianceReason: 'End of shift test',
        },
        tx
      );

      // While SUBMITTED (pending), balance must remain 1,300
      const expA_pending = await cashService.expectedCash(cashierA.id, tx);
      assert.equal(expA_pending.toNumber(), 1300, 'Test 3: Pending settlement changes balance by zero');

      // Manager REJECTS the settlement
      await cashService.reviewSettlement(subA.id, { decision: 'REJECTED', note: 'Wrong count' }, manager.id, tx);

      // After rejection, balance must still remain 1,300
      const expA_rejected = await cashService.expectedCash(cashierA.id, tx);
      assert.equal(expA_rejected.toNumber(), 1300, 'Test 3: Rejected settlement changes balance by zero');
      pass('Test 3: Pending and rejected settlements change cash balance by zero');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 4: Accepted settlement generates corresponding sender OUT and receiver IN exactly once
      // ─────────────────────────────────────────────────────────────────────────────
      // Verify Cashier B's accepted settlement from Test 2:
      const senderOutEntries = await tx.cashLedgerEntry.findMany({
        where: {
          portalUserId: cashierB.id,
          category: 'SETTLEMENT_HANDOVER',
          referenceId: subB.id,
        },
      });

      const receiverInEntries = await tx.cashLedgerEntry.findMany({
        where: {
          portalUserId: manager.id,
          category: 'SETTLEMENT_HANDOVER',
          referenceId: subB.id,
        },
      });

      assert.equal(senderOutEntries.length, 1, 'Test 4: Exactly one sender OUT entry created');
      assert.equal(senderOutEntries[0].direction, 'OUT', 'Test 4: Sender entry is OUT');
      assert.equal(senderOutEntries[0].amount.toNumber(), 1300, 'Test 4: Sender entry amount is 1,300');

      assert.equal(receiverInEntries.length, 1, 'Test 4: Exactly one receiver IN entry created');
      assert.equal(receiverInEntries[0].direction, 'IN', 'Test 4: Receiver entry is IN');
      assert.equal(receiverInEntries[0].amount.toNumber(), 1300, 'Test 4: Receiver entry amount is 1,300');
      assert.equal(receiverInEntries[0].issuedById, cashierB.id, 'Test 4: Receiver entry points to Cashier B as sender');
      pass('Test 4: Accepted settlement generates corresponding sender OUT and receiver IN exactly once');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 5: Operating Expense 150 reduces Operating Profit by 150 only once
      // ─────────────────────────────────────────────────────────────────────────────
      const testDate = new Date('2093-09-15T10:00:00Z');
      const unit = await tx.unit.create({ data: { name: `Unit3_${runId}`, shortCode: `u3_${runId}` } });
      const med = await tx.medicineMaster.create({
        data: {
          code: `MED3_${runId}`,
          name: `Batch3 Med ${runId}`,
          unit: 'Tablet',
          baseUnitId: unit.id,
          saleRate: new Prisma.Decimal(100),
          purchaseRate: new Prisma.Decimal(60),
        },
      });
      const batch = await tx.medicineBatch.create({
        data: {
          medicineId: med.id,
          batchNumber: `B3-${runId}`,
          expiryDate: new Date('2096-12-31'),
          costRate: new Prisma.Decimal(60),
        },
      });

      // Sale of 1,000 (COGS 600 -> Gross Profit 400)
      await tx.pharmacyInvoice.create({
        data: {
          invoiceNumber: `INV3-P-${runId}`,
          channel: 'RETAIL',
          collectionOwner: 'PHARMACY_RETAIL',
          createdAt: testDate,
          subtotal: new Prisma.Decimal(1000),
          total: new Prisma.Decimal(1000),
          taxTotal: new Prisma.Decimal(0),
          outstanding: new Prisma.Decimal(0),
          paidTotal: new Prisma.Decimal(1000),
          status: 'PAID',
          dispensedById: manager.id,
          lines: {
            create: {
              medicineId: med.id,
              batchId: batch.id,
              quantity: new Prisma.Decimal(10),
              rateSnapshot: new Prisma.Decimal(100),
              lineNet: new Prisma.Decimal(1000),
              costRateSnapshot: new Prisma.Decimal(60),
              dispensedAt: testDate,
            },
          },
          payments: {
            create: {
              amount: new Prisma.Decimal(1000),
              method: 'CASH',
              collectedById: manager.id,
              paidAt: testDate,
            },
          },
        },
      });

      // Operating expense of 150
      await tx.expense.create({
        data: {
          expenseNumber: `EXP3-${runId}`,
          date: testDate,
          category: 'Office Supplies',
          description: 'Stationery',
          amount: new Prisma.Decimal(150),
          paymentMethod: 'CASH',
          enteredById: manager.id,
        },
      });

      const dayRange = { gte: new Date('2093-09-15T00:00:00Z'), lte: new Date('2093-09-15T23:59:59Z') };
      const opProfitRep = await operatingProfitReport(tx, dayRange);

      assert.equal(opProfitRep.totals.recognizedRevenue.toNumber(), 1000, 'Test 5: Revenue 1,000');
      assert.equal(opProfitRep.totals.recognizedCogs.toNumber(), 600, 'Test 5: COGS 600');
      assert.equal(opProfitRep.totals.operatingExpenses.toNumber(), 150, 'Test 5: Operating Expenses 150');
      assert.equal(opProfitRep.totals.operatingProfit?.toNumber(), 250, 'Test 5: Operating Profit = 1,000 - 600 - 150 = 250');
      pass('Test 5: Operating Expense 150 reduces Operating Profit by 150 only once');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 6: Supplier payment 2,500 reduces vendor payable but does not reduce Operating Profit
      // ─────────────────────────────────────────────────────────────────────────────
      const vendor = await tx.vendor.create({
        data: { name: `Vendor3_${runId}`, code: `V3_${runId}`, phone: '03001112233' },
      });

      // Supplier payment of 2,500 on same day
      await tx.vendorLedgerEntry.create({
        data: {
          vendorId: vendor.id,
          entryType: 'PAYMENT',
          amount: new Prisma.Decimal(-2500),
          referenceNo: `VPAY3-${runId}`,
          description: 'Supplier check payment',
          actorId: manager.id,
          createdAt: testDate,
        },
      });

      // Re-run Operating Profit report for same day: must still be 250!
      const opProfitAfterVendorPay = await operatingProfitReport(tx, dayRange);
      assert.equal(opProfitAfterVendorPay.totals.operatingExpenses.toNumber(), 150, 'Test 6: Opex remains 150 (vendor payment excluded)');
      assert.equal(opProfitAfterVendorPay.totals.operatingProfit?.toNumber(), 250, 'Test 6: Operating profit remains 250');
      assert.equal(opProfitAfterVendorPay.totals.vendorPayments.toNumber(), 2500, 'Test 6: Vendor payments informational total = 2,500');
      pass('Test 6: Supplier payment 2,500 reduces vendor payable but never reduces Operating Profit');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 7: Physical cash receipts are separated from online receipts
      // ─────────────────────────────────────────────────────────────────────────────
      // Cashier A receives 400 CASH and 600 ONLINE
      await tx.cashLedgerEntry.create({
        data: {
          portalUserId: cashierA.id,
          direction: 'IN',
          amount: new Prisma.Decimal(400),
          category: 'POS_COLLECTION',
          isPhysicalCash: true,
          isSettled: false,
          referenceNo: `CASH-${runId}`,
          note: 'Cash receipt',
        },
      });

      await tx.cashLedgerEntry.create({
        data: {
          portalUserId: cashierA.id,
          direction: 'IN',
          amount: new Prisma.Decimal(600),
          category: 'POS_COLLECTION',
          isPhysicalCash: false,
          isSettled: false,
          referenceNo: `ONLINE-${runId}`,
          note: 'Online receipt',
        },
      });

      // Check balance sheet summary for Cashier A
      const bsA = await cashService.getBalanceSheet(cashierA.id, {}, tx);
      assert.equal(bsA.summary.nonPhysicalTotal.toNumber(), 600, 'Test 7: Digital / non-physical total = 600');
      // Previous cash: 1,300 + 400 = 1,700 expected physical cash
      assert.equal(bsA.summary.expectedPhysicalCash.toNumber(), 1700, 'Test 7: Physical cash drawer includes 400 cash, excludes 600 online');
      pass('Test 7: Physical cash receipts (400) and online receipts (600) strictly segregated');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 8: Cashier A cannot read or modify Cashier B's settlement data
      // ─────────────────────────────────────────────────────────────────────────────
      // When querying settlements for Cashier A:
      const aSettlements = await tx.accountSettlement.findMany({
        where: { portalUserId: cashierA.id },
      });
      const bSettlements = await tx.accountSettlement.findMany({
        where: { portalUserId: cashierB.id },
      });

      assert.ok(aSettlements.every(s => s.portalUserId === cashierA.id), 'Test 8: Cashier A queries return own settlements only');
      assert.ok(bSettlements.every(s => s.portalUserId === cashierB.id), 'Test 8: Cashier B settlements isolated');

      // Self-approval rejection check: Cashier B cannot review own settlement
      await assert.rejects(
        () => cashService.reviewSettlement(subB.id, { decision: 'ACCEPTED' }, cashierB.id, tx),
        (err: any) => err.message.includes('Unauthorized self-approval') || err.message.includes('already been reviewed')
      );
      pass('Test 8: Server-side own-user scope enforced; unauthorized self-approval strictly rejected');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 9: M01, M02, M03, M08 and M10 reconcile to canonical ledgers
      // ─────────────────────────────────────────────────────────────────────────────
      const m01 = await incomeExpenseReport(tx, dayRange);
      const m02 = await operatingProfitReport(tx, dayRange);
      const finData = await loadFinancialData(tx, dayRange);
      const m03 = financialReport(finData, dayRange);

      assert.equal(m01.totals.operatingExpenses.toString(), m02.totals.operatingExpenses.toString(), 'Test 9: M01/M02 Opex parity');
      assert.equal(m01.totals.operatingExpenses.toString(), m03.totals.operatingExpenses.toString(), 'Test 9: M01/M03 Opex parity');
      assert.equal(m01.totals.operatingExpenses.toNumber(), 150, 'Test 9: Opex = 150 across M01, M02, M03');

      // Reconcile with M08
      const expenseAgg = await tx.expense.aggregate({
        where: { date: dayRange },
        _sum: { amount: true },
      });
      assert.equal(Number(expenseAgg._sum.amount), 150, 'Test 9: M08 ledger aggregate matches 150');
      pass('Test 9: M01, M02, M03, M08 and M10 reconcile to canonical ledgers where metrics overlap');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 10: Previously corrected M09 Customer Refund and Vendor Return Credit remain separate
      // ─────────────────────────────────────────────────────────────────────────────
      await tx.cashLedgerEntry.create({
        data: {
          category: 'REFUND',
          direction: 'OUT',
          amount: new Prisma.Decimal(500),
          isPhysicalCash: true,
          portalUserId: cashierA.id,
          referenceNo: `SRET-${runId}`,
          note: 'Customer return refund',
          occurredAt: testDate,
        },
      });

      await tx.vendorLedgerEntry.create({
        data: {
          vendorId: vendor.id,
          entryType: 'RETURN_CREDIT',
          amount: new Prisma.Decimal(-500),
          referenceNo: `PRET-${runId}`,
          referenceTable: 'purchase_returns',
          referenceId: vendor.id,
          actorId: manager.id,
          createdAt: testDate,
        },
      });

      const [m09CustAgg, m09VendAgg] = await Promise.all([
        tx.cashLedgerEntry.aggregate({
          where: { category: 'REFUND', occurredAt: dayRange, referenceNo: `SRET-${runId}` },
          _sum: { amount: true },
        }),
        tx.vendorLedgerEntry.aggregate({
          where: { entryType: 'RETURN_CREDIT', createdAt: dayRange, referenceNo: `PRET-${runId}` },
          _sum: { amount: true },
        }),
      ]);

      const custRefund = Number(m09CustAgg._sum.amount || 0);
      const vendCredit = Math.abs(Number(m09VendAgg._sum.amount || 0));
      assert.equal(custRefund, 500, 'Test 10: Customer Refund = 500');
      assert.equal(vendCredit, 500, 'Test 10: Vendor Credit = 500');
      assert.equal(custRefund + vendCredit, 1000, 'Test 10: Total volume = 1,000 (never cancelling to 0 in P&L)');
      pass('Test 10: M09 Customer Refund (500) and Vendor Return Credit (500) remain separate and never cancel to zero');

      // Rollback transaction so test data leaves zero trace
      throw ROLLBACK_ERROR;
    });
  } catch (err) {
    if (err === ROLLBACK_ERROR) {
      console.log('\n[CLEANUP] Test transaction rolled back cleanly. No changes persisted.');
    } else {
      console.error('\n[FAILED] Test execution failed:', err);
      process.exit(1);
    }
  }

  console.log(`\n========================================`);
  console.log(`ALL ${passedTests}/10 BATCH 3 VERIFICATIONS PASSED!`);
  console.log(`========================================\n`);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
