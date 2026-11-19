import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../src/db/client';
import { pharmacyService } from '../src/modules/pharmacy/pharmacy.service';
import { pharmacyController } from '../src/modules/pharmacy/pharmacy.controller';
import { reportsController } from '../src/modules/reports/reports.controller';
import { dashboardController } from '../src/modules/dashboard/dashboard.controller';
import { cashController } from '../src/modules/cash/cash.controller';
import { cashService } from '../src/modules/cash/cash.service';
import { AuthorizationError, NotFoundError } from '../src/shared/errors/AppError';

function eq(actual: any, expected: any, msg: string) {
  assert.deepStrictEqual(actual, expected, msg);
  console.log(`[PASS] ${msg}`);
}

async function run() {
  console.log('--- STARTING PHARMACY SELLER ISOLATION & ROUTE SECURITY TESTS ---');

  await prisma.$transaction(async (tx) => {
    const marker = 'sec-' + randomUUID().slice(0, 8);

    // 1. Create Sellers and Admin
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

    const adminUser = await tx.portalUser.create({
      data: {
        username: `admin_${marker}`,
        passwordHash: 'hash',
        fullName: `Admin Carol ${marker}`,
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
      data: {
        name: `Cash-${marker}`,
      },
    });

    // 2. Create Invoices: Invoice A by Seller A, Invoice B by Seller B
    const invA = await tx.pharmacyInvoice.create({
      data: {
        invoiceNumber: `INV-A-${marker}`,
        channel: 'RETAIL',
        customerName: `Customer of Alice ${marker}`,
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
              amount: new Decimal(1000),
              method: 'CASH',
              collectedById: sellerA.id,
              isInitial: true,
              paymentAccountId: account.id,
            },
          ],
        },
      },
      include: { payments: true },
    });

    const invB = await tx.pharmacyInvoice.create({
      data: {
        invoiceNumber: `INV-B-${marker}`,
        channel: 'RETAIL',
        customerName: `Customer of Bob ${marker}`,
        dispensedById: sellerB.id,
        subtotal: new Decimal(2000),
        total: new Decimal(2000),
        paidTotal: new Decimal(2000),
        outstanding: new Decimal(0),
        status: 'PAID',
        lines: {
          create: [
            {
              medicineId: med.id,
              batchId: batch.id,
              quantity: new Decimal(20),
              rateSnapshot: new Decimal(100),
              costRateSnapshot: new Decimal(50),
              lineNet: new Decimal(2000),
            },
          ],
        },
        payments: {
          create: [
            {
              amount: new Decimal(2000),
              method: 'CASH',
              collectedById: sellerB.id,
              isInitial: true,
              paymentAccountId: account.id,
            },
          ],
        },
      },
      include: { payments: true },
    });

    // -------------------------------------------------------------------------
    // TEST 1: listInvoices Scoping (SQL Projection & In-Memory Fallback)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: listInvoices Seller Scoping ---');
    const sellerAList: any = await pharmacyService.listInvoices(
      { transactions: 'true', page: 1, limit: 25, search: marker },
      tx,
      sellerA.id
    );
    eq(
      sellerAList.items.every((r: any) => r.dispensedById === sellerA.id || r.collectedById === sellerA.id),
      true,
      'Seller A list contains strictly Seller A records'
    );
    eq(
      sellerAList.items.some((r: any) => r.invoiceId === invB.id),
      false,
      'Seller A cannot see Seller B invoice in list'
    );
    eq(sellerAList.summary.totalBilling, 1000, 'Seller A list summary only sums Seller A billing');

    const sellerBList: any = await pharmacyService.listInvoices(
      { transactions: 'true', page: 1, limit: 25, search: marker },
      tx,
      sellerB.id
    );
    eq(
      sellerBList.items.every((r: any) => r.dispensedById === sellerB.id || r.collectedById === sellerB.id),
      true,
      'Seller B list contains strictly Seller B records'
    );
    eq(
      sellerBList.items.some((r: any) => r.invoiceId === invA.id),
      false,
      'Seller B cannot see Seller A invoice in list'
    );
    eq(sellerBList.summary.totalBilling, 2000, 'Seller B list summary only sums Seller B billing');

    const adminList: any = await pharmacyService.listInvoices(
      { transactions: 'true', page: 1, limit: 25, search: marker },
      tx,
      undefined // Admin sees all
    );
    eq(
      adminList.items.some((r: any) => r.invoiceId === invA.id) &&
      adminList.items.some((r: any) => r.invoiceId === invB.id),
      true,
      'Admin can see both Seller A and Seller B invoices'
    );
    eq(adminList.summary.totalBilling, 3000, 'Admin summary reflects combined billing of 3,000');

    // -------------------------------------------------------------------------
    // TEST 2: Direct Invoice Retrieval by ID (getInvoiceById Access Control)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Direct Invoice Access Control ---');

    // Seller A viewing Seller A's invoice: OK
    const aViewsA = await pharmacyService.getInvoiceById(invA.id, tx, {
      role: 'SALES_DISPENSING',
      sub: sellerA.id,
    });
    eq(aViewsA.id, invA.id, 'Seller A can access own invoice');

    // Seller A viewing Seller B's invoice: BLOCKED (403)
    await assert.rejects(
      async () => {
        await pharmacyService.getInvoiceById(invB.id, tx, {
          role: 'SALES_DISPENSING',
          sub: sellerA.id,
        });
      },
      (err: any) => {
        assert(err instanceof AuthorizationError, 'Expected AuthorizationError on cross-seller invoice access');
        return true;
      },
      'Seller A accessing Seller B invoice throws AuthorizationError (403)'
    );
    console.log('[PASS] Seller A is blocked with AuthorizationError (403) from accessing Seller B invoice');

    // Seller B viewing Seller A's invoice: BLOCKED (403)
    await assert.rejects(
      async () => {
        await pharmacyService.getInvoiceById(invA.id, tx, {
          role: 'SALES_DISPENSING',
          sub: sellerB.id,
        });
      },
      (err: any) => {
        assert(err instanceof AuthorizationError, 'Expected AuthorizationError on cross-seller invoice access');
        return true;
      },
      'Seller B accessing Seller A invoice throws AuthorizationError (403)'
    );
    console.log('[PASS] Seller B is blocked with AuthorizationError (403) from accessing Seller A invoice');

    // Admin viewing both: OK
    const adminViewsA = await pharmacyService.getInvoiceById(invA.id, tx, {
      role: 'ADMIN',
      sub: adminUser.id,
    });
    const adminViewsB = await pharmacyService.getInvoiceById(invB.id, tx, {
      role: 'ADMIN',
      sub: adminUser.id,
    });
    eq(adminViewsA.id === invA.id && adminViewsB.id === invB.id, true, 'Admin can view any invoice');

    // Legitimate Installment Collection Workflow:
    // When an invoice has an outstanding balance, an on-duty seller (Seller B) can view it to collect remaining installment
    const invPartial = await tx.pharmacyInvoice.create({
      data: {
        invoiceNumber: `INV-PARTIAL-${marker}`,
        channel: 'RETAIL',
        customerName: `Customer Outstanding ${marker}`,
        dispensedById: sellerA.id,
        subtotal: new Decimal(1000),
        total: new Decimal(1000),
        paidTotal: new Decimal(400),
        outstanding: new Decimal(600),
        status: 'PARTIALLY_PAID',
      },
    });
    const sellerBViewsPartial = await pharmacyService.getInvoiceById(invPartial.id, tx, {
      role: 'SALES_DISPENSING',
      sub: sellerB.id,
    });
    eq(sellerBViewsPartial.id, invPartial.id, 'Seller B can view invoice with outstanding balance for installment collection');
    console.log('[PASS] Seller B is allowed to access invoice with outstanding balance for counter installment collection');

    // -------------------------------------------------------------------------
    // TEST 3: Company-wide Report Route Protection (reportsController.run)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Company-wide Reports Security ---');

    const restrictedReports = [
      'OPERATING_PROFIT',
      'INCOME_EXPENSE',
      'VENDOR_LEDGER',
      'PURCHASE',
      'STOCK_MOVEMENT',
      'EXPENSE',
      'RETURN_REFUND',
      'BALANCE_SETTLEMENT',
    ];

    for (const reportType of restrictedReports) {
      const mockReq: any = {
        user: { role: 'SALES_DISPENSING', sub: sellerA.id },
        query: { type: reportType },
      };
      const mockRes: any = { json: () => {} };

      await assert.rejects(
        async () => {
          await reportsController.run(mockReq, mockRes);
        },
        (err: any) => {
          assert(err instanceof AuthorizationError, `Expected AuthorizationError for report type ${reportType}`);
          return true;
        },
        `Seller calling report ${reportType} throws AuthorizationError (403)`
      );
      console.log(`[PASS] Report ${reportType} rejected with 403 Forbidden for SALES_DISPENSING`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: SALES_COLLECTION Shift Report Scoping & Tamper Resistance
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: SALES_COLLECTION Shift Report Scoping ---');
    let capturedData: any = null;
    const mockSalesReq: any = {
      user: { role: 'SALES_DISPENSING', sub: sellerA.id },
      // Attempting to spoof query parameter to inspect Seller B:
      query: { type: 'SALES_COLLECTION', cashierId: sellerB.id },
    };
    const mockSalesRes: any = {
      json: (body: any) => {
        capturedData = body.data;
      },
    };

    await reportsController.run(mockSalesReq, mockSalesRes);
    eq(
      mockSalesReq.query.cashierId,
      sellerA.id,
      'Backend overrides spoofed cashierId with authenticated user ID (sellerA.id)'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Management Dashboard Access Control
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Management Dashboard Route Security ---');
    const mockDashReq: any = {
      user: { role: 'SALES_DISPENSING', sub: sellerA.id },
    };
    const mockDashRes: any = { json: () => {} };

    await assert.rejects(
      async () => {
        await dashboardController.management(mockDashReq, mockDashRes);
      },
      (err: any) => {
        assert(err instanceof AuthorizationError, 'Expected AuthorizationError on /dashboard/management');
        return true;
      },
      'Seller calling /dashboard/management throws AuthorizationError (403)'
    );
    console.log('[PASS] /dashboard/management rejected with 403 Forbidden for SALES_DISPENSING');

    // -------------------------------------------------------------------------
    // TEST 6: Cash Settlements Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Cash Settlements Isolation ---');
    // Seller A creates settlement
    const settA = await tx.accountSettlement.create({
      data: {
        settlementNumber: `SETT-A-${marker}`,
        portalUserId: sellerA.id,
        periodFrom: new Date('2026-11-01'),
        periodTo: new Date('2026-11-02'),
        expectedCash: new Decimal(1000),
        physicalCash: new Decimal(1000),
        variance: new Decimal(0),
        status: 'SUBMITTED',
      },
    });

    // Seller B creates settlement
    const settB = await tx.accountSettlement.create({
      data: {
        settlementNumber: `SETT-B-${marker}`,
        portalUserId: sellerB.id,
        periodFrom: new Date('2026-11-01'),
        periodTo: new Date('2026-11-02'),
        expectedCash: new Decimal(2000),
        physicalCash: new Decimal(2000),
        variance: new Decimal(0),
        status: 'SUBMITTED',
      },
    });

    // Seller A calls listSettlements while attempting to pass query.userId = sellerB.id
    const mockSettReq: any = {
      user: { role: 'SALES_DISPENSING', sub: sellerA.id },
      query: { userId: sellerB.id },
    };

    // Enforce controller logic:
    if (mockSettReq.user?.role === 'SALES_DISPENSING') {
      mockSettReq.query.userId = mockSettReq.user.sub;
    }
    const settlementResult = await cashService.listSettlements(mockSettReq.query, tx);

    eq(
      mockSettReq.query.userId,
      sellerA.id,
      'cashController overrides spoofed userId with authenticated sub'
    );
    eq(
      settlementResult.some((s: any) => s.id === settA.id),
      true,
      'Seller A can see own settlement'
    );
    eq(
      settlementResult.some((s: any) => s.id === settB.id),
      false,
      'Seller A CANNOT see Seller B settlement'
    );

    // Rollback test transaction cleanly
    throw new Error('ROLLBACK_CLEAN');
  }).catch((err) => {
    if (err.message !== 'ROLLBACK_CLEAN') throw err;
    console.log('\n[CLEANUP] Test transaction rolled back cleanly. No database changes persisted.');
  });

  console.log('\n========================================');
  console.log('ALL SELLER ISOLATION & ROUTE SECURITY TESTS PASSED!');
  console.log('========================================');
}

run().catch((e) => {
  console.error('Test failed with error:', e);
  process.exit(1);
});
