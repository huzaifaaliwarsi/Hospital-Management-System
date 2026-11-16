import { Decimal } from '@prisma/client/runtime/library';

type Amount = Decimal | number | string;
type Payment = { id: string; amount: Amount; method: string; paidAt: Date; isInitial: boolean | null; paymentAccount?: { name: string } | null; collectedByUser: { fullName: string; username?: string } };
type Event = { id: string; kind: string; occurredAt: Date | null; collectionDelta: Amount; saleDelta: Amount; reference: string | null; method: string | null; actorId: string | null };
type Invoice = { id: string; createdAt: Date; total: Amount; outstanding: Amount; payments: Payment[]; financialEvents: Event[] };
type Refund = { id: string; referenceId: string | null; referenceNo: string | null; amount: Amount; occurredAt: Date; isPhysicalCash: boolean; paymentMethod: string | null; paymentAccount?: { name: string } | null; portalUser: { fullName: string } };
const day = (d: Date) => new Date(d.getTime() + 18000000).toISOString().slice(0, 10);
const sum = (values: Amount[]) => values.reduce<Decimal>((s, v) => s.plus(v), new Decimal(0)).toNumber();

/** Display only. Original invoice IDs stay in invoiceId; row IDs never become posting IDs. */
export function invoiceTransactions<T extends Invoice>(invoices: T[], refunds: Refund[] = []) {
  return invoices.flatMap(invoice => {
    const payments = [...invoice.payments].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime() || a.id.localeCompare(b.id));
    const first = payments.find(p => Number(p.amount) > 0);
    const initial = payments.filter(p => p.isInitial === true || (p.isInitial == null && (p.paidAt.getTime() === invoice.createdAt.getTime() || (p.id === first?.id && day(p.paidAt) === day(invoice.createdAt)))));
    const firstHms = [...invoice.financialEvents].filter(e => e.kind.startsWith('HMS_') && e.occurredAt && Number(e.collectionDelta) > 0).sort((a, b) => a.occurredAt!.getTime() - b.occurredAt!.getTime() || a.id.localeCompare(b.id))[0];
    const initialHms = firstHms?.occurredAt && day(firstHms.occurredAt) === day(invoice.createdAt) ? firstHms : undefined;
    const legacyRefunds = refunds.filter(r => r.referenceId === invoice.id && !invoice.financialEvents.some(e => e.reference === r.id));
    const eventRows = invoice.financialEvents.filter(e => e.id !== initialHms?.id).map(e => {
      const refund = refunds.find(r => r.id === e.reference);
      const shortEventRef = refund?.referenceNo || e.reference || (e.id ? 'EVT-' + e.id.slice(0, 8).toUpperCase() : e.id);
      return {
        id: 'event:' + e.id, at: e.occurredAt,
        type: e.kind === 'RETURN' ? 'Return / Refund' : Number(e.collectionDelta) < 0 ? 'Collection Reversal' : 'Remaining Collection',
        billing: Number(e.saleDelta), collected: Number(e.collectionDelta),
        receipt: shortEventRef,
        method: e.method || '', account: refund?.paymentAccount?.name || '',
        collector: refund?.portalUser.fullName || e.actorId || 'HMS Front Desk',
      };
    });
    const originalTotal = new Decimal(invoice.total).minus(sum(invoice.financialEvents.filter(e => e.kind === 'RETURN').map(e => e.saleDelta))).plus(sum(legacyRefunds.map(r => r.amount))).toNumber();
    const entries = [
      { id: 'invoice:' + invoice.id, at: invoice.createdAt, type: 'Original Sale', billing: originalTotal, collected: sum([...initial.map(p => p.amount), initialHms?.collectionDelta ?? 0]), receipt: [...initial.map(p => 'PAY-' + (p.id || '').slice(0, 8).toUpperCase()), initialHms?.reference].filter(Boolean).join(', '), method: [...initial.map(p => p.method), initialHms?.method].filter(Boolean).join(', '), account: initial.map(p => p.paymentAccount?.name || '').filter(Boolean).join(', '), collector: [...initial.map(p => p.collectedByUser.fullName), initialHms ? initialHms.actorId || 'HMS Front Desk' : null].filter(Boolean).join(', ') },
      ...payments.filter(p => !initial.some(i => i.id === p.id)).map(p => ({ id: 'payment:' + p.id, at: p.paidAt, type: Number(p.amount) < 0 ? 'Collection Reversal' : 'Remaining Collection', billing: 0, collected: Number(p.amount), receipt: 'PAY-' + (p.id || '').slice(0, 8).toUpperCase(), method: p.method, account: p.paymentAccount?.name || '', collector: p.collectedByUser.fullName })),
      ...eventRows,
      ...legacyRefunds.map(r => ({ id: 'refund:' + r.id, at: r.occurredAt, type: 'Legacy Return / Refund', billing: -Number(r.amount), collected: -Number(r.amount), receipt: r.referenceNo || (r.id ? 'REF-' + r.id.slice(0, 8).toUpperCase() : r.id), method: r.paymentMethod || (r.isPhysicalCash ? 'CASH' : 'UNKNOWN'), account: r.paymentAccount?.name || '', collector: r.portalUser.fullName })),
    ];
    return entries.map(e => ({ ...invoice, id: e.id, invoiceId: invoice.id, transactionId: e.id, transactionType: e.type, transactionAt: e.at, billingAmount: e.billing, collectedAmount: e.collected, receiptNumber: e.receipt, paymentMethod: e.method, paymentAccountName: e.account, collectedByName: e.collector, outstanding: Number(invoice.outstanding) }));
  }).sort((a, b) => (b.transactionAt?.getTime() ?? 0) - (a.transactionAt?.getTime() ?? 0) || a.id.localeCompare(b.id));
}
