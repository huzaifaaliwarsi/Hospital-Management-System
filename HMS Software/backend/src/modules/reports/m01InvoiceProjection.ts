import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { allocateInvoiceAmount } from '@/shared/departmentCollections';
import { invoiceAsOf } from '@/shared/invoiceAsOf';

type Invoice = Prisma.HospitalInvoiceGetPayload<{ include: {
  department: true; doctor: true; createdByUser: true; selfPayEncounter: true; panelPatient: true;
  admissionRecord: { include: { department: true; selfPayEncounter: true; panelPatient: true } };
  lines: { include: { serviceRate: { include: { department: true } } } };
  paymentReceipts: { include: { collectedBy: true } };
  panelRemittanceAllocations: { include: { panelRemittance: { include: { receivedByUser: true } } } };
} }>;
// Only the selected fields are required; Prisma projections deliberately omit unrelated source fields.
type Source = Pick<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'createdById' | 'total' | 'subtotal' | 'discountTotal' | 'panelReceivable' | 'status' | 'encounterType' | 'sourceType' | 'departmentId'> & {
  department: { id: string; name: string } | null;
  doctor: { fullName: string } | null;
  appointment?: { department: { id: string; name: string } | null } | null;
  createdByUser: { displayName: string | null; username: string; role?: string } | null;
  selfPayEncounter: { fullName: string; mrNumber: string } | null;
  panelPatient: { fullName: string } | null;
  admissionRecord: { admissionNumber: string; department: { id: string; name: string } | null; selfPayEncounter: { fullName: string } | null; panelPatient: { fullName: string } | null } | null;
  lines: Array<Pick<Invoice['lines'][number], 'id' | 'createdAt' | 'descriptionSnapshot' | 'quantity' | 'rateSnapshot' | 'lineGross' | 'discountAmount' | 'lineNet' | 'patientShare' | 'panelReceivable'> & { serviceRate: { name: string; department: { id: string; name: string } | null } | null }>;
  paymentReceipts: Array<Pick<Invoice['paymentReceipts'][number], 'id' | 'receiptNumber' | 'amount' | 'collectedAt' | 'method' | 'collectedById' | 'isReversed'> & { collectedBy: { displayName: string | null; username: string; role?: string } }>;
  panelRemittanceAllocations: Array<{ allocatedAmount: Decimal; panelRemittance: { id: string; remittanceNumber: string; receivedAt: Date; method: string; receivedById: string; receivedByUser: { displayName: string | null; username: string; role?: string } } }>;
};
const name = (u: { displayName: string | null; username: string; role?: string } | null) => u?.displayName || u?.username || 'Unassigned';
const portalFor = (role?: string) => ({ FRONT_DESK_BILLING: 'Billing', ADMIN: 'Admin', SUPER_ADMIN: 'Super Admin', INVENTORY_MANAGEMENT: 'Inventory' }[role || ''] || 'Unassigned');
const normalizeMethod = (method: string) => method.toUpperCase().replace(/BANK[_ ]TRANSFER/, 'BANK');

