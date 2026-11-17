import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { pharmacyService } from '../src/modules/pharmacy/pharmacy.service';
import { cashService } from '../src/modules/cash/cash.service';
import { Decimal } from '@prisma/client/runtime/library';

const db = new PrismaClient();
const rollback = new Error('ROLLBACK_BATCH6_POS_TEST');
let checks = 0;

function eq(actual: unknown, expected: unknown, label: string) {
  assert.deepEqual(actual, expected, label);
  checks++;
  console.log(`[PASS] ${label}`);
}

async function main() {
  console.log('=== STARTING BATCH 6: MULTI-USER POS & CONCURRENT CASHIER TEST SUITE ===\n');

  try {
    await db.$transaction(async (tx) => {
      const marker = 'POS-B6-' + randomUUID().slice(0, 8);

      // Create two independent cashiers
      const cashierA = await tx.portalUser.create({
        data: { username: `${marker}-cashierA`, fullName: `${marker}-Cashier A`, passwordHash: 'NO-LOGIN', role: 'SALES_DISPENSING' },
      });
      const cashierB = await tx.portalUser.create({
        data: { username: `${marker}-cashierB`, fullName: `${marker}-Cashier B`, passwordHash: 'NO-LOGIN', role: 'SALES_DISPENSING' },
      });

      const unitTab = await tx.unit.create({ data: { name: `${marker}-Tab`, shortCode: 'TAB' } });
      const unitBox = await tx.unit.create({ data: { name: `${marker}-Box`, shortCode: 'BOX' } });

      // Medicine 1: Standard Stock Sync (Initial Stock = 10)
      const med1 = await tx.medicineMaster.create({
        data: {
          code: `${marker}-M1`,
          name: `${marker}-Amoxicillin`,
          unit: 'Tablet',
          baseUnitId: unitTab.id,
          batchManaged: false,
          saleRate: 50,
          purchaseRate: 30,
          packagingLevels: {
            create: { unitId: unitTab.id, level: 0, conversionToBase: 1, isSaleUnit: true, isPurchaseUnit: true },
          },
        },
      });

      // Opening stock: 10
      await tx.stockLedgerEntry.create({
        data: { medicineId: med1.id, movementType: 'OPENING_STOCK', quantityDelta: 10, actorId: cashierA.id, referenceTable: 'test', referenceId: med1.id },
      });

      const getStock = async (medicineId: string) => {
        const entries = await tx.stockLedgerEntry.findMany({ where: { medicineId }, select: { quantityDelta: true } });
        return entries.reduce((s, e) => s.plus(e.quantityDelta), new Decimal(0)).toNumber();
      };

      eq(await getStock(med1.id), 10, 'Initial available stock is 10');

      // ── STEP 1: Cashier A sells 3 units ──
      const saleA = await pharmacyService.dispenseRetail(
        {
          customerName: 'Patient 1',
          invoiceDiscount: 0,
          lines: [{ medicineId: med1.id, saleUnitQuantity: 3, discountAmount: 0 }],
          payments: [{ amount: 150, method: 'CASH' }],
        },
        cashierA.id,
        tx
      );

      eq(await getStock(med1.id), 7, 'Database stock is 7 after Cashier A sells 3');
      const med1UpdatedStock = saleA.updatedStock?.find((u) => u.medicineId === med1.id);
      eq(Number(med1UpdatedStock?.currentStock), 7, 'Cashier A receives authoritative updatedStock = 7 in API response');
      eq(med1UpdatedStock?.isOutOfStock, false, 'Not out of stock');

      // ── STEP 2: Cashier B receives fresh availability through verified catalog query ──
      const catalogB = await pharmacyService.getPosCatalog(undefined, tx);
      const med1CatalogB = catalogB.find((m) => m.id === med1.id);
      eq(Number(med1CatalogB?.currentStock), 7, 'Cashier B fetches POS catalog and sees updated stock 7');

      // ── STEP 3: Cashier B sells 2 units ──
      const saleB = await pharmacyService.dispenseRetail(
        {
          customerName: 'Patient 2',
          invoiceDiscount: 0,
          lines: [{ medicineId: med1.id, saleUnitQuantity: 2, discountAmount: 0 }],
          payments: [{ amount: 100, method: 'CASH' }],
        },
        cashierB.id,
        tx
      );

      eq(await getStock(med1.id), 5, 'Database stock is 5 after Cashier B sells 2');
      const med1UpdatedStockB = saleB.updatedStock?.find((u) => u.medicineId === med1.id);
      eq(Number(med1UpdatedStockB?.currentStock), 5, 'Cashier B receives authoritative updatedStock = 5 in API response');

      // ── STEP 4: Prevent Overselling (Cashier B tries to sell 6 when only 5 remain) ──
      await assert.rejects(
        () =>
          pharmacyService.dispenseRetail(
            {
              customerName: 'Patient Oversell',
              invoiceDiscount: 0,
              lines: [{ medicineId: med1.id, saleUnitQuantity: 6, discountAmount: 0 }],
              payments: [{ amount: 300, method: 'CASH' }],
            },
            cashierB.id,
            tx
          ),
        /Insufficient stock/,
        'Oversell rejected atomically by backend'
      );
      checks++;
      console.log('[PASS] Oversell rejected atomically by backend with Insufficient Stock error');

      eq(await getStock(med1.id), 5, 'Stock remains exactly 5 after rejected oversell attempt');

      // ── STEP 5: FEFO & Batch Expiry Validation ──
      const medFEFO = await tx.medicineMaster.create({
        data: {
          code: `${marker}-FEFO`,
          name: `${marker}-FEFO Medicine`,
          unit: 'Tablet',
          baseUnitId: unitTab.id,
          batchManaged: true,
          saleRate: 100,
          purchaseRate: 60,
          packagingLevels: {
            create: { unitId: unitTab.id, level: 0, conversionToBase: 1, isSaleUnit: true, isPurchaseUnit: true },
          },
        },
      });

      const now = new Date();
      // Batch 1: Expiring in 5 days (Early) -> Stock 3
      const bEarly = await tx.medicineBatch.create({
        data: { medicineId: medFEFO.id, batchNumber: `${marker}-B-EARLY`, expiryDate: new Date(now.getTime() + 5 * 86_400_000), costRate: 60, saleRate: 100 },
      });
      await tx.stockLedgerEntry.create({
        data: { medicineId: medFEFO.id, batchId: bEarly.id, movementType: 'PURCHASE_IN', quantityDelta: 3, actorId: cashierA.id, referenceTable: 'test', referenceId: bEarly.id },
      });

      // Batch 2: Expiring in 45 days (Later) -> Stock 10
      const bLater = await tx.medicineBatch.create({
        data: { medicineId: medFEFO.id, batchNumber: `${marker}-B-LATER`, expiryDate: new Date(now.getTime() + 45 * 86_400_000), costRate: 60, saleRate: 100 },
      });
      await tx.stockLedgerEntry.create({
        data: { medicineId: medFEFO.id, batchId: bLater.id, movementType: 'PURCHASE_IN', quantityDelta: 10, actorId: cashierA.id, referenceTable: 'test', referenceId: bLater.id },
      });

      // Batch 3: Already Expired (Yesterday) -> Stock 5
      const bExpired = await tx.medicineBatch.create({
        data: { medicineId: medFEFO.id, batchNumber: `${marker}-B-EXP`, expiryDate: new Date(now.getTime() - 86_400_000), costRate: 60, saleRate: 100 },
      });
      await tx.stockLedgerEntry.create({
        data: { medicineId: medFEFO.id, batchId: bExpired.id, movementType: 'PURCHASE_IN', quantityDelta: 5, actorId: cashierA.id, referenceTable: 'test', referenceId: bExpired.id },
      });

      // Dispense 4 units: FEFO MUST take 3 from bEarly and 1 from bLater; 0 from bExpired!
      const saleFEFO = await pharmacyService.dispenseRetail(
        {
          customerName: 'Patient FEFO',
          invoiceDiscount: 0,
          lines: [{ medicineId: medFEFO.id, saleUnitQuantity: 4, discountAmount: 0 }],
          payments: [{ amount: 400, method: 'CASH' }],
        },
        cashierA.id,
        tx
      );

      const fefoInvoice = await tx.pharmacyInvoice.findUniqueOrThrow({ where: { id: saleFEFO.id }, include: { lines: true } });
      eq(fefoInvoice.lines.length, 2, 'FEFO split across two non-expired batches');
      const earlyLine = fefoInvoice.lines.find((l) => l.batchId === bEarly.id);
      const laterLine = fefoInvoice.lines.find((l) => l.batchId === bLater.id);
      const expiredLine = fefoInvoice.lines.find((l) => l.batchId === bExpired.id);

      eq(Number(earlyLine?.quantity), 3, 'Earliest batch exhausted first (3 units)');
      eq(Number(laterLine?.quantity), 1, 'Next batch took remaining 1 unit');
      eq(expiredLine, undefined, 'Expired batch strictly excluded from dispense');

      // ── STEP 6: Multi-Unit Packaging Conversion ──
      const medPack = await tx.medicineMaster.create({
        data: {
          code: `${marker}-PACK`,
          name: `${marker}-Pack Medicine`,
          unit: 'Tablet',
          baseUnitId: unitTab.id,
          batchManaged: false,
          saleRate: 10,
          purchaseRate: 5,
          packagingLevels: {
            create: [
              { unitId: unitTab.id, level: 0, conversionToBase: 1, isSaleUnit: true, isPurchaseUnit: true },
              { unitId: unitBox.id, level: 1, conversionToBase: 10, isSaleUnit: true, isPurchaseUnit: true, overrideSaleRate: 90 }, // Box of 10 for 90 PKR
            ],
          },
        },
      });

      await tx.stockLedgerEntry.create({
        data: { medicineId: medPack.id, movementType: 'OPENING_STOCK', quantityDelta: 50, actorId: cashierA.id, referenceTable: 'test', referenceId: medPack.id },
      });

      // Cashier A sells 2 Boxes (20 Tablets)
      const salePack = await pharmacyService.dispenseRetail(
        {
          customerName: 'Patient Box',
          invoiceDiscount: 0,
          lines: [{ medicineId: medPack.id, saleUnitId: unitBox.id, saleUnitQuantity: 2, discountAmount: 0 }],
          payments: [{ amount: 180, method: 'CASH' }],
        },
        cashierA.id,
        tx
      );

      const packInvoice = await tx.pharmacyInvoice.findUniqueOrThrow({ where: { id: salePack.id }, include: { lines: true } });
      eq(Number(packInvoice.lines[0].quantity), 20, '2 Boxes deducted 20 base units (Tablets) from stock');
      eq(await getStock(medPack.id), 30, 'Remaining stock is exactly 30 base units');

      // ── STEP 7: Sales Return & Inventory Restock ──
      const refund = await pharmacyService.salesReturn(
        {
          invoiceId: saleA.id,
          requestKey: randomUUID(),
          reason: 'Customer returned 1 tablet',
          refundMethod: 'CASH',
          lines: [{ invoiceLineId: saleA.lines[0].id, quantity: 1, restock: true }],
        },
        cashierA.id,
        tx
      );

      eq(await getStock(med1.id), 6, 'Stock restored from 5 to 6 after 1 unit return with restock=true');

      // ── STEP 8: Cashier Balance & Custody Segregation ──
      const expectedA = await cashService.expectedCash(cashierA.id, tx);
      const expectedB = await cashService.expectedCash(cashierB.id, tx);

      // Cashier A collected: 150 (SaleA) + 400 (SaleFEFO) + 180 (SalePack) - 50 (Refund) = 680 PKR
      // Cashier B collected: 100 (SaleB) = 100 PKR
      eq(Number(expectedA), 680, 'Cashier A physical cash drawer is exactly 680 PKR');
      eq(Number(expectedB), 100, 'Cashier B physical cash drawer is exactly 100 PKR');

      console.log('Rolling back multi-user test transaction...');
      throw rollback;
    });
  } catch (err: any) {
    if (err !== rollback) throw err;
  }

  await db.$disconnect();
  console.log(`\n=== ALL ${checks} MULTI-USER POS & CONCURRENT CASHIER ASSERTIONS PASSED! ===\n`);
}

main().catch((err) => {
  console.error('FAILED MULTI-USER POS ASSERTIONS:', err);
  process.exit(1);
});
