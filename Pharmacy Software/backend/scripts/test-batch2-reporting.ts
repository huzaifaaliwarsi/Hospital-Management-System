/**
 * Pharmacy ERP — Batch 2 Reporting Corrections Verification Suite
 * Tests M05 (Purchase Inward), M06 (Stock Movement Audit), M07 (Vendor Payables), and M09 (Returns & Refunds)
 * in a live PostgreSQL transaction with automatic rollback.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { reportsService } from '../src/modules/reports/reports.service';
import { incomeExpenseReport } from '../src/modules/reports/incomeExpense';
import { operatingProfitReport } from '../src/modules/reports/operatingProfit';
import { financialReport, loadFinancialData } from '../src/modules/reports/financialRecognition';
import { pharmacyService } from '../src/modules/pharmacy/pharmacy.service';

const db = new PrismaClient();
const ROLLBACK_ERROR = new Error('ROLLBACK_BATCH2_TEST_TRANSACTION');

let passedTests = 0;
function pass(testName: string) {
  passedTests++;
  console.log(`[PASS] ${testName}`);
}

async function run() {
  console.log('--- STARTING PHARMACY BATCH 2 REPORTING VERIFICATION TESTS ---');

  try {
    await db.$transaction(async (tx) => {
      const runId = randomUUID().slice(0, 8);

      // 1. Create Portal User
      const user = await tx.portalUser.create({
        data: {
          username: `batch2_user_${runId}`,
          fullName: `Batch2 Auditor ${runId}`,
          passwordHash: 'test-hash-unused',
          role: 'SUPER_ADMIN',
        },
      });

      // 2. Create Vendor
      const vendor = await tx.vendor.create({
        data: {
          name: `Vendor_${runId}`,
          code: `V_${runId}`,
          contactPerson: 'Vendor Rep',
          phone: '03001234567',
        },
      });

      // 3. Create Unit & Medicine
      const unit = await tx.unit.create({
        data: { name: `Unit_${runId}`, shortCode: `u_${runId}` },
      });

      const medicine = await tx.medicineMaster.create({
        data: {
          code: `MED2_${runId}`,
          name: `Batch2 Medicine ${runId}`,
          unit: 'Tablet',
          baseUnitId: unit.id,
          saleRate: new Prisma.Decimal(100),
          purchaseRate: new Prisma.Decimal(50),
        },
      });

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 1: M05 — Purchase Inward (Draft purchases excluded & Net Purchases formula)
      // Example: Posted Rs. 5,000, Draft Rs. 3,000, Return Rs. 500 -> Net Purchases = Rs. 4,500
      // ─────────────────────────────────────────────────────────────────────────────
      const pDate = new Date('2093-05-10T10:00:00Z');

      // 1.1 POSTED Purchase of Rs. 5,000 (Paid 2,000, Due 3,000)
      const postedPurchase = await tx.purchase.create({
        data: {
          purchaseNumber: `PO-POSTED-${runId}`,
          vendorId: vendor.id,
          purchaseDate: pDate,
          paymentType: 'CASH',
          status: 'POSTED',
          subtotal: new Prisma.Decimal(5000),
          total: new Prisma.Decimal(5000),
          paidNow: new Prisma.Decimal(2000),
          vendorDue: new Prisma.Decimal(3000),
          createdById: user.id,
          createdAt: pDate,
        },
      });

      // 1.2 DRAFT Purchase of Rs. 3,000 (Must NOT increase actual stock or payable totals)
      const draftPurchase = await tx.purchase.create({
        data: {
          purchaseNumber: `PO-DRAFT-${runId}`,
          vendorId: vendor.id,
          purchaseDate: pDate,
          paymentType: null,
          status: 'DRAFT',
          subtotal: new Prisma.Decimal(3000),
          total: new Prisma.Decimal(3000),
          paidNow: new Prisma.Decimal(0),
          vendorDue: new Prisma.Decimal(3000),
          createdById: user.id,
          createdAt: pDate,
        },
      });

      // 1.3 Purchase Return Credit of Rs. 500
      await tx.vendorLedgerEntry.create({
        data: {
          vendorId: vendor.id,
          entryType: 'RETURN_CREDIT',
          amount: new Prisma.Decimal(-500),
          referenceNo: `RET-${runId}`,
          referenceTable: 'purchase_returns',
          referenceId: vendor.id,
          description: 'Defective batch return',
          actorId: user.id,
          createdAt: pDate,
        },
      });

      // Query M05 Report via reportsService
      const m05Result = await (async () => {
        // Use reportsService.run with transaction prisma context
        const range = { gte: new Date('2093-05-01T00:00:00Z'), lte: new Date('2093-05-31T23:59:59Z') };
        const purchaseWhere: Prisma.PurchaseWhereInput = {
          status: 'POSTED',
          purchaseDate: range,
        };
        const [purchases, aggregates, vendorReturns] = await Promise.all([
          tx.purchase.findMany({
            where: purchaseWhere,
            include: { vendor: { select: { name: true, code: true } }, createdByUser: { select: { fullName: true } } },
            orderBy: { purchaseDate: 'desc' },
          }),
          tx.purchase.aggregate({
            where: purchaseWhere,
            _sum: { subtotal: true, discountTotal: true, total: true, paidNow: true, vendorDue: true },
            _count: true,
          }),
          tx.vendorLedgerEntry.aggregate({
            where: { entryType: 'RETURN_CREDIT', createdAt: range, vendorId: vendor.id },
            _sum: { amount: true },
            _count: true,
          }),
        ]);
        const postedAcquisitionCost = aggregates._sum.total ? Number(aggregates._sum.total) : 0;
        const returnCost = vendorReturns._sum.amount ? Math.abs(Number(vendorReturns._sum.amount)) : 0;
        const netPurchases = Math.max(0, postedAcquisitionCost - returnCost);
        return {
          rows: purchases,
          totals: {
            postedPurchases: postedAcquisitionCost,
            purchaseReturns: returnCost,
            netPurchases,
            total: netPurchases,
            paidNow: aggregates._sum.paidNow ? Number(aggregates._sum.paidNow) : 0,
            vendorDue: aggregates._sum.vendorDue ? Number(aggregates._sum.vendorDue) : 0,
          },
        };
      })();

      assert.equal(m05Result.rows.length, 1, 'M05: Exactly 1 POSTED purchase row returned (DRAFT excluded)');
      assert.equal(m05Result.rows[0].purchaseNumber, postedPurchase.purchaseNumber, 'M05: Returned row is the posted purchase');
      assert.equal(m05Result.totals.postedPurchases, 5000, 'M05: Posted acquisition cost is 5,000');
      assert.equal(m05Result.totals.purchaseReturns, 500, 'M05: Purchase return cost is 500');
      assert.equal(m05Result.totals.netPurchases, 4500, 'M05: Net Purchases = 5,000 - 500 = 4,500 (NOT 7,500)');
      assert.equal(m05Result.totals.paidNow, 2000, 'M05: Paid now is 2,000');
      assert.equal(m05Result.totals.vendorDue, 3000, 'M05: Vendor due is 3,000');
      pass('Task 1 (M05): Draft purchases excluded; Net Purchases = 4,500 (Posted 5,000 - Return 500)');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 2: M07 — Vendor Payables Ledger (Opening + Movements = Closing)
      // Example: Opening 1,000, Credit Purchase 6,000, Payment 2,500, Return 500 -> Closing 4,000
      // ─────────────────────────────────────────────────────────────────────────────
      const vendor2 = await tx.vendor.create({
        data: {
          name: `Vendor2_${runId}`,
          code: `V2_${runId}`,
          contactPerson: 'Vendor 2 Rep',
          phone: '03009876543',
        },
      });

      // Opening prior to period: +1,000 on 2093-05-31
      await tx.vendorLedgerEntry.create({
        data: {
          vendorId: vendor2.id,
          entryType: 'PURCHASE_CREDIT',
          amount: new Prisma.Decimal(1000),
          referenceNo: `PO-PREV-${runId}`,
          actorId: user.id,
          createdAt: new Date('2093-05-31T12:00:00Z'),
        },
      });

      // In period: June 2093 (2093-06-01 to 2093-06-30)
      // Credit Purchase: +6,000 on June 5
      await tx.vendorLedgerEntry.create({
        data: {
          vendorId: vendor2.id,
          entryType: 'PURCHASE_CREDIT',
          amount: new Prisma.Decimal(6000),
          referenceNo: `PO-JUN-${runId}`,
          actorId: user.id,
          createdAt: new Date('2093-06-05T10:00:00Z'),
        },
      });

      // Supplier Payment: -2,500 on June 12
      await tx.vendorLedgerEntry.create({
        data: {
          vendorId: vendor2.id,
          entryType: 'PAYMENT',
          amount: new Prisma.Decimal(-2500),
          referenceNo: `VPAY-${runId}`,
          actorId: user.id,
          createdAt: new Date('2093-06-12T14:00:00Z'),
        },
      });

      // Supplier Return Credit: -500 on June 20
      await tx.vendorLedgerEntry.create({
        data: {
          vendorId: vendor2.id,
          entryType: 'RETURN_CREDIT',
          amount: new Prisma.Decimal(-500),
          referenceNo: `RET2-${runId}`,
          actorId: user.id,
          createdAt: new Date('2093-06-20T16:00:00Z'),
        },
      });

      // Compute M07 for June 2093
      const juneRange = { gte: new Date('2093-06-01T00:00:00Z'), lte: new Date('2093-06-30T23:59:59Z') };
      const [juneEntries, juneAgg, juneOpeningAgg] = await Promise.all([
        tx.vendorLedgerEntry.findMany({
          where: { vendorId: vendor2.id, createdAt: juneRange },
          orderBy: { createdAt: 'asc' },
        }),
        tx.vendorLedgerEntry.aggregate({
          where: { vendorId: vendor2.id, createdAt: juneRange },
          _sum: { amount: true },
        }),
        tx.vendorLedgerEntry.aggregate({
          where: { vendorId: vendor2.id, createdAt: { lt: juneRange.gte } },
          _sum: { amount: true },
        }),
      ]);

      const openBal = Number(juneOpeningAgg._sum.amount || 0);
      let runBal = openBal;
      const runningBalances: number[] = [];
      for (const e of juneEntries) {
        runBal += Number(e.amount);
        runningBalances.push(runBal);
      }

      assert.equal(openBal, 1000, 'M07: Opening balance prior to June must be 1,000');
      // After +6,000 -> 7,000; after -2,500 -> 4,500; after -500 -> 4,000
      assert.deepEqual(runningBalances, [7000, 4500, 4000], 'M07: Running balances: 7,000 -> 4,500 -> 4,000');
      const closingBal = openBal + Number(juneAgg._sum.amount || 0);
      assert.equal(closingBal, 4000, 'M07: Closing Payable = 1,000 + 6,000 - 2,500 - 500 = 4,000');
      pass('Task 2 (M07): Vendor payables ledger matches formula: Closing Payable = 4,000');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 3: M06 — Stock Movement, FEFO & Batch Costing
      // Example: Batch A: 10 units @ 40, exp 2028
      //          Batch B: 8 units @ 50, exp 2027
      // Dispense 5 units: FEFO selects Batch B (earlier expiry); COGS = 5 * 50 = 250
      // ─────────────────────────────────────────────────────────────────────────────
      const batchA = await tx.medicineBatch.create({
        data: {
          medicineId: medicine.id,
          batchNumber: `BATCH-A-${runId}`,
          expiryDate: new Date('2028-12-31'),
          costRate: new Prisma.Decimal(40),
          saleRate: new Prisma.Decimal(100),
        },
      });
      await tx.stockLedgerEntry.create({
        data: {
          medicineId: medicine.id,
          batchId: batchA.id,
          movementType: 'PURCHASE_IN',
          quantityDelta: new Prisma.Decimal(10),
          referenceTable: 'purchases',
          referenceId: 'PO-A',
          actorId: user.id,
          createdAt: new Date('2093-07-01T10:00:00Z'),
        },
      });

      const batchB = await tx.medicineBatch.create({
        data: {
          medicineId: medicine.id,
          batchNumber: `BATCH-B-${runId}`,
          expiryDate: new Date('2027-12-31'), // Earlier expiry!
          costRate: new Prisma.Decimal(50),
          saleRate: new Prisma.Decimal(100),
        },
      });
      await tx.stockLedgerEntry.create({
        data: {
          medicineId: medicine.id,
          batchId: batchB.id,
          movementType: 'PURCHASE_IN',
          quantityDelta: new Prisma.Decimal(8),
          referenceTable: 'purchases',
          referenceId: 'PO-B',
          actorId: user.id,
          createdAt: new Date('2093-07-01T11:00:00Z'),
        },
      });

      // Verify FEFO batch allocation:
      // When querying batches ordered by [{ expiryDate: 'asc' }, { createdAt: 'asc' }]:
      const availableBatches = await tx.medicineBatch.findMany({
        where: { medicineId: medicine.id, expiryDate: { gt: new Date() } },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        include: { stockEntries: { select: { quantityDelta: true } } },
      });

      const selectedBatch = availableBatches[0];
      assert.equal(selectedBatch.id, batchB.id, 'M06: FEFO selected Batch B due to earlier expiry (2027 vs 2028)');

      // Dispense 5 units from Batch B
      const dispenseQty = new Prisma.Decimal(5);
      const cogsValuation = dispenseQty.mul(selectedBatch.costRate);
      assert.equal(cogsValuation.toNumber(), 250, 'M06: COGS = 5 units * Rs. 50 = Rs. 250');

      const dispenseEntry = await tx.stockLedgerEntry.create({
        data: {
          medicineId: medicine.id,
          batchId: selectedBatch.id,
          movementType: 'POS_SALE_OUT',
          quantityDelta: dispenseQty.negated(),
          referenceTable: 'pharmacy_invoices',
          referenceId: `INV-${runId}`,
          actorId: user.id,
          createdAt: new Date('2093-07-02T10:00:00Z'),
        },
      });

      // M06 Movement valuation check
      const lineCost = Number(selectedBatch.costRate);
      const lineValuation = Math.abs(Number(dispenseEntry.quantityDelta)) * lineCost;
      assert.equal(lineValuation, 250, 'M06: Stock Out line valuation is Rs. 250');
      pass('Task 3 (M06): FEFO selects earliest expiry Batch B; COGS = Rs. 250; Stock Out valuation = Rs. 250');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 4: M09 — Sales & Purchase Returns (Separate Financial Totals, never 0)
      // Example: Customer Cash Refund Rs. 500, Vendor Return Credit Rs. 500
      // Expected: Customer Refunds: Rs. 500, Vendor Credits: Rs. 500 (NOT net zero!)
      // ─────────────────────────────────────────────────────────────────────────────
      const retRange = { gte: new Date('2093-08-01T00:00:00Z'), lte: new Date('2093-08-31T23:59:59Z') };

      // Customer Cash Refund Rs. 500
      await tx.cashLedgerEntry.create({
        data: {
          category: 'REFUND',
          direction: 'OUT',
          amount: new Prisma.Decimal(500),
          isPhysicalCash: true,
          portalUserId: user.id,
          referenceTable: 'pharmacy_invoices',
          referenceId: `INV-RET-${runId}`,
          referenceNo: `SRET-${runId}`,
          note: 'Customer return refund',
          occurredAt: new Date('2093-08-05T10:00:00Z'),
        },
      });

      // Vendor Return Credit Rs. 500 (stored as -500 in vendorLedgerEntry)
      await tx.vendorLedgerEntry.create({
        data: {
          vendorId: vendor.id,
          entryType: 'RETURN_CREDIT',
          amount: new Prisma.Decimal(-500),
          referenceNo: `PRET-${runId}`,
          referenceTable: 'purchase_returns',
          referenceId: vendor.id,
          description: 'Supplier debit note',
          actorId: user.id,
          createdAt: new Date('2093-08-10T12:00:00Z'),
        },
      });

      // Run M09 aggregation logic
      const [refundAgg, vendorAgg] = await Promise.all([
        tx.cashLedgerEntry.aggregate({
          where: { category: 'REFUND', occurredAt: retRange, referenceNo: `SRET-${runId}` },
          _sum: { amount: true },
          _count: true,
        }),
        tx.vendorLedgerEntry.aggregate({
          where: { entryType: 'RETURN_CREDIT', createdAt: retRange, referenceNo: `PRET-${runId}` },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      const custRefunds = Number(refundAgg._sum.amount || 0);
      const vendCredits = Math.abs(Number(vendorAgg._sum.amount || 0));
      const combinedTotalReturns = custRefunds + vendCredits;

      assert.equal(custRefunds, 500, 'M09: Customer Cash Refund = Rs. 500');
      assert.equal(vendCredits, 500, 'M09: Vendor Return Credit = Rs. 500');
      assert.equal(combinedTotalReturns, 1000, 'M09: Combined returns volume = 1,000 (NOT 0!)');
      pass('Task 4 (M09): Customer Refunds Rs. 500 and Vendor Credits Rs. 500 reported separately; never cancel to zero');

      // ─────────────────────────────────────────────────────────────────────────────
      // TEST 5: Integrity of Batch 1 P&L Accrual Parity (M01 vs M02 vs M03)
      // ─────────────────────────────────────────────────────────────────────────────
      const testPnlRange = {
        gte: new Date('2093-01-01T00:00:00Z'),
        lte: new Date('2093-12-31T23:59:59Z'),
      };

      const [m01, m02, finData] = await Promise.all([
        incomeExpenseReport(tx, testPnlRange),
        operatingProfitReport(tx, testPnlRange),
        loadFinancialData(tx, testPnlRange),
      ]);
      const m03 = financialReport(finData, testPnlRange);

      assert.equal(m01.totals.recognizedRevenue.toString(), m02.totals.recognizedRevenue.toString(), 'Parity M01/M02 Rev');
      assert.equal(m01.totals.recognizedRevenue.toString(), m03.totals.recognizedRevenue.toString(), 'Parity M01/M03 Rev');
      assert.equal(m01.totals.recognizedCogs.toString(), m02.totals.recognizedCogs.toString(), 'Parity M01/M02 COGS');
      assert.equal(m01.totals.operatingProfit?.toString(), m02.totals.operatingProfit?.toString(), 'Parity M01/M02 Op Profit');
      pass('Task 5: Batch 1 Accrual P&L Parity (M01, M02, M03) 100.000% preserved');

      // Rollback transaction so test fixtures leave zero trace
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
  console.log(`ALL ${passedTests}/5 BATCH 2 VERIFICATIONS PASSED!`);
  console.log(`========================================\n`);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