/** Read-only M01 projection. Patient receipts are invoice-linked; panel payments use allocation amounts. */
export function projectM01Invoice(source: Source, start: Date, end: Date, filters: { departmentId?: string; method?: string; portalUserId?: string } = {}) {
  const inv = { ...source, department: source.department ?? source.appointment?.department ?? source.admissionRecord?.department ?? null,
    lines: source.lines.filter(l => l.createdAt <= end),
    paymentReceipts: source.paymentReceipts.filter(r => r.collectedAt <= end && (!r.isReversed || Number(r.amount) < 0)),
    panelRemittanceAllocations: source.panelRemittanceAllocations.filter(a => a.panelRemittance.receivedAt <= end) };
  // Service amounts are historical snapshots; later admission lines must not leak into a cutoff.
  if (source.lines.length) {
    inv.subtotal = inv.lines.reduce((s, l) => s.plus(l.lineGross), new Decimal(0));
    inv.discountTotal = inv.lines.reduce((s, l) => s.plus(l.discountAmount), new Decimal(0));
    inv.total = inv.lines.reduce((s, l) => s.plus(l.lineNet), new Decimal(0));
    inv.panelReceivable = inv.lines.reduce((s, l) => s.plus(l.panelReceivable), new Decimal(0));
  }
  const scoped = (amount: Decimal, basis: 'lineNet' | 'patientShare' | 'panelReceivable') =>
    allocateInvoiceAmount(amount, inv, basis).filter(d => !filters.departmentId || d.departmentId === filters.departmentId).reduce((s, d) => s + Number(d.amount), 0);
  const asOf = invoiceAsOf(inv);
  const outstanding = scoped(asOf.balance.patientDue, 'patientShare') + scoped(asOf.balance.panelDue, 'panelReceivable');
  const payments = [
    ...inv.paymentReceipts.map(r => ({ id: r.id, reference: r.receiptNumber, date: r.collectedAt.toISOString(), method: normalizeMethod(r.method), amount: scoped(r.amount, 'patientShare'), collectedBy: name(r.collectedBy), actorId: r.collectedById, portal: portalFor(r.collectedBy.role), status: Number(r.amount) < 0 ? 'Refund' : 'Valid' })),
    ...inv.panelRemittanceAllocations.map(a => ({ id: a.panelRemittance.id, reference: a.panelRemittance.remittanceNumber, date: a.panelRemittance.receivedAt.toISOString(), method: normalizeMethod(a.panelRemittance.method), amount: scoped(a.allocatedAmount, 'panelReceivable'), collectedBy: name(a.panelRemittance.receivedByUser), actorId: a.panelRemittance.receivedById, portal: portalFor(a.panelRemittance.receivedByUser.role), status: 'Valid' })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const periodPayments = payments.filter(p => new Date(p.date) >= start && (!filters.method || filters.method === 'ALL' || p.method === filters.method) && (!filters.portalUserId || p.actorId === filters.portalUserId || inv.createdById === filters.portalUserId));
  const earnedLines = inv.lines.filter(l => l.createdAt >= start);
  const earned = earnedLines.length > 0 || (!source.lines.length && inv.createdAt >= start);
  const departments = allocateInvoiceAmount(inv.total, inv, 'lineNet');
  if ((filters.departmentId && !departments.some(d => d.departmentId === filters.departmentId)) || (!earned && !periodPayments.length)) return { outstanding, row: null };
  const earnedAmount = (key: 'lineGross' | 'discountAmount' | 'lineNet', fallback: Decimal) => source.lines.length
    ? earnedLines.filter(l => !filters.departmentId || (l.serviceRate?.department?.id ?? inv.department?.id) === filters.departmentId).reduce((s, l) => s + Number(l[key]), 0)
    : earned ? scoped(fallback, 'lineNet') : 0;
  const status = inv.status === 'VOID' ? 'VOID' : asOf.balance.due.lte(0) ? 'PAID' : Number(asOf.balance.collected) > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
  const row = {
    id: `inv-${inv.id}`, date: earned ? (earnedLines[0]?.createdAt ?? inv.createdAt).toISOString() : periodPayments[periodPayments.length - 1]!.date,
    reference: inv.invoiceNumber, transactionType: earned ? 'REVENUE' as const : 'COLLECTION' as const,
    typeLabel: earned ? `${inv.encounterType || inv.sourceType} / Hospital Billing` : 'Prior-Period Invoice Collection',
    patientPayeeDescription: inv.selfPayEncounter?.fullName || inv.panelPatient?.fullName || inv.admissionRecord?.selfPayEncounter?.fullName || inv.admissionRecord?.panelPatient?.fullName || 'Unassigned',
    encounterInvoiceRef: inv.selfPayEncounter?.mrNumber || inv.admissionRecord?.admissionNumber || inv.invoiceNumber,
    departmentId: filters.departmentId || (departments.length === 1 ? departments[0]!.departmentId ?? undefined : undefined),
    department: departments.length > 1 ? 'Multiple Departments' : departments[0]?.name || 'Unassigned',
    portalUserId: inv.createdById ?? undefined, portalUser: name(inv.createdByUser), portal: portalFor(inv.createdByUser?.role),
    status, statusLabel: status === 'PAID' ? 'Paid' : status === 'PARTIALLY_PAID' ? 'Partially Paid' : status === 'VOID' ? 'Voided' : 'Unpaid',
    grossBilling: earnedAmount('lineGross', inv.subtotal), discountCredit: earnedAmount('discountAmount', inv.discountTotal), tax: 0,
    netRevenue: earnedAmount('lineNet', inv.total), collectionsReceived: periodPayments.reduce((s, p) => s + p.amount, 0),
    recognizedExpense: 0, expensePaid: 0,
    cashIn: periodPayments.filter(p => p.method === 'CASH').reduce((s, p) => s + p.amount, 0), cashOut: 0,
    outstandingPayable: outstanding, paymentMethod: [...new Set(periodPayments.map(p => p.method))].join(', ') || 'N/A',
    details: { invoiceId: inv.id, invoiceDate: inv.createdAt.toISOString(), serviceType: inv.encounterType || inv.sourceType, doctor: inv.doctor?.fullName || 'Unassigned',
      cutoff: end.toISOString(), totalAppliedPayments: payments.reduce((s, p) => s + p.amount, 0), netInvoiceAmount: scoped(inv.total, 'lineNet'), payments,
      actorIds: periodPayments.map(p => p.actorId), actorPortals: periodPayments.map(p => p.portal), receiptReferences: payments.map(p => p.reference).join(' '),
      departments: departments.map(d => ({ ...d, amount: Number(d.amount) })),
      lines: inv.lines.map(l => ({ name: l.descriptionSnapshot || l.serviceRate?.name || 'Service', quantity: Number(l.quantity), rate: Number(l.rateSnapshot), gross: Number(l.lineGross), discount: Number(l.discountAmount), net: Number(l.lineNet), department: l.serviceRate?.department?.name || inv.department?.name || 'Unassigned' })) },
  };
  return { outstanding, row };
}
