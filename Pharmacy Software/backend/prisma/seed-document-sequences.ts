/**
 * One-time idempotent seed — sets each DocumentSequence counter's starting
 * point from CURRENT data, so the new system-generated codes continue
 * forward from where the old manual/Date.now()-based identifiers left off,
 * without ever renaming or colliding with a historical record's code.
 *
 * Safe to re-run: only raises a counter, never lowers one already set higher
 * by real usage since this last ran.
 */
import { PrismaClient } from '@prisma/client';
import { SEQUENCE } from '../src/shared/sequence';

const prisma = new PrismaClient();

async function raiseTo(key: string, value: number) {
  const existing = await prisma.documentSequence.findUnique({ where: { key } });
  if (existing && existing.lastValue >= value) return;
  await prisma.documentSequence.upsert({
    where: { key },
    create: { key, lastValue: value },
    update: { lastValue: value },
  });
  console.log(`  ${key} -> ${value}`);
}

async function main() {
  const [vendorCount, purchaseCount, retailInvoiceCount, hmsInvoiceCount, requestCount, adjustmentCount, expenseCount, settlementCount] =
    await Promise.all([
      prisma.vendor.count(),
      prisma.purchase.count(),
      prisma.pharmacyInvoice.count({ where: { channel: 'RETAIL' } }),
      prisma.pharmacyInvoice.count({ where: { channel: 'HMS_LINKED' } }),
      prisma.medicineRequest.count(),
      prisma.stockAdjustment.count(),
      prisma.expense.count(),
      prisma.accountSettlement.count(),
    ]);

  // Medicine already uses clean MED-### codes from earlier work — seed from the highest existing numeric suffix, not just the row count, so a gap never causes a re-issued number.
  const medicines = await prisma.medicineMaster.findMany({ select: { code: true } });
  const medicineMax = medicines.reduce((max, m) => {
    const n = Number(m.code.match(/(\d+)$/)?.[1] ?? 0);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  console.log('Seeding document sequence counters…');
  await raiseTo(SEQUENCE.VENDOR.key, vendorCount);
  await raiseTo(SEQUENCE.MEDICINE.key, Math.max(medicineMax, medicines.length));
  await raiseTo(SEQUENCE.PURCHASE.key, purchaseCount);
  await raiseTo(SEQUENCE.INVOICE_RETAIL.key, retailInvoiceCount);
  await raiseTo(SEQUENCE.INVOICE_HMS.key, hmsInvoiceCount);
  await raiseTo(SEQUENCE.MEDICINE_REQUEST.key, requestCount);
  await raiseTo(SEQUENCE.STOCK_ADJUSTMENT.key, adjustmentCount);
  await raiseTo(SEQUENCE.EXPENSE.key, expenseCount);
  await raiseTo(SEQUENCE.SETTLEMENT.key, settlementCount);
  // RETURN / PETTY_CASH / VENDOR_PAYMENT have no prior dedicated counter to inherit from (no historical rows carried a code of this kind) — start at 0.

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
