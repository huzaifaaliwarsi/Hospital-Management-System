import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
import type { ListPaymentRequestsQuery, CollectPaymentRequestBody } from './paymentRequests.schemas';

function generateReceiptNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `REC-${ts}-${rand}`;
}

const requestInclude = {
  admissionRecord: {
    select: {
      id: true,
      admissionNumber: true,
      status: true,
      department: { select: { id: true, name: true } },
      doctor: { select: { id: true, fullName: true } },
      panelPatient: { select: { id: true, fullName: true, mrNumber: true, phone: true } },
      selfPayEncounter: { select: { id: true, fullName: true, phone: true } },
    },
  },
  requestedBy: { select: { id: true, username: true, displayName: true } },
  paymentReceipts: { where: { isReversed: false } },
} as const;

/**
 * Front Desk queue for `AdmissionPaymentRequest` — the Admission portal
 * raises these (`POST /admissions/:id/request-advance`) but until now
 * nothing let Front Desk see or collect against them (HMS_V7.2_NEW_REQUIREMENTS.md
 * §3.3's "Admission Payment Requests" nav item).
 */
export const paymentRequestsService = {
  async listPaymentRequests(query: ListPaymentRequestsQuery) {
    return prisma.admissionPaymentRequest.findMany({
      where: query.status ? { status: query.status } : { status: { in: ['PENDING', 'PARTIALLY_FULFILLED'] } },
      include: requestInclude,
      orderBy: { requestedAt: 'desc' },
    });
  },

  async collectPaymentRequest(id: string, body: CollectPaymentRequestBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.admissionPaymentRequest.findUnique({
        where: { id },
        include: { paymentReceipts: { where: { isReversed: false } } },
      });
      if (!request) throw new NotFoundError('Payment request not found');
      if (request.status === 'FULFILLED') throw new ValidationError('This payment request is already fulfilled');
      if (request.status === 'CANCELLED') throw new ValidationError('This payment request has been cancelled');

      const alreadyCollected = request.paymentReceipts.reduce((sum, r) => sum.plus(r.amount), new Decimal(0));
      const remaining = request.requestedAmount.minus(alreadyCollected);
      const amountDecimal = new Decimal(body.amount);

      if (amountDecimal.greaterThan(remaining)) {
        throw new ValidationError(
          `Amount cannot exceed the remaining requested balance (${remaining.toString()})`,
        );
      }

      const receipt = await tx.paymentReceipt.create({
        data: {
          receiptNumber: generateReceiptNumber(),
          amount: amountDecimal,
          method: body.paymentMethod,
          reference: body.reference ?? `Payment request ${request.id}`,
          admissionPaymentRequestId: request.id,
          collectedById: actorId,
        },
      });

      // Universal Cashier balance ledger update (§4.9, §8.12) — same pattern
      // as appointments/invoices collection.
      await tx.userCashBalance.create({
        data: {
          portalUserId: actorId,
          moduleScope: 'BILLING',
          direction: 'IN',
          amount: amountDecimal,
          category: 'COLLECTION',
          isPhysicalCash: body.paymentMethod === 'CASH',
          paymentReceiptId: receipt.id,
        },
      });

      const newCollected = alreadyCollected.plus(amountDecimal);
      const newStatus = newCollected.greaterThanOrEqualTo(request.requestedAmount) ? 'FULFILLED' : 'PARTIALLY_FULFILLED';

      const updated = await tx.admissionPaymentRequest.update({
        where: { id },
        data: { status: newStatus },
        include: requestInclude,
      });

      return { request: updated, receipt };
    });
  },
};
