import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { pharmacyService } from '../src/modules/pharmacy/pharmacy.service';
import { financialReport, loadFinancialData } from '../src/modules/reports/financialRecognition';
import { recordHmsCollection } from '../src/modules/hms-requests/hms-requests.service';
import { summarizeCashEntries } from '../src/modules/cash/balanceSheet.util';
import { tableExportHtml, summarizeInvoiceTransactions, originalInvoiceForAction } from '../../frontend/src/utils/transactionExport';
import { prisma } from '../src/db/client';

const db = new PrismaClient();
const rollback = new Error('ROLLBACK_INSTALLMENT_TEST');
const at = (day: number) => new Date(`2026-11-${String(day).padStart(2, '0')}T12:00:00Z`);
let checks = 0;
function eq(a: unknown, b: unknown, label: string) { assert.deepEqual(a, b, label); checks++; console.log('PASS', label); }

async function main() {
  try {
    await db.$transaction(async tx => {
      const marker = 'INSTALLMENT-' + randomUUID();
      const user = await tx.portalUser.create({ data: { username: marker, fullName: marker, passwordHash: 'NO-LOGIN', role: 'SALES_DISPENSING' } });
      const bank = await tx.paymentAccount.create({ data: { name: marker } });
      const unit = await tx.unit.create({ data: { name: marker, shortCode: marker.slice(-8) } });
      const medicine = await tx.medicineMaster.create({ data: { code: marker, name: marker, unit: 'Tablet', baseUnitId: unit.id, batchManaged: false, saleRate: 100, purchaseRate: 60, packagingLevels: { create: { unitId: unit.id, conversionToBase: 1, isSaleUnit: true, level: 0 } } } });
      await tx.stockLedgerEntry.create({ data: { medicineId: medicine.id, movementType: 'OPENING_STOCK', quantityDelta: 100, actorId: user.id, referenceTable: 'test_fixture', referenceId: medicine.id } });
      const initial = await pharmacyService.dispenseRetail({ customerName: marker, invoiceDiscount: 0, lines: [{ medicineId: medicine.id, saleUnitQuantity: 10, discountAmount: 0 }], payments: [{ amount: 500, method: 'CASH' }] }, user.id, tx);
      // Move only newly-created test fixtures to the requested example dates.
      await tx.pharmacyInvoice.update({ where: { id: initial.id }, data: { createdAt: at(1) } });
      await tx.pharmacyPayment.updateMany({ where: { invoiceId: initial.id }, data: { paidAt: at(1) } });
      await tx.cashLedgerEntry.updateMany({ where: { referenceId: initial.id }, data: { occurredAt: at(1) } });
      const original = await tx.pharmacyInvoice.findUniqueOrThrow({ where: { id: initial.id }, include: { lines: true, payments: true } });
      const ids = [initial.id];
      const report = async (day: number) => {
        const data = await loadFinancialData(tx);
        return financialReport({ ...data, invoices: data.invoices.filter(i => ids.includes(i.id)), expenses: [] }, { gte: new Date(at(day).getTime() - 12 * 3600000), lte: new Date(at(day).getTime() + 12 * 3600000 - 1) }).totals;
      };
      const post = async (amount: number, day: number, method: 'CASH' | 'ONLINE' | 'BANK' = 'CASH', key = randomUUID()) => {
        const body = { amount, method, requestKey: key, paymentAccountId: method === 'CASH' ? undefined : bank.id };
        const updated = await pharmacyService.addPayment(initial.id, body, user.id, tx);
        const p = updated.payments.find(p => p.requestKey === key)!;
        await tx.pharmacyPayment.update({ where: { id: p.id }, data: { paidAt: at(day) } });
        await tx.cashLedgerEntry.updateMany({ where: { referenceId: initial.id, note: 'Receipt PAY-' + p.id }, data: { occurredAt: at(day) } });
        return body;
      };
      const second = await post(200, 6, 'ONLINE');
      await pharmacyService.addPayment(initial.id, second, user.id, tx);
      let rows = (await pharmacyService.listInvoices({ transactions: 'true' }, tx)).filter(r => ('invoiceId' in r) && r.invoiceId === initial.id) as any[];
      eq(rows.length, 2, 'A: one original plus one remaining collection row');
      eq(rows.map(r => [r.transactionType, r.billingAmount, r.collectedAmount, r.outstanding]), [['Remaining Collection', 0, 200, 300], ['Original Sale', 1000, 500, 300]], 'A: exact visible amounts; current outstanding on both rows');
      eq(summarizeInvoiceTransactions(rows), { billing: 1000, collected: 700, outstanding: 300, invoices: 1 }, 'A: frontend summary counts canonical outstanding once');
      eq((await report(6)).recognizedRevenue.toNumber(), 0, 'A: partial payment recognizes no revenue');
      eq((await report(6)).collections.toNumber(), 200, 'A: Nov 6 collection only 200');
      eq((await report(6)).total.toNumber(), 0, 'A: Nov 6 new billing zero');
      eq((await report(1)).outstanding.toNumber(), 500, 'C: Nov 1 historical outstanding stays 500');
      await assert.rejects(() => pharmacyService.addPayment(initial.id, { ...second, amount: 201 }, user.id, tx)); checks++;
      await assert.rejects(() => pharmacyService.addPayment(initial.id, { amount: 301, method: 'CASH', requestKey: randomUUID() }, user.id, tx)); checks++;
      await assert.rejects(() => pharmacyService.addPayment(initial.id, { amount: 1, method: 'ONLINE', requestKey: randomUUID() }, user.id, tx)); checks++;
      const final = await post(300, 16, 'BANK');
      await pharmacyService.addPayment(initial.id, final, user.id, tx);
      const saved = await tx.pharmacyInvoice.findUniqueOrThrow({ where: { id: initial.id }, include: { lines: true, payments: true } });
      eq(saved.lines, original.lines, 'B: original sale details unchanged');
      eq(saved.createdAt, original.createdAt, 'B: original invoice date unchanged');
      eq(saved.payments.find(p => p.id === original.payments[0]!.id), original.payments[0], 'B: initial receipt unchanged');
      eq([saved.payments.length, Number(saved.paidTotal), Number(saved.outstanding), saved.status], [3, 1000, 0, 'PAID'], 'B: three receipts, final clearance');
      eq(await tx.pharmacyInvoice.count({ where: { invoiceNumber: saved.invoiceNumber } }), 1, 'B: exactly one invoice');
      const recognizedDay1 = await report(1);
      eq([Number(recognizedDay1.recognizedRevenue), Number(recognizedDay1.recognizedCogs), Number(recognizedDay1.operatingProfit)], [1000, 600, 400], 'B: accrual revenue/COGS/profit at dispense date');
      const recognized = await report(16);
      eq([Number(recognized.recognizedRevenue), Number(recognized.recognizedCogs), Number(recognized.operatingProfit)], [0, 0, 0], 'B: zero revenue/COGS/profit at final installment payment date');
      eq(Number((await report(17)).recognizedRevenue), 0, 'B: no repeated recognition next day');
      eq(Number((await report(6)).outstanding), 300, 'C: Nov 6 historical outstanding stays 300 after clearance');
      const ledger = await tx.cashLedgerEntry.findMany({ where: { referenceId: initial.id } });
      eq(ledger.length, 3, 'D: retries create no duplicate ledger entries');
      const custody = summarizeCashEntries(ledger);
      eq([Number(custody.expectedPhysicalCash), Number(custody.nonPhysicalTotal)], [500, 500], 'D: cash custody 500, digital 500');
      eq(ledger.filter(e => !e.isPhysicalCash).every(e => e.paymentAccountId === bank.id && e.portalUserId === user.id), true, 'D: actual collector and named account');
      rows = (await pharmacyService.listInvoices({ transactions: 'true' }, tx)).filter(r => ('invoiceId' in r) && r.invoiceId === initial.id) as any[];
      eq(rows.every(r => originalInvoiceForAction(r).id === initial.id), true, 'D: Print, Refund and Collect actions target original invoice ID');
      eq(new Set(rows.map(r => r.id)).size, 3, 'D: unique transaction IDs');
      const nov6 = rows.filter(r => r.transactionAt.toISOString().slice(0, 10) === '2026-11-06');
      eq(nov6.map(r => [r.billingAmount, r.collectedAmount]), [[0, 200]], 'D: collection-date filter');
      const html = tableExportHtml([{ key: 'invoiceNumber', header: 'Invoice' }, { key: 'transactionType', header: 'Type' }, { key: 'billingAmount', header: 'Billing' }, { key: 'collectedAmount', header: 'Collected' }], rows, 'Test');
      eq((html.match(/Remaining Collection/g) || []).length, 2, 'D: print/PDF export includes every installment');
      const refund = await pharmacyService.salesReturn({ invoiceId: initial.id, requestKey: randomUUID(), reason: 'Test', refundMethod: 'BANK', paymentAccountId: bank.id, lines: [{ invoiceLineId: original.lines[0]!.id, quantity: 1, restock: true }] }, user.id, tx);
      await tx.pharmacyFinancialEvent.updateMany({ where: { reference: refund.cashLedgerEntryId }, data: { occurredAt: at(17) } });
      await tx.cashLedgerEntry.update({ where: { id: refund.cashLedgerEntryId }, data: { occurredAt: at(17) } });
      rows = (await pharmacyService.listInvoices({ transactions: 'true' }, tx)).filter(r => ('invoiceId' in r) && r.invoiceId === initial.id) as any[];
      eq(rows.find(r => r.transactionType === 'Original Sale').billingAmount, 1000, 'D: return does not rewrite original displayed billing');
      eq(rows.filter(r => r.transactionType === 'Return / Refund').map(r => [r.billingAmount, r.collectedAmount]), [[-100, -100]], 'D: one traceable return event');
      eq([Number((await report(17)).recognizedRevenue), Number((await report(17)).recognizedCogs)], [-100, -60], 'D: refund reverses matched revenue and cost once');
      const hms = await tx.pharmacyInvoice.create({ data: { invoiceNumber: marker + '-HMS', channel: 'HMS_LINKED', collectionOwner: 'HMS_FRONT_DESK', createdAt: at(1), total: 1000, subtotal: 1000, outstanding: 1000, dispensedById: user.id } });
      const hmsReceipt = marker + '-receipt';
      await recordHmsCollection(hms.invoiceNumber, new Prisma.Decimal(500), false, hmsReceipt, at(6), 'CASH', 'HMS cashier', tx);
      await recordHmsCollection(hms.invoiceNumber, new Prisma.Decimal(500), false, hmsReceipt, at(6), 'CASH', 'HMS cashier', tx);
      const hmsRows = (await pharmacyService.listInvoices({ transactions: 'true', channel: 'HMS_LINKED' }, tx)).filter(r => ('invoiceId' in r) && r.invoiceId === hms.id) as any[];
      await assert.rejects(() => recordHmsCollection(hms.invoiceNumber, new Prisma.Decimal(501), false, marker + '-overpay', at(16), 'CASH', 'HMS cashier', tx)); checks++;
      eq(hmsRows.length, 2, 'D: HMS callback retry has one visible receipt event');
      eq(await tx.cashLedgerEntry.count({ where: { referenceId: hms.id } }), 0, 'D: HMS callback creates no pharmacy cash custody');
      await assert.rejects(() => pharmacyService.addPayment(hms.id, { amount: 100, method: 'CASH', requestKey: randomUUID() }, user.id, tx)); checks++;
      console.log('EVIDENCE', JSON.stringify({ invoiceCount: 1, receiptCount: saved.payments.length, invoiceDate: saved.createdAt, receipts: saved.payments.map(p => ({ amount: p.amount, at: p.paidAt, method: p.method })), billing: 1000, collections: 1000, outstanding: 0, revenue: 1000, cogs: 600 }));
      throw rollback;
    }, { timeout: 120000 });
  } catch (error) { if (error !== rollback) throw error; }

  // Separate real connections exercise PostgreSQL locking. Only these disposable fixtures are committed.
  const marker = 'CONCURRENT-' + randomUUID();
  const user = await db.portalUser.create({ data: { username: marker, fullName: marker, passwordHash: 'NO-LOGIN', role: 'SALES_DISPENSING' } });
  const inv = await db.pharmacyInvoice.create({ data: { invoiceNumber: marker, channel: 'RETAIL', total: 1000, subtotal: 1000, outstanding: 1000, dispensedById: user.id } });
  try {
    const results = await Promise.allSettled([1, 2].map(() => pharmacyService.addPayment(inv.id, { amount: 700, method: 'CASH', requestKey: randomUUID() }, user.id)));
    eq(results.map(r => r.status).sort(), ['fulfilled', 'rejected'], 'D: simultaneous collectors cannot overpay');
    const body = { amount: 300, method: 'CASH' as const, requestKey: randomUUID() };
    await Promise.all([pharmacyService.addPayment(inv.id, body, user.id), pharmacyService.addPayment(inv.id, body, user.id)]);
    eq(await db.pharmacyPayment.count({ where: { invoiceId: inv.id } }), 2, 'D: concurrent retry creates exactly one final receipt');
    eq(await db.cashLedgerEntry.count({ where: { referenceId: inv.id } }), 2, 'D: concurrent retry creates exactly one final ledger entry');
  } finally {
    await db.$transaction(async tx => {
      await tx.cashLedgerEntry.deleteMany({ where: { referenceId: inv.id, portalUserId: user.id } });
      await tx.pharmacyPayment.deleteMany({ where: { invoiceId: inv.id } });
      await tx.pharmacyInvoice.delete({ where: { id: inv.id } });
      await tx.portalUser.delete({ where: { id: user.id } });
    });
  }
  console.log(`${checks} historical collection assertions passed. Fixtures rolled back / cleaned.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); await prisma.$disconnect(); });
