import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
import type { CollectAdmissionPaymentBody } from './admissionBilling.schemas';

function generateReceiptNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `REC-${ts}-${rand}`;
}

const invoiceInclude = {
  department: { select: { id: true, name: true, code: true } },
  lines: { include: { serviceRate: true, performedBy: true } },
  paymentReceipts: { where: { isReversed: false } },
} as const;

/**
 * Front Desk's consolidated view + payment collection over an admission's
 * **multiple** department invoices (HMS_V7.2_NEW_REQUIREMENTS.md §2.2/§2.10/
 * §2.11) — each department invoice stays independently owned
 * (`admission.service.ts`'s `addAdmissionService` already creates one per
 * department); this module is the presentation/allocation layer over them,
 * never a merge.
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
   * Payment Allocation (§2.11) — one physical collection, split across
   * however many department invoices the amount is allocated to. Explicit
   * `allocations` wins; otherwise auto-allocated proportional to each
   * invoice's current outstanding (largest-remainder rounding so the split
   * always sums to exactly the collected amount).
   */
  async collectPayment(admissionId: string, body: CollectAdmissionPaymentBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const invoices = await tx.hospitalInvoice.findMany({
        where: { admissionRecordId: admissionId, sourceType: 'ADMISSION' },
      });
      if (invoices.length === 0) {
        throw new NotFoundError('No department invoices exist yet for this admission');
      }

      const amountDecimal = new Decimal(body.amount);
      let allocations: { invoiceId: string; amount: Decimal }[];

      if (body.allocations && body.allocations.length > 0) {
        const byId = new Map(invoices.map((inv) => [inv.id, inv]));
        let sum = new Decimal(0);
        allocations = body.allocations.map((a) => {
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
          return { invoiceId: a.invoiceId, amount: amt };
        });
        if (!sum.equals(amountDecimal)) {
          throw new ValidationError(`Allocations (${sum.toString()}) must sum to exactly the collected amount (${amountDecimal.toString()})`);
        }
      } else {
        const outstandingByInvoice = invoices
          .map((inv) => ({ invoice: inv, outstanding: inv.total.minus(inv.paidTotal) }))
          .filter((x) => x.outstanding.greaterThan(0));
        const totalOutstanding = outstandingByInvoice.reduce((sum, x) => sum.plus(x.outstanding), new Decimal(0));

        if (totalOutstanding.lessThanOrEqualTo(0)) {
          throw new ValidationError('Nothing outstanding to allocate against on this admission');
        }
        if (amountDecimal.greaterThan(totalOutstanding)) {
          throw new ValidationError(
            `Amount (${amountDecimal.toString()}) exceeds total outstanding across all department invoices (${totalOutstanding.toString()}). Provide explicit allocations for any advance/credit portion.`,
          );
        }

        let allocated = new Decimal(0);
        allocations = outstandingByInvoice.map((x, idx) => {
          const isLast = idx === outstandingByInvoice.length - 1;
          const share = isLast ? amountDecimal.minus(allocated) : amountDecimal.mul(x.outstanding).div(totalOutstanding).toDecimalPlaces(2);
          allocated = allocated.plus(share);
          return { invoiceId: x.invoice.id, amount: share };
        });
      }

      const receipts = [];
      for (const alloc of allocations) {
        if (alloc.amount.lessThanOrEqualTo(0)) continue;
        const invoice = invoices.find((i) => i.id === alloc.invoiceId)!;

        const receipt = await tx.paymentReceipt.create({
          data: {
            receiptNumber: generateReceiptNumber(),
            amount: alloc.amount,
            method: body.paymentMethod,
            reference: body.reference ?? `Admission ${admissionId} payment allocation`,
            hospitalInvoiceId: invoice.id,
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

      return { receipts, allocations: allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })) };
    });
  },
};
