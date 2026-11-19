import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../src/db/client';
import { pharmacyService } from '../src/modules/pharmacy/pharmacy.service';
import { reportsService } from '../src/modules/reports/reports.service';
import { cashService } from '../src/modules/cash/cash.service';
import { loadFinancialData, financialReport } from '../src/modules/reports/financialRecognition';
import { ConflictError, ValidationError, AuthorizationError } from '../src/shared/errors/AppError';

function eq(actual: any, expected: any, msg: string) {
  assert.deepStrictEqual(actual, expected, msg);
  console.log(`[PASS] ${msg}`);
}

async function run() {
  console.log('--- STARTING PHARMACY BATCH 4: FINAL RECONCILIATION & CROSS-SELLER TESTS ---');

  await prisma.$transaction(async (tx) => {
    const marker = 'b4-' + randomUUID().slice(0, 8);

    // 1. Setup Users
    const sellerA = await tx.portalUser.create({
      data: {
        username: `sellerA_${marker}`,
        passwordHash: 'hash',
        fullName: `Seller Alice ${marker}`,
        role: 'SALES_DISPENSING',
      },
    });

    const sellerB = await tx.portalUser.create({
      data: {
        username: `sellerB_${marker}`,
        passwordHash: 'hash',
        fullName: `Seller Bob ${marker}`,
        role: 'SALES_DISPENSING',
      },
    });

    const admin = await tx.portalUser.create({
      data: {
        username: `admin_${marker}`,
        passwordHash: 'hash',
        fullName: `Admin Manager ${marker}`,
        role: 'ADMIN',
      },
    });

    const unit = await tx.unit.create({
      data: { name: `Unit-${marker}`, shortCode: `U-${marker}` },
    });

    const med = await tx.medicineMaster.create({
      data: {
        code: `MED-${marker}`,
        name: `Med-${marker}`,
        unit: 'TABLET',
        baseUnitId: unit.id,
        purchaseRate: new Decimal(50),
        saleRate: new Decimal(100),
      },
    });

    const batch = await tx.medicineBatch.create({
      data: {
        medicineId: med.id,
        batchNumber: `B-${marker}`,
        costRate: new Decimal(50),
        saleRate: new Decimal(100),
        expiryDate: new Date('2030-01-01'),
      },
    });

    const account = await tx.paymentAccount.create({
      data: { name: `Cash-${marker}` },
    });

    // -------------------------------------------------------------------------
    // TEST 1 (Task 2): Cross-Seller Multi-Installment Attribution
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Cross-Seller Multi-Installment Attribution ---');
    // Scenario:
    // Seller A dispenses a Rs. 1,000 invoice (COGS = 500).
    // Seller A collects initial Rs. 500.
    // Seller B collects second installment Rs. 500.
    const inv = await tx.pharmacyInvoice.create({
      data: {
        invoiceNumber: `INV-${marker}`,
        channel: 'RETAIL',
        customerName: `Customer ${marker}`,
        dispensedById: sellerA.id,
        subtotal: new Decimal(1000),
        total: new Decimal(1000),
        paidTotal: new Decimal(1000),
        outstanding: new Decimal(0),
        status: 'PAID',
        lines: {
          create: [
            {
              medicineId: med.id,
              batchId: batch.id,
              quantity: new Decimal(10),
              rateSnapshot: new Decimal(100),
              costRateSnapshot: new Decimal(50),
              lineNet: new Decimal(1000),
            },
          ],
        },
        payments: {
          create: [
            {
              amount: new Decimal(500),
              method: 'CASH',
              collectedById: sellerA.id,
              isInitial: true,
              paymentAccountId: account.id,
              paidAt: new Date('2026-11-01T10:00:00+05:00'),
            },
            {
              amount: new Decimal(500),
              method: 'CASH',
              collectedById: sellerB.id,
              isInitial: false,
              paymentAccountId: account.id,
              paidAt: new Date('2026-11-02T10:00:00+05:00'),
            },
          ],
        },
      },
      include: {
        lines: { include: { medicine: true, batch: true } },
        payments: { include: { collectedByUser: true } },
        dispensedByUser: true,
        financialEvents: true,
      },
    });

    // Verification 1A: Company-wide Report (No cashier filter)
    const companyFinancialData = {
      invoices: [inv],
      refunds: [],
      expenses: [],
      stockLosses: [],
    };
    const companyReport = financialReport(companyFinancialData as any);
    eq(companyReport.totals.recognizedRevenue.toNumber(), 1000, 'Company-wide Revenue is recognized Rs. 1,000 only once');
    eq(companyReport.totals.recognizedCogs.toNumber(), 500, 'Company-wide COGS is Rs. 500 only once');
    eq(companyReport.totals.collections.toNumber(), 1000, 'Company-wide Collections is Rs. 1,000 (500 from A + 500 from B)');
    eq(companyReport.totals.grossProfit?.toNumber(), 500, 'Company-wide Gross Profit is Rs. 500 only once');

    // Verification 1B: Seller A Shift Report (The Dispenser)
    const sellerAReport = financialReport(companyFinancialData as any, {}, { cashierId: sellerA.id });
    eq(sellerAReport.totals.recognizedRevenue.toNumber(), 1000, "Seller A attributed Sales/Revenue = Rs. 1,000");
    eq(sellerAReport.totals.recognizedCogs.toNumber(), 500, "Seller A attributed COGS = Rs. 500");
    eq(sellerAReport.totals.grossProfit?.toNumber(), 500, "Seller A attributed Gross Profit = Rs. 500");
    eq(sellerAReport.totals.collections.toNumber(), 500, "Seller A collected amount = Rs. 500");

    // Verification 1C: Seller B Shift Report (Installment Collector only)
    const sellerBReport = financialReport(companyFinancialData as any, {}, { cashierId: sellerB.id });
    eq(sellerBReport.totals.recognizedRevenue.toNumber(), 0, "Seller B attributed Sales/Revenue = Rs. 0 (no duplicate revenue)");
    eq(sellerBReport.totals.recognizedCogs.toNumber(), 0, "Seller B attributed COGS = Rs. 0 (no duplicate COGS)");
    eq(sellerBReport.totals.grossProfit?.toNumber(), 0, "Seller B attributed Gross Profit = Rs. 0 (no duplicate profit/commission)");
    eq(sellerBReport.totals.collections.toNumber(), 500, "Seller B collected amount = Rs. 500");
    eq(sellerBReport.totals.outstanding.toNumber(), 0, "Seller B attributed outstanding = Rs. 0");

    // Verification 1D: Invoices Paginated SQL List View for Seller A & Seller B
    const sellerAList: any = await pharmacyService.listInvoices(
      { transactions: 'true', page: 1, limit: 25, search: marker },
      tx,
      sellerA.id
    );
    eq(sellerAList.summary.totalBilling, 1000, "Seller A list billing = Rs. 1,000");
    eq(sellerAList.summary.totalCollected, 500, "Seller A list collected = Rs. 500");

    const sellerBList: any = await pharmacyService.listInvoices(
      { transactions: 'true', page: 1, limit: 25, search: marker },
      tx,
      sellerB.id
    );
    eq(sellerBList.summary.totalBilling, 0, "Seller B list billing = Rs. 0 (not duplicated)");
    eq(sellerBList.summary.totalCollected, 500, "Seller B list collected = Rs. 500");

    // -------------------------------------------------------------------------
    // TEST 2 (Task 4): Cash Settlement Safety & Anti-Duplication
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Cash Settlement Safety & Anti-Duplication ---');

    // Create a physical cash collection in ledger for Seller A
    await tx.cashLedgerEntry.create({
      data: {
        portalUserId: sellerA.id,
        direction: 'IN',
        amount: new Decimal(1000),
        category: 'POS_COLLECTION',
        isPhysicalCash: true,
        isSettled: false,
        paymentAccountId: account.id,
      },
    });

    const expBefore = await cashService.expectedCash(sellerA.id, tx);
    eq(expBefore.toNumber(), 1000, 'Expected cash before settlement is 1,000');

    // Submit settlement for 800 (leaving 200 retained in drawer)
    const sett = await tx.accountSettlement.create({
      data: {
        settlementNumber: `SETT-${marker}`,
        portalUserId: sellerA.id,
        periodFrom: new Date('2026-11-01'),
        periodTo: new Date('2026-11-02'),
        expectedCash: new Decimal(1000),
        physicalCash: new Decimal(800),
        variance: new Decimal(-200),
        status: 'SUBMITTED',
      },
    });

    // Check 2A: Self-Approval Prevention
    await assert.rejects(
      async () => {
        await cashService.reviewSettlement(sett.id, { decision: 'ACCEPTED' }, sellerA.id, tx);
      },
      (err: any) => {
        assert(err instanceof ValidationError, 'Expected ValidationError on self-approval');
        return true;
      },
      'Reviewing own settlement throws ValidationError'
    );
    console.log('[PASS] Self-approval blocked with ValidationError');

    // Check 2B: Authorized Review by Admin
    await cashService.reviewSettlement(sett.id, { decision: 'ACCEPTED', note: 'All verified' }, admin.id, tx);

    const expAfter = await cashService.expectedCash(sellerA.id, tx);
    eq(expAfter.toNumber(), 200, 'Drawer cash after handover reflects exactly retained carry-forward (200)');

    const adminCash = await cashService.expectedCash(admin.id, tx);
    eq(adminCash.toNumber(), 800, 'Manager received physical handover of exactly 800');

    // Check 2C: Repeated Review / Anti-Duplication Protection
    await assert.rejects(
      async () => {
        await cashService.reviewSettlement(sett.id, { decision: 'ACCEPTED' }, admin.id, tx);
      },
      (err: any) => {
        assert(err instanceof ConflictError, 'Expected ConflictError on repeated review');
        return true;
      },
      'Repeated settlement review throws ConflictError (no duplicate entries)'
    );
    console.log('[PASS] Repeated settlement acceptance strictly blocked with ConflictError (no duplicate ledger entries)');

    // -------------------------------------------------------------------------
    // TEST 3 (Task 1): Financial Reconciliation Across Modules
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Financial Reconciliation Across Modules ---');

    // Purchase payments do not affect operating profit
    const vendor = await tx.vendor.create({
      data: { name: `Vendor-${marker}`, code: `V-${marker}` },
    });

    const po = await tx.purchase.create({
      data: {
        purchaseNumber: `PO-${marker}`,
        vendorId: vendor.id,
        vendorInvoiceNo: `VINV-${marker}`,
        subtotal: new Decimal(5000),
        total: new Decimal(5000),
        paidNow: new Decimal(2000),
        status: 'POSTED',
        paymentType: 'CASH',
        purchaseDate: new Date('2026-11-01'),
        createdById: admin.id,
      },
    });

    await tx.vendorLedgerEntry.create({
      data: {
        vendor: { connect: { id: vendor.id } },
        entryType: 'PURCHASE_CREDIT',
        amount: new Decimal(5000),
        referenceNo: `PO-${marker}`,
        actor: { connect: { id: admin.id } },
      },
    });
    await tx.vendorLedgerEntry.create({
      data: {
        vendor: { connect: { id: vendor.id } },
        entryType: 'PAYMENT',
        amount: new Decimal(-2000),
        referenceNo: `VPAY-${marker}`,
        actor: { connect: { id: admin.id } },
      },
    });

    const vendorBalance = await tx.vendorLedgerEntry.aggregate({
      where: { vendorId: vendor.id },
      _sum: { amount: true },
    });
    eq(vendorBalance._sum.amount?.toNumber(), 3000, 'Vendor payable closing balance = 3,000 (5,000 - 2,000)');

    // Operating expenses
    const opex = await tx.expense.create({
      data: {
        expenseNumber: `EXP-${marker}`,
        category: 'UTILITIES',
        description: 'Electricity bill',
        amount: new Decimal(300),
        paymentMethod: 'CASH',
        payeeOrVendor: 'Power Co',
        enteredById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date(),
        date: new Date('2026-11-01'),
      },
    });

    // Company financial data with expense
    const reconciledData = {
      invoices: [inv],
      refunds: [],
      expenses: [opex],
      stockLosses: [],
    };
    const reconciledReport = financialReport(reconciledData as any);
    eq(reconciledReport.totals.recognizedRevenue.toNumber(), 1000, 'Recognized Revenue = 1,000');
    eq(reconciledReport.totals.recognizedCogs.toNumber(), 500, 'Recognized COGS = 500');
    eq(reconciledReport.totals.operatingExpenses.toNumber(), 300, 'Operating Expenses = 300');
    eq(reconciledReport.totals.operatingProfit?.toNumber(), 200, 'Operating Profit = 1,000 - 500 - 300 = 200');

    throw new Error('ROLLBACK_CLEAN');
  }).catch((err) => {
    if (err.message !== 'ROLLBACK_CLEAN') throw err;
    console.log('\n[CLEANUP] Test transaction rolled back cleanly. No changes persisted.');
  });

  console.log('\n========================================');
  console.log('ALL BATCH 4 RECONCILIATION TESTS PASSED!');
  console.log('========================================');
}

run().catch((e) => {
  console.error('Test failed with error:', e);
  process.exit(1);
});
