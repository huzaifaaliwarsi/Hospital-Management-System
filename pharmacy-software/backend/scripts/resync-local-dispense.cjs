// Replays an existing dispense snapshot; never dispenses stock or takes payment.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ref = process.argv[2];
  if (!ref) throw new Error('Usage: node scripts/resync-local-dispense.cjs REQ-number');
  const request = await prisma.medicineRequest.findFirst({
    where: { externalRequestRef: ref },
    include: { handledByUser: true, invoice: { include: {
      lines: { include: { medicine: true, batch: true }, orderBy: { dispensedAt: 'asc' } },
    } } },
  });
  if (!request?.invoice || !['DISPENSED', 'PARTIALLY_ACCEPTED'].includes(request.status)) {
    throw new Error('No posted dispense for this request');
  }
  const invoice = request.invoice;
  const event = invoice.lines.at(-1)?.dispenseEventId;
  if (!event) throw new Error('Missing dispense event identity');
  const linked = await prisma.medicineRequest.findMany({
    where: { invoiceId: invoice.id }, select: { externalRequestRef: true, status: true },
  });
  const response = await fetch('http://localhost:4000/api/v1/pharmacy-bridge/callback/dispensed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bridge-token': process.env.INTERNAL_BRIDGE_SECRET },
    body: JSON.stringify({
      dispenseEventId: event, externalAdmissionRef: request.externalAdmissionRef,
      externalRequestRef: request.externalRequestRef,
      pharmacyInvoiceId: invoice.id, pharmacyInvoiceNumber: invoice.invoiceNumber,
      subtotal: Number(invoice.subtotal), taxTotal: Number(invoice.taxTotal),
      discountTotal: Number(invoice.discountTotal), totalAmount: Number(invoice.total),
      dispensedBy: request.handledByUser?.fullName || 'Pharmacy',
      dispensedAt: invoice.lines.at(-1).dispensedAt.toISOString(),
      requestStatuses: linked.filter(r => r.externalRequestRef && ['DISPENSED', 'PARTIALLY_ACCEPTED'].includes(r.status))
        .map(r => ({ externalRequestRef: r.externalRequestRef,
          status: r.status === 'DISPENSED' ? 'DISPENSED' : 'PARTIALLY_FULFILLED' })),
      lines: invoice.lines.map(l => ({
        dispenseEventId: l.dispenseEventId, externalRequestRef: l.externalRequestRef,
        medicineName: l.medicine.name, batchNumber: l.batch?.batchNumber,
        quantity: Number(l.quantity), rate: Number(l.rateSnapshot), lineNet: Number(l.lineNet),
      })),
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || `HTTP ${response.status}`);
  console.log(JSON.stringify({ http: response.status, request: ref, amount: Number(invoice.total),
    alreadyProcessed: result.data?.alreadyProcessed }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
