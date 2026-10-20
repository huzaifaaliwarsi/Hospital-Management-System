/** Aggregate-only audit output: no patient names, credentials, or data writes. */
import { prisma } from '../src/db/client';
import { Decimal } from '@prisma/client/runtime/library';
async function main() {
  const [invoices, stocks, admissions, beds, panelPayments, providerPayments] = await Promise.all([
    prisma.hospitalInvoice.findMany({
      where: { status: { not: 'VOID' } },
      select: {
        total: true, paidTotal: true, panelReceivable: true,
        lines: { select: { lineNet: true } },
        paymentReceipts: { select: { amount: true, isReversed: true } },
        panelRemittanceAllocations: { select: { allocatedAmount: true } },
      },
    }),
    prisma.stockLedger.groupBy({ by: ['stockItemId'], _sum: { quantityDelta: true } }),
    prisma.admissionRecord.findMany({
      where: { status: { in: ['PLANNED', 'CONFIRMED', 'ACTIVE', 'DISCHARGE_PENDING'] }, bedId: { not: null } },
      select: { bedId: true },
    }),
    prisma.bed.findMany({ select: { id: true, status: true } }),
    prisma.panelRemittance.aggregate({ _count: true, _sum: { amount: true } }),
    prisma.providerSettlement.aggregate({ _count: true, _sum: { settlementAmount: true } }),
  ]);
  const sum = (values: Decimal[]) => values.reduce((s, n) => s.plus(n), new Decimal(0));
  const bedUses = new Map<string, number>();
  admissions.forEach(a => { if (a.bedId) bedUses.set(a.bedId, (bedUses.get(a.bedId) ?? 0) + 1); });
  console.log(JSON.stringify({
    nonVoidInvoiceCount: invoices.length,
    invoiceLineTotalMismatchCount: invoices.filter(i => i.lines.length && !sum(i.lines.map(l => l.lineNet)).eq(i.total)).length,
    invoiceReceiptBalanceFlagCount: invoices.filter(i => !sum(i.paymentReceipts.filter(r => !r.isReversed || r.amount.lt(0)).map(r => r.amount)).eq(i.paidTotal)).length,
    negativeInventoryItemCount: stocks.filter(s => s._sum.quantityDelta?.lt(0)).length,
    bedsAssignedToMultipleOpenAdmissions: [...bedUses.values()].filter(n => n > 1).length,
    occupiedBedsWithoutOpenAdmission: beds.filter(b => b.status === 'OCCUPIED' && !bedUses.has(b.id)).length,
    availableBedsWithOpenAdmission: beds.filter(b => b.status === 'AVAILABLE' && bedUses.has(b.id)).length,
    panelRemittances: { count: panelPayments._count, amount: String(panelPayments._sum.amount ?? 0) },
    panelRealizationOmittedByManagementOutstanding: String(sum(invoices.flatMap(i => i.panelRemittanceAllocations.map(a => a.allocatedAmount)))),
    providerSettlements: { count: providerPayments._count, amount: String(providerPayments._sum.settlementAmount ?? 0) },
  }, null, 2));
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Audit failed');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
