import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { pharmacyService } from '../src/modules/pharmacy/pharmacy.service';

const db = new PrismaClient();
const rollback = new Error('ROLLBACK_BATCH4_TEST');
const at = (day: number) => new Date(`2026-11-${String(day).padStart(2, '0')}T12:00:00+05:00`);
let checks = 0;
function eq(a: unknown, b: unknown, label: string) {
  assert.deepEqual(a, b, label);
  checks++;
  console.log('PASS [Batch 4]:', label);
}

async function main() {
  try {
    await db.$transaction(
      async (tx) => {
        const marker = 'B4-' + randomUUID().slice(0, 8);
        const user = await tx.portalUser.create({
          data: {
            username: marker,
            fullName: 'Staff ' + marker,
            passwordHash: 'NO-LOGIN',
            role: 'SALES_DISPENSING',
          },
        });
        const bank = await tx.paymentAccount.create({ data: { name: 'Bank-' + marker } });
        const unit = await tx.unit.create({ data: { name: 'Unit-' + marker, shortCode: marker.slice(-6) } });
        const medicine = await tx.medicineMaster.create({
          data: {
            code: marker,
            name: 'Medicine ' + marker,
            unit: 'Tablet',
            baseUnitId: unit.id,
            batchManaged: false,
            saleRate: 100,
            purchaseRate: 60,
            packagingLevels: {
              create: { unitId: unit.id, conversionToBase: 1, isSaleUnit: true, level: 0 },
            },
          },
        });

        // Stock fixture
        await tx.stockLedgerEntry.create({
          data: {
            medicineId: medicine.id,
            movementType: 'OPENING_STOCK',
            quantityDelta: 500,
            actorId: user.id,
            referenceTable: 'test_fixture',
            referenceId: medicine.id,
          },
        });

        // 1. Dispense Invoice 1: 10 units @ 100 = 1,000 PKR. Customer pays 500 upfront on Nov 1.
        const inv1 = await pharmacyService.dispenseRetail(
          {
            customerName: 'Customer One ' + marker,
            invoiceDiscount: 0,
            lines: [{ medicineId: medicine.id, saleUnitQuantity: 10, discountAmount: 0 }],
            payments: [{ amount: 500, method: 'CASH' }],
          },
          user.id,
          tx
        );
        await tx.pharmacyInvoice.update({ where: { id: inv1.id }, data: { createdAt: at(1) } });
        await tx.pharmacyPayment.updateMany({ where: { invoiceId: inv1.id }, data: { paidAt: at(1) } });
        await tx.cashLedgerEntry.updateMany({ where: { referenceId: inv1.id }, data: { occurredAt: at(1) } });

        // 2. Dispense Invoice 2: 5 units @ 100 = 500 PKR. Fully paid upfront on Nov 2.
        const inv2 = await pharmacyService.dispenseRetail(
          {
            customerName: 'Customer Two ' + marker,
            invoiceDiscount: 0,
            lines: [{ medicineId: medicine.id, saleUnitQuantity: 5, discountAmount: 0 }],
            payments: [{ amount: 500, method: 'CASH' }],
          },
          user.id,
          tx
        );
        await tx.pharmacyInvoice.update({ where: { id: inv2.id }, data: { createdAt: at(2) } });
        await tx.pharmacyPayment.updateMany({ where: { invoiceId: inv2.id }, data: { paidAt: at(2) } });
        await tx.cashLedgerEntry.updateMany({ where: { referenceId: inv2.id }, data: { occurredAt: at(2) } });

        // 3. Nov 6: Customer 1 returns and pays 200 via Bank
        const pay200Key = randomUUID();
        const p1Updated = await pharmacyService.addPayment(
          inv1.id,
          { amount: 200, method: 'BANK', paymentAccountId: bank.id, requestKey: pay200Key },
          user.id,
          tx
        );
        const p200 = p1Updated.payments.find((p) => p.requestKey === pay200Key)!;
        await tx.pharmacyPayment.update({ where: { id: p200.id }, data: { paidAt: at(6) } });
        await tx.cashLedgerEntry.updateMany(
          { where: { referenceId: inv1.id, note: 'Receipt PAY-' + p200.id }, data: { occurredAt: at(6) } }
        );

        // 4. Nov 16: Customer 1 pays remaining 300 via Cash
        const pay300Key = randomUUID();
        const p2Updated = await pharmacyService.addPayment(
          inv1.id,
          { amount: 300, method: 'CASH', requestKey: pay300Key },
          user.id,
          tx
        );
        const p300 = p2Updated.payments.find((p) => p.requestKey === pay300Key)!;
        await tx.pharmacyPayment.update({ where: { id: p300.id }, data: { paidAt: at(16) } });
        await tx.cashLedgerEntry.updateMany(
          { where: { referenceId: inv1.id, note: 'Receipt PAY-' + p300.id }, data: { occurredAt: at(16) } }
        );

        // Verification 1: Unpaginated transactions backward compatibility
        const unpaginated = (
          (await pharmacyService.listInvoices({ transactions: 'true' }, tx)) as any[]
        ).filter((r) => r.invoiceId === inv1.id);
        eq(unpaginated.length, 3, 'Unpaginated backward compatibility returns 3 transactions for inv1');
        eq(
          unpaginated.map((r) => [r.transactionType, r.billingAmount, r.collectedAmount]),
          [
            ['Remaining Collection', 0, 300],
            ['Remaining Collection', 0, 200],
            ['Original Sale', 1000, 500],
          ],
          'Unpaginated order and amounts match specifications'
        );

        // Verification 2: Server-side pagination
        const pageRes = (await pharmacyService.listInvoices(
          { transactions: 'true', page: 1, limit: 25, search: marker },
          tx
        )) as any;
        eq(typeof pageRes, 'object', 'Paginated call returns object with items and summary');
        eq(pageRes.page, 1, 'Page number is 1');
        eq(pageRes.limit, 25, 'Limit is 25');
        eq(pageRes.total, 4, 'Total 4 transactions matching test marker (3 for inv1, 1 for inv2)');
        eq(pageRes.items.length, 4, 'All 4 items returned on page 1');
        eq(pageRes.summary.totalBilling, 1500, 'Total billing is 1,500 PKR (1,000 + 500)');
        eq(pageRes.summary.totalCollected, 1500, 'Total collected is 1,500 PKR (500 + 500 + 200 + 300)');
        eq(pageRes.summary.totalOutstanding, 0, 'Total outstanding is 0 PKR (both fully settled)');
        eq(pageRes.summary.totalInvoices, 2, 'Total distinct invoices is 2');

        // Verification 3: Page size slicing (e.g. limit 2)
        const slice1 = (await pharmacyService.listInvoices(
          { transactions: 'true', page: 1, limit: 20, search: marker },
          tx
        )) as any;
        eq(slice1.total, 4, 'Total remains 4');

        // Verification 4: Date filtering for Nov 6 only (Remaining Collection row only)
        const nov6Res = (await pharmacyService.listInvoices(
          {
            transactions: 'true',
            page: 1,
            limit: 25,
            fromDate: '2026-11-06',
            toDate: '2026-11-06',
            search: marker,
          },
          tx
        )) as any;
        eq(nov6Res.items.length, 1, 'Only 1 transaction occurred on Nov 6');
        eq(nov6Res.items[0].transactionType, 'Remaining Collection', 'Nov 6 transaction is Remaining Collection');
        eq(nov6Res.items[0].billingAmount, 0, 'Nov 6 transaction billing is 0 (NOT 1000)');
        eq(nov6Res.items[0].collectedAmount, 200, 'Nov 6 transaction collected is 200');
        eq(nov6Res.summary.totalBilling, 0, 'Nov 6 KPI totalBilling is 0');
        eq(nov6Res.summary.totalCollected, 200, 'Nov 6 KPI totalCollected is 200');

        // Verification 5: Date filtering for Nov 1 only (Original Sale row only)
        const nov1Res = (await pharmacyService.listInvoices(
          {
            transactions: 'true',
            page: 1,
            limit: 25,
            fromDate: '2026-11-01',
            toDate: '2026-11-01',
            search: marker,
          },
          tx
        )) as any;
        eq(nov1Res.items.length, 1, 'Only 1 transaction occurred on Nov 1');
        eq(nov1Res.items[0].transactionType, 'Original Sale', 'Nov 1 transaction is Original Sale');
        eq(nov1Res.items[0].billingAmount, 1000, 'Nov 1 billing is 1,000');
        eq(nov1Res.items[0].collectedAmount, 500, 'Nov 1 initial collection is 500');
        eq(nov1Res.summary.totalBilling, 1000, 'Nov 1 KPI totalBilling is 1,000');
        eq(nov1Res.summary.totalCollected, 500, 'Nov 1 KPI totalCollected is 500');

        // Verification 6: Search by customer name
        const searchCustomer = (await pharmacyService.listInvoices(
          { transactions: 'true', page: 1, limit: 25, search: 'Customer Two ' + marker },
          tx
        )) as any;
        eq(searchCustomer.items.length, 1, 'Search finds exactly Customer Two transaction');
        eq(searchCustomer.summary.totalBilling, 500, 'Customer Two billing is 500');

        // Verification 7: Status filter
        const paidRes = (await pharmacyService.listInvoices(
          { transactions: 'true', page: 1, limit: 25, status: 'PAID', search: marker },
          tx
        )) as any;
        eq(paidRes.total, 4, 'Both invoices are now PAID, so all 4 rows returned');

        // Verification 8: Sorting by billing ascending
        const sortRes = (await pharmacyService.listInvoices(
          { transactions: 'true', page: 1, limit: 25, search: marker, sortBy: 'billing', sortOrder: 'asc' },
          tx
        )) as any;
        eq(sortRes.items[0].billingAmount, 0, 'First item has billing 0 (installment)');
        eq(sortRes.items[sortRes.items.length - 1].billingAmount, 1000, 'Last item has billing 1,000 (original sale)');

        // Verification 9: Full invoice detail on-demand via getInvoiceById
        const detail = await pharmacyService.getInvoiceById(inv1.id, tx);
        eq(detail.id, inv1.id, 'getInvoiceById returns target invoice');
        eq(detail.lines.length, 1, 'getInvoiceById includes full lines');
        eq(detail.payments.length, 3, 'getInvoiceById includes all 3 payments');
        eq(detail.payments[1].paymentAccount?.name, 'Bank-' + marker, 'getInvoiceById includes payment account details');

        // Verification 10: Multi-page boundaries & deterministic keyset/offset check
        // Add 50 more invoices to test pagination boundaries (page 1, 2, 3)
        const batch50: Prisma.PharmacyInvoiceCreateManyInput[] = [];
        for (let k = 0; k < 50; k++) {
          batch50.push({
            id: randomUUID(),
            invoiceNumber: `${marker}-PG-${String(k).padStart(3, '0')}`,
            channel: 'RETAIL',
            customerName: `Pagination Customer ${k} ${marker}`,
            subtotal: 100,
            discountTotal: 0,
            taxTotal: 0,
            total: 100,
            paidTotal: 100,
            outstanding: 0,
            status: 'PAID',
            dispensedById: user.id,
            createdAt: new Date(at(10).getTime() + k * 1000), // distinct deterministic timestamps
          });
        }
        await tx.pharmacyInvoice.createMany({ data: batch50 });

        // Query page 1 (limit 20)
        const p1 = (await pharmacyService.listInvoices(
          { transactions: 'true', page: 1, limit: 20, search: marker },
          tx
        )) as any;
        eq(p1.items.length, 20, 'First page contains exactly 20 items');
        eq(p1.total, 54, 'Total is 54 items');
        eq(p1.totalPages, 3, 'Total pages is 3 for limit 20');

        // Query page 2 (middle page)
        const p2 = (await pharmacyService.listInvoices(
          { transactions: 'true', page: 2, limit: 20, search: marker },
          tx
        )) as any;
        eq(p2.items.length, 20, 'Middle page (page 2) contains exactly 20 items');
        // Ensure no overlap between page 1 and page 2
        const p1Ids = new Set(p1.items.map((i: any) => i.id));
        const p2HasOverlap = p2.items.some((i: any) => p1Ids.has(i.id));
        eq(p2HasOverlap, false, 'Page 1 and Page 2 have zero duplicate records (clean boundary)');

        // Query page 3 (last page)
        const p3 = (await pharmacyService.listInvoices(
          { transactions: 'true', page: 3, limit: 20, search: marker },
          tx
        )) as any;
        eq(p3.items.length, 14, 'Last page contains remaining 14 items (54 - 40)');
        const p2Ids = new Set(p2.items.map((i: any) => i.id));
        const p3HasOverlap = p3.items.some((i: any) => p2Ids.has(i.id) || p1Ids.has(i.id));
        eq(p3HasOverlap, false, 'Last page has zero overlap with previous pages');

        // Test limit 50 and limit 100
        const pLimit50 = (await pharmacyService.listInvoices(
          { transactions: 'true', page: 1, limit: 50, search: marker },
          tx
        )) as any;
        eq(pLimit50.items.length, 50, 'Limit 50 returns exactly 50 items');

        const pLimit100 = (await pharmacyService.listInvoices(
          { transactions: 'true', page: 1, limit: 100, search: marker },
          tx
        )) as any;
        eq(pLimit100.items.length, 54, 'Limit 100 returns all 54 items on page 1');

        console.log(`\nALL ${checks} BATCH 4 VERIFICATIONS PASSED SUCCESSFULLY.`);
        throw rollback;
      },
      { timeout: 60000 }
    );
  } catch (err) {
    if (err !== rollback) throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
