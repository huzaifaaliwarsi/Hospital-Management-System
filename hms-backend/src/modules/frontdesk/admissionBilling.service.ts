import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
import type { CollectAdmissionPaymentBody } from './admissionBilling.schemas';

import { generateReceiptNumber, generateFinalBillNumber } from '@/shared/idGenerator';

const invoiceInclude = {
  department: { select: { id: true, name: true, code: true } },
  lines: { include: { serviceRate: true, performedBy: true } },
  paymentReceipts: { where: { isReversed: false } },
} as const;

function bedLabel(bed: any): { ward: string | null; room: string | null; bed: string | null } {
  if (!bed) return { ward: null, room: null, bed: null };
  return {
    ward: bed.room?.ward?.name ?? null,
    room: bed.room?.name ?? null,
    bed: bed.bedNumber ?? null,
  };
}

/**
 * Front Desk's consolidated view + payment collection over an admission's
 * **multiple** department invoices (HMS_V7.2_NEW_REQUIREMENTS.md §2.2/§2.10/
 * §2.11) — each department invoice stays independently owned
 * (`admission.service.ts`'s `addAdmissionService` already creates one per
 * department); this module is the presentation/allocation layer over them,
 * never a merge.
 *
 * v7.2 Admission Patient Records + Running Ledger — `listAdmissionRecords`,
 * `getLedger`, and `generateFinalBill` are the new additions: a single
 * flattened, chronological view across every department invoice's lines
 * PLUS every payment receipt (both invoice-allocated and the unallocated
 * admission-level advance/deposit receipts `getStatement`'s totals never
 * counted before). `collectPayment` gains overpayment handling so a
 * guardian paying more than the current outstanding banks the remainder as
 * a credit instead of being rejected.
 */
