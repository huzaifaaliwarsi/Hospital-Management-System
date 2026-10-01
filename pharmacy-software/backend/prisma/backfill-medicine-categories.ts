/**
 * One-time idempotent backfill — for every DISTINCT existing `categoryLabel`
 * (the legacy free-text "category" column) on MedicineMaster, creates a
 * matching MedicineCategory row (if one doesn't already exist) and points
 * the medicine's new categoryId at it. Seeds the category master from real
 * data and migrates every pre-existing medicine onto the relation without
 * ever changing what a medicine displays as its category.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const medicines = await prisma.medicineMaster.findMany({
    where: { categoryId: null, categoryLabel: { not: null } },
    select: { id: true, categoryLabel: true },
  });

  const labels = [...new Set(medicines.map((m) => m.categoryLabel!.trim()).filter(Boolean))];
  console.log(`Found ${medicines.length} medicines across ${labels.length} distinct category labels to backfill.`);

  const idByLabel = new Map<string, string>();
  for (const label of labels) {
    const category = await prisma.medicineCategory.upsert({
      where: { name: label },
      create: { name: label },
      update: {},
    });
    idByLabel.set(label, category.id);
    console.log(`  category "${label}" -> ${category.id}`);
  }

  for (const med of medicines) {
    const categoryId = idByLabel.get(med.categoryLabel!.trim());
    if (!categoryId) continue;
    await prisma.medicineMaster.update({ where: { id: med.id }, data: { categoryId } });
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
