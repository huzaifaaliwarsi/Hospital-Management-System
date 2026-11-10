const { PrismaClient, Prisma } = require('@prisma/client');
const Decimal = Prisma.Decimal;
const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.hospitalInvoice.findMany({
    include: {
      lines: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  console.log(`Checking ${invoices.length} invoices for duplicate service lines...`);

  for (const inv of invoices) {
    const lines = inv.lines;
    const seen = new Map();
    const toDelete = [];

    for (const line of lines) {
      if (line.roomChargeLogId) continue;
      const isSelf =
        line.discountReason?.includes('Self-Arranged') ||
        line.discountReason?.includes('Self Arranged') ||
        (Number(line.lineGross) === 0 && Number(line.rateSnapshot) === 0);

      const key = `${line.serviceRateId || line.descriptionSnapshot}_${line.rateSnapshot}_${isSelf}_${line.performedByStaffId || 'null'}`;

      if (seen.has(key)) {
        const master = seen.get(key);
        // Merge into master
        master.quantity = new Decimal(master.quantity).plus(new Decimal(line.quantity));
        master.lineGross = new Decimal(master.lineGross).plus(new Decimal(line.lineGross));
        master.discountAmount = new Decimal(master.discountAmount).plus(new Decimal(line.discountAmount));
        master.lineNet = new Decimal(master.lineNet).plus(new Decimal(line.lineNet));
        master.patientShare = new Decimal(master.patientShare || 0).plus(new Decimal(line.patientShare || 0));
        master.panelReceivable = new Decimal(master.panelReceivable || 0).plus(new Decimal(line.panelReceivable || 0));
        toDelete.push(line.id);
      } else {
        seen.set(key, { ...line });
      }
    }

    if (toDelete.length > 0) {
      console.log(`Invoice ${inv.invoiceNumber} (${inv.id}): merging ${toDelete.length} duplicate lines...`);
      await prisma.$transaction(async (tx) => {
        // Delete commission accruals for duplicates
        await tx.doctorCommissionAccrual.deleteMany({
          where: { invoiceLineItemId: { in: toDelete } },
        });

        // Delete duplicate lines
        await tx.invoiceLineItem.deleteMany({
          where: { id: { in: toDelete } },
        });

        // Update master lines
        for (const [_, master] of seen) {
          await tx.invoiceLineItem.update({
            where: { id: master.id },
            data: {
              quantity: master.quantity,
              lineGross: master.lineGross,
              discountAmount: master.discountAmount,
              lineNet: master.lineNet,
              patientShare: master.patientShare,
              panelReceivable: master.panelReceivable,
            },
          });
        }

        // Recalculate invoice totals
        const remaining = await tx.invoiceLineItem.findMany({ where: { hospitalInvoiceId: inv.id } });
        const subtotal = remaining.reduce((sum, l) => sum.plus(l.lineGross), new Decimal(0));
        const discountTotal = remaining.reduce((sum, l) => sum.plus(l.discountAmount), new Decimal(0));
        const total = remaining.reduce((sum, l) => sum.plus(l.lineNet), new Decimal(0));
        const patientShare = remaining.reduce((sum, l) => sum.plus(l.patientShare || 0), new Decimal(0));
        const panelReceivable = remaining.reduce((sum, l) => sum.plus(l.panelReceivable || 0), new Decimal(0));

        await tx.hospitalInvoice.update({
          where: { id: inv.id },
          data: {
            subtotal,
            discountTotal,
            total,
            patientShare,
            panelReceivable,
          },
        });
      });
      console.log(`Invoice ${inv.invoiceNumber}: merged successfully!`);
    }
  }

  console.log('Cleanup completed.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