export const admissionBillingService = {
  /** Running Bill / Interim Statement (§2.10) — explicitly not a final discharge invoice. */
  async getStatement(admissionId: string) {
    const admission = await prisma.admissionRecord.findUnique({
      where: { id: admissionId },
      include: {
        panelPatient: { select: { id: true, fullName: true, mrNumber: true } },
        selfPayEncounter: { select: { id: true, fullName: true } },
        hospitalInvoices: { where: { sourceType: 'ADMISSION' }, include: invoiceInclude, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!admission) throw new NotFoundError('Admission record not found');

    const departmentInvoices = admission.hospitalInvoices.map((inv) => ({
      ...inv,
      outstanding: inv.total.minus(inv.paidTotal),
    }));

    const consolidated = departmentInvoices.reduce(
      (acc, inv) => ({
        subtotal: acc.subtotal.plus(inv.subtotal),
        discountTotal: acc.discountTotal.plus(inv.discountTotal),
        total: acc.total.plus(inv.total),
        paidTotal: acc.paidTotal.plus(inv.paidTotal),
        patientShare: acc.patientShare.plus(inv.patientShare),
        panelReceivable: acc.panelReceivable.plus(inv.panelReceivable),
        outstanding: acc.outstanding.plus(inv.outstanding),
      }),
      {
        subtotal: new Decimal(0),
        discountTotal: new Decimal(0),
        total: new Decimal(0),
        paidTotal: new Decimal(0),
        patientShare: new Decimal(0),
        panelReceivable: new Decimal(0),
        outstanding: new Decimal(0),
      },
    );

    return {
      admissionId: admission.id,
      admissionNumber: admission.admissionNumber,
      status: admission.status,
      isNotFinalDischargeInvoice: true,
      departmentInvoices,
      consolidated,
    };
  },

  /**
   * Admission Patient Records list (Front Desk) — one row per checked-in
   * admission (active + historical), never per department invoice. Current
   * Charges / Total Paid / Outstanding are consolidated across every
   * department invoice AND every payment receipt on the admission
   * (allocated or unallocated advance/deposit) — unlike `getStatement`'s
   * `consolidated.paidTotal`, which only sums `HospitalInvoice.paidTotal`
   * and so misses unallocated advance receipts.
   */
  async listAdmissionRecords() {
    const admissions = await prisma.admissionRecord.findMany({
      where: { admittedAt: { not: null } },
      include: {
        panelPatient: { select: { id: true, fullName: true, mrNumber: true } },
        selfPayEncounter: { select: { id: true, fullName: true, phone: true } },
        bed: { include: { room: { include: { ward: true } } } },
        hospitalInvoices: { where: { sourceType: 'ADMISSION' }, select: { id: true, total: true } },
      },
      orderBy: { admittedAt: 'desc' },
    });

    const admissionIds = admissions.map((a) => a.id);
    const allInvoiceIds = admissions.flatMap((a) => a.hospitalInvoices.map((i) => i.id));

    const receipts =
      admissionIds.length === 0
        ? []
        : await prisma.paymentReceipt.findMany({
            where: {
              isReversed: false,
              OR: [{ admissionRecordId: { in: admissionIds } }, { hospitalInvoiceId: { in: allInvoiceIds } }],
            },
            select: {
              amount: true,
              admissionRecordId: true,
              hospitalInvoice: { select: { admissionRecordId: true } },
            },
          });

    const paidByAdmission = new Map<string, Decimal>();
    for (const r of receipts) {
      const admId = r.admissionRecordId ?? r.hospitalInvoice?.admissionRecordId;
      if (!admId) continue;
      paidByAdmission.set(admId, (paidByAdmission.get(admId) ?? new Decimal(0)).plus(r.amount));
    }

    return admissions.map((a) => {
      const currentCharges = a.hospitalInvoices.reduce((sum, inv) => sum.plus(inv.total), new Decimal(0));
      const totalPaid = paidByAdmission.get(a.id) ?? new Decimal(0);
      const outstanding = Decimal.max(0, currentCharges.minus(totalPaid));
      const availableCredit = Decimal.max(0, totalPaid.minus(currentCharges));
      const billingStatus =
        currentCharges.equals(0) && totalPaid.equals(0)
          ? 'NO_CHARGES'
          : totalPaid.greaterThanOrEqualTo(currentCharges) && currentCharges.greaterThan(0)
            ? 'PAID'
            : totalPaid.greaterThan(0)
              ? 'PARTIALLY_PAID'
              : 'UNPAID';

      return {
        id: a.id,
        admissionNumber: a.admissionNumber,
        patientName: a.panelPatient?.fullName ?? a.selfPayEncounter?.fullName ?? 'Unknown',
        patientMrNumber: a.panelPatient?.mrNumber ?? null,
        payerType: a.panelPatientId ? 'PANEL' : 'SELF_PAY',
        admittedAt: a.admittedAt,
        ...bedLabel(a.bed),
        currentCharges,
        totalPaid,
        outstanding,
        availableCredit,
        clinicalStatus: a.status,
        billingStatus,
      };
    });
  },

  /**
   * Running Admission Ledger — every charge (invoice line) and every
   * payment (receipt, allocated or unallocated) for this admission,
   * flattened into one chronological list with a running balance. This is
   * the read model behind the Front Desk "Admission Patient Record" page —
   * it never creates or mutates anything.
   */
  async getLedger(admissionId: string) {
    const admission = await prisma.admissionRecord.findUnique({
      where: { id: admissionId },
      include: {
        panelPatient: { include: { corporatePanel: { select: { id: true, organizationName: true } } } },
        selfPayEncounter: { select: { id: true, fullName: true, phone: true } },
        bed: { include: { room: { include: { ward: true } } } },
        hospitalInvoices: {
          where: { sourceType: 'ADMISSION' },
          include: {
            department: { select: { id: true, name: true } },
            lines: { include: { serviceRate: true, performedBy: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!admission) throw new NotFoundError('Admission record not found');

    const invoiceIds = admission.hospitalInvoices.map((inv) => inv.id);

    const receipts = await prisma.paymentReceipt.findMany({
      where: {
        isReversed: false,
        OR: [{ admissionRecordId: admissionId }, { hospitalInvoiceId: { in: invoiceIds } }],
      },
      include: {
        collectedBy: { select: { id: true, username: true, displayName: true } },
        hospitalInvoice: { select: { id: true, department: { select: { name: true } } } },
      },
      orderBy: { collectedAt: 'asc' },
    });

    const debitEntries = admission.hospitalInvoices.flatMap((inv) =>
      inv.lines.map((l) => ({
        date: l.createdAt,
        type: l.serviceRate.name,
        department: inv.department?.name ?? null,
        description: l.discountReason ? `${l.serviceRate.name} (${l.discountReason})` : l.serviceRate.name,
        qty: l.quantity,
        rate: l.rateSnapshot,
        debit: l.lineNet,
        credit: new Decimal(0),
        reference: inv.invoiceNumber,
        postedBy: l.performedBy?.fullName ?? null,
      })),
    );

    const firstUnallocatedReceiptId = receipts.find((r) => !r.hospitalInvoiceId)?.id ?? null;

    const creditEntries = receipts.map((r) => {
      const isUnallocated = !r.hospitalInvoiceId;
      const type = isUnallocated
        ? r.id === firstUnallocatedReceiptId
          ? 'Admission Advance'
          : 'Additional Deposit'
        : `Payment — ${r.hospitalInvoice?.department?.name ?? 'Department'}`;
      return {
        date: r.collectedAt,
        type,
        department: r.hospitalInvoice?.department?.name ?? null,
        description: `${type} (${r.method})`,
        qty: null as Decimal | null,
        rate: null as Decimal | null,
        debit: new Decimal(0),
        credit: r.amount,
        reference: r.receiptNumber,
        postedBy: r.collectedBy?.displayName ?? r.collectedBy?.username ?? null,
      };
    });

    const allEntries = [...debitEntries, ...creditEntries].sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = new Decimal(0);
    const entries = allEntries.map((e) => {
      running = running.plus(e.debit).minus(e.credit);
      return { ...e, runningBalance: running };
    });

    const totalCharges = admission.hospitalInvoices.reduce((sum, inv) => sum.plus(inv.total), new Decimal(0));
    const totalPaid = receipts.reduce((sum, r) => sum.plus(r.amount), new Decimal(0));
    const outstandingBalance = Decimal.max(0, totalCharges.minus(totalPaid));
    const availableCredit = Decimal.max(0, totalPaid.minus(totalCharges));

    let panel: Record<string, Decimal> | null = null;
    if (admission.panelPatientId) {
      const patientShare = admission.hospitalInvoices.reduce((sum, inv) => sum.plus(inv.patientShare), new Decimal(0));
      const panelReceivable = admission.hospitalInvoices.reduce((sum, inv) => sum.plus(inv.panelReceivable), new Decimal(0));

      const realizedGroups =
        invoiceIds.length === 0
          ? []
          : await prisma.panelRemittanceAllocation.groupBy({
              by: ['hospitalInvoiceId'],
              where: { hospitalInvoiceId: { in: invoiceIds } },
              _sum: { allocatedAmount: true },
            });
      const panelRealized = realizedGroups.reduce((sum, g) => sum.plus(g._sum.allocatedAmount ?? new Decimal(0)), new Decimal(0));
      const patientPaid = totalPaid;

      panel = {
        grossCharges: totalCharges,
        patientShare,
        panelReceivable,
        patientPaid,
        panelRealized,
        patientOutstanding: Decimal.max(0, patientShare.minus(patientPaid)),
        panelOutstanding: Decimal.max(0, panelReceivable.minus(panelRealized)),
      };
    }

    return {
      admissionId: admission.id,
      admissionNumber: admission.admissionNumber,
      status: admission.status,
      payerType: admission.panelPatientId ? 'PANEL' : 'SELF_PAY',
      patientName: admission.panelPatient?.fullName ?? admission.selfPayEncounter?.fullName ?? 'Unknown',
      patientMrNumber: admission.panelPatient?.mrNumber ?? null,
      panelName: admission.panelPatient?.corporatePanel?.organizationName ?? null,
      admittedAt: admission.admittedAt,
      ...bedLabel(admission.bed),
      finalBillNumber: admission.finalBillNumber,
      finalBillGeneratedAt: admission.finalBillGeneratedAt,
      entries,
      summary: { totalCharges, totalPaid, outstandingBalance, availableCredit },
      panel,
    };
  },

  /**
   * Payment Allocation (§2.11) — one physical collection, split across
   * however many department invoices the amount is allocated to. Explicit
   * `allocations` wins; otherwise auto-allocated proportional to each
   * invoice's current outstanding (largest-remainder rounding so the split
   * always sums to exactly the collected amount).
   *
   * v7.2 Admission Ledger — overpayment (or a payment collected when
   * nothing is currently outstanding, including before any department
   * invoice exists yet) no longer rejects the collection: every outstanding
   * invoice is settled in full and the remainder is banked as one
   * unallocated advance/deposit `PaymentReceipt` (`hospitalInvoiceId: null`,
   * `admissionRecordId` set) — this is the "guardian pays 20,000 advance
   * against 14,000 of charges, 6,000 becomes Patient Credit" case from the
   * spec (§7/§8), and the "additional deposit before any service has
   * posted" case.
   */
  async collectPayment(admissionId: string, body: CollectAdmissionPaymentBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const admission = await tx.admissionRecord.findUnique({ where: { id: admissionId } });
      if (!admission) throw new NotFoundError('Admission record not found');

      const invoices = await tx.hospitalInvoice.findMany({
        where: { admissionRecordId: admissionId, sourceType: 'ADMISSION' },
      });

      const amountDecimal = new Decimal(body.amount);
      let allocations: { invoiceId: string | null; amount: Decimal }[];

      if (body.allocations && body.allocations.length > 0) {
        const byId = new Map(invoices.map((inv) => [inv.id, inv]));
        let sum = new Decimal(0);
        const explicit = body.allocations.map((a) => {
          const invoice = byId.get(a.invoiceId);
          if (!invoice) throw new ValidationError(`Invoice ${a.invoiceId} does not belong to this admission`);
          const amt = new Decimal(a.amount);
          const outstanding = invoice.total.minus(invoice.paidTotal);
          if (amt.greaterThan(outstanding)) {
            throw new ValidationError(
              `Allocation to ${invoice.invoiceNumber} (${amt.toString()}) exceeds its outstanding balance (${outstanding.toString()})`,
            );
          }
          sum = sum.plus(amt);
          return { invoiceId: a.invoiceId as string | null, amount: amt };
        });
        if (sum.greaterThan(amountDecimal)) {
          throw new ValidationError(
            `Allocations (${sum.toString()}) cannot exceed the collected amount (${amountDecimal.toString()})`,
          );
        }
        // Any leftover (amount collected minus what was explicitly
        // allocated) banks as an unallocated advance/deposit credit rather
        // than requiring an exact sum-match.
        const remainder = amountDecimal.minus(sum);
        allocations = remainder.greaterThan(0) ? [...explicit, { invoiceId: null, amount: remainder }] : explicit;
      } else {
        const outstandingByInvoice = invoices
          .map((inv) => ({ invoice: inv, outstanding: inv.total.minus(inv.paidTotal) }))
          .filter((x) => x.outstanding.greaterThan(0));
        const totalOutstanding = outstandingByInvoice.reduce((sum, x) => sum.plus(x.outstanding), new Decimal(0));

        if (totalOutstanding.lessThanOrEqualTo(0)) {
          // Nothing outstanding (no department invoice yet, or every
          // invoice already settled) — the whole amount is a pure
          // advance/deposit credit.
          allocations = [{ invoiceId: null, amount: amountDecimal }];
        } else if (amountDecimal.greaterThan(totalOutstanding)) {
          // Overpayment — settle every outstanding invoice in full, bank
          // the remainder as unallocated credit.
          const settled = outstandingByInvoice.map((x) => ({ invoiceId: x.invoice.id as string | null, amount: x.outstanding }));
          const remainder = amountDecimal.minus(totalOutstanding);
          allocations = [...settled, { invoiceId: null, amount: remainder }];
        } else {
          let allocated = new Decimal(0);
          allocations = outstandingByInvoice.map((x, idx) => {
            const isLast = idx === outstandingByInvoice.length - 1;
            const share = isLast
              ? amountDecimal.minus(allocated)
              : amountDecimal.mul(x.outstanding).div(totalOutstanding).toDecimalPlaces(2);
            allocated = allocated.plus(share);
            return { invoiceId: x.invoice.id as string | null, amount: share };
          });
        }
      }

      const receipts = [];
      for (const alloc of allocations) {
        if (alloc.amount.lessThanOrEqualTo(0)) continue;
        const invoice = alloc.invoiceId ? invoices.find((i) => i.id === alloc.invoiceId)! : null;

        const receipt = await tx.paymentReceipt.create({
          data: {
            receiptNumber: await generateReceiptNumber(tx),
            amount: alloc.amount,
            method: body.paymentMethod,
            reference:
              body.reference ??
              (invoice ? `Admission ${admissionId} payment allocation` : `Admission ${admissionId} advance / deposit`),
            hospitalInvoiceId: invoice?.id,
            admissionRecordId: invoice ? undefined : admissionId,
            collectedById: actorId,
          },
        });
        receipts.push(receipt);

        await tx.userCashBalance.create({
          data: {
            portalUserId: actorId,
            moduleScope: 'BILLING',
            direction: 'IN',
            amount: alloc.amount,
            category: 'COLLECTION',
            isPhysicalCash: body.paymentMethod === 'CASH',
            paymentReceiptId: receipt.id,
          },
        });

        if (invoice) {
          const newPaidTotal = invoice.paidTotal.plus(alloc.amount);
          const newStatus = newPaidTotal.greaterThanOrEqualTo(invoice.total)
            ? 'PAID'
            : newPaidTotal.greaterThan(0)
              ? 'PARTIALLY_PAID'
              : 'UNPAID';
          await tx.hospitalInvoice.update({
            where: { id: invoice.id },
            data: { paidTotal: newPaidTotal, status: newStatus },
          });
        }
      }

      return { receipts, allocations: allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })) };
    });
  },

  /**
   * Generate Invoice / Final Bill (§10) — idempotent: the first call mints
   * one `finalBillNumber` on the `AdmissionRecord` and freezes it there;
   * every later call (double-click, re-print, re-open) returns the exact
   * same number and a fresh ledger snapshot instead of minting a new one or
   * touching any charge. Never creates/modifies a `HospitalInvoice` or
   * `InvoiceLineItem` — the final bill is a read over the ledger that has
   * already accumulated, per §10 ("must use all eligible charges already
   * recorded... no duplicate charge may appear").
   */
  async generateFinalBill(admissionId: string, actorId: string) {
    const { finalBillNumber, finalBillGeneratedAt } = await prisma.$transaction(async (tx) => {
      const admission = await tx.admissionRecord.findUnique({ where: { id: admissionId } });
      if (!admission) throw new NotFoundError('Admission record not found');
      if (admission.finalBillNumber) {
        return { finalBillNumber: admission.finalBillNumber, finalBillGeneratedAt: admission.finalBillGeneratedAt };
      }

      const generatedNumber = await generateFinalBillNumber(tx);
      const generatedAt = new Date();
      await tx.admissionRecord.update({
        where: { id: admissionId },
        data: { finalBillNumber: generatedNumber, finalBillGeneratedAt: generatedAt, finalBillGeneratedById: actorId },
      });
      return { finalBillNumber: generatedNumber, finalBillGeneratedAt: generatedAt };
    });

    const ledger = await this.getLedger(admissionId);
    return { ...ledger, finalBillNumber, finalBillGeneratedAt };
  },
};
