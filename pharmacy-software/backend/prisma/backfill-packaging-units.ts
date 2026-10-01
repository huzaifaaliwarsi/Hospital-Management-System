/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

/**
 * Phase 2 backfill for the configurable medicine-packaging/unit system
 * (medicine-packaging-plan). Idempotent — safe to run repeatedly; every
 * write is guarded by a "already has this field set" check.
 *
 * What it does, in order:
 *  1. Seeds the standard Unit catalog (upsert by name, isSystem=true).
 *  2. For every MedicineMaster without a baseUnitId: finds-or-creates a Unit
 *     matching its legacy free-text `unit` string, sets baseUnitId, and
 *     creates a single level=0 MedicinePackagingLevel (conversionToBase=1) —
 *     i.e. every existing medicine becomes a "single-level" packaging medicine,
 *     functionally identical to today's flat-unit behaviour.
 *  3. For every MedicineBatch without a purchaseUnitId: snapshots
 *     conversionToBase=1 in its medicine's base unit (exactly what already
 *     happened implicitly before this feature existed).
 *  4. For every PurchaseLine without a purchaseUnitId: same 1:1 snapshot,
 *     purchaseUnitQuantity = quantity (unchanged value).
 *
 * Run with: npx tsx prisma/backfill-packaging-units.ts
 */
const prisma = new PrismaClient();

const STANDARD_UNITS = [
  'Box', 'Carton', 'Pack', 'Strip', 'Tablet', 'Capsule', 'Bottle',
  'Glass Bottle', 'Vial', 'Ampoule', 'Sachet', 'Tube', 'Jar', 'Bag', 'Piece',
];

async function seedStandardUnits() {
  let created = 0;
  for (const name of STANDARD_UNITS) {
    const existing = await prisma.unit.findUnique({ where: { name } });
    if (existing) continue;
    await prisma.unit.create({ data: { name, isSystem: true } });
    created++;
  }
  console.log(`Units: ${created} standard unit(s) created, ${STANDARD_UNITS.length - created} already present.`);
}

/** Case-insensitive find-or-create against the Unit catalog for a legacy free-text label. */
async function findOrCreateUnitForLabel(label: string): Promise<string> {
  const trimmed = label.trim();
  const existing = await prisma.unit.findFirst({ where: { name: { equals: trimmed, mode: 'insensitive' } } });
  if (existing) return existing.id;
  const created = await prisma.unit.create({ data: { name: trimmed, isSystem: false } });
  console.log(`  + created custom Unit "${trimmed}" (no standard match)`);
  return created.id;
}

async function backfillMedicines() {
  const medicines = await prisma.medicineMaster.findMany({ where: { baseUnitId: null } });
  console.log(`Medicines missing baseUnitId: ${medicines.length}`);
  for (const med of medicines) {
    await prisma.$transaction(async (tx) => {
      const unitId = await findOrCreateUnitForLabel(med.unit);
      await tx.medicineMaster.update({ where: { id: med.id }, data: { baseUnitId: unitId } });
      await tx.medicinePackagingLevel.upsert({
        where: { medicineId_level: { medicineId: med.id, level: 0 } },
        create: { medicineId: med.id, unitId, level: 0, conversionToBase: 1, isPurchaseUnit: true, isSaleUnit: true },
        update: { unitId, conversionToBase: 1 },
      });
    });
  }
  console.log(`Medicines backfilled: ${medicines.length}`);
}

async function backfillBatches() {
  const batches = await prisma.medicineBatch.findMany({ where: { purchaseUnitId: null }, include: { medicine: true } });
  console.log(`Batches missing purchaseUnitId: ${batches.length}`);
  for (const batch of batches) {
    const baseUnitId = batch.medicine.baseUnitId;
    if (!baseUnitId) continue; // medicine backfill above guarantees this is set by the time we get here
    const unit = await prisma.unit.findUnique({ where: { id: baseUnitId } });
    await prisma.medicineBatch.update({
      where: { id: batch.id },
      data: {
        purchaseUnitId: baseUnitId,
        purchaseUnitConversionToBase: 1,
        packagingSnapshotJson: [{ unit: unit?.name ?? batch.medicine.unit, conversionToBase: 1 }],
      },
    });
  }
  console.log(`Batches backfilled: ${batches.length}`);
}

async function backfillPurchaseLines() {
  const lines = await prisma.purchaseLine.findMany({ where: { purchaseUnitId: null }, include: { medicine: true } });
  console.log(`Purchase lines missing purchaseUnitId: ${lines.length}`);
  for (const line of lines) {
    const baseUnitId = line.medicine.baseUnitId;
    if (!baseUnitId) continue;
    await prisma.purchaseLine.update({
      where: { id: line.id },
      data: { purchaseUnitId: baseUnitId, purchaseUnitQuantity: line.quantity, conversionToBaseSnapshot: 1 },
    });
  }
  console.log(`Purchase lines backfilled: ${lines.length}`);
}

async function verify() {
  const unsetMedicines = await prisma.medicineMaster.count({ where: { baseUnitId: null } });
  const unsetBatches = await prisma.medicineBatch.count({ where: { purchaseUnitId: null } });
  const unsetLines = await prisma.purchaseLine.count({ where: { purchaseUnitId: null } });
  console.log('\n--- Verification ---');
  console.log(`MedicineMaster with baseUnitId still null: ${unsetMedicines}`);
  console.log(`MedicineBatch with purchaseUnitId still null: ${unsetBatches}`);
  console.log(`PurchaseLine with purchaseUnitId still null: ${unsetLines}`);
  return unsetMedicines === 0 && unsetBatches === 0 && unsetLines === 0;
}

async function main() {
  await seedStandardUnits();
  await backfillMedicines();
  await backfillBatches();
  await backfillPurchaseLines();
  const clean = await verify();
  console.log(clean ? '\n✅ Backfill complete — 100% coverage, safe to tighten baseUnitId to NOT NULL.' : '\n⚠️ Backfill incomplete — investigate before tightening.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
