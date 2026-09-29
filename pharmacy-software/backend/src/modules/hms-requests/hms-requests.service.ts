import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { NotFoundError, ConflictError, ValidationError } from '@/shared/errors/AppError';
import { pharmacyService } from '../pharmacy/pharmacy.service';
import type { CreateRequestBody, ListRequestsQuery, FulfillRequestBody, RejectRequestBody, UpdateSettingsBody } from './hms-requests.schemas';

async function getOrCreateSettings() {
  const existing = await prisma.pharmacySettings.findFirst();
  if (existing) return existing;
  return prisma.pharmacySettings.create({ data: {} });
}

const requestInclude = {
  lines: { include: { medicine: true, batch: true } },
  handledByUser: { select: { id: true, fullName: true, username: true } },
  approvedByUser: { select: { id: true, fullName: true, username: true } },
  invoice: { include: { lines: true, payments: true } },
} satisfies Prisma.MedicineRequestInclude;

export const hmsRequestsService = {
  // ── Settings (pharmacy.md §3/§7.3 — configured, never hardcoded) ─────────
  async getSettings() {
    return getOrCreateSettings();
  },
  async updateSettings(body: UpdateSettingsBody, actorId: string) {
    const settings = await getOrCreateSettings();
    return prisma.pharmacySettings.update({ where: { id: settings.id }, data: { ...body, updatedById: actorId } });
  },

  // ── Requests (pharmacy.md §7.1 steps 1-2, §15) ────────────────────────────
  /**
   * In production this is what HMS's own backend calls. Until the live
   * HMS<->Pharmacy integration exists (deferred), Pharmacy staff use the same
   * endpoint/shape as a manual stand-in — identical downstream flow either way.
   */
  async createRequest(body: CreateRequestBody, actorId: string) {
    for (const line of body.lines) {
      const medicine = await prisma.medicineMaster.findUnique({ where: { id: line.medicineId } });
      if (!medicine || !medicine.isActive) throw new NotFoundError(`Medicine ${line.medicineId} not found or inactive`);
    }
    const requestNumber = `MED-REQ-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    return prisma.medicineRequest.create({
      data: {
        requestNumber,
        externalAdmissionRef: body.externalAdmissionRef,
        externalRequestRef: body.externalRequestRef,
        patientNameSnapshot: body.patientNameSnapshot,
        urgency: body.urgency,
        requestedByExternal: body.requestedByExternal,
        handledById: actorId,
        lines: { create: body.lines.map((l) => ({ medicineId: l.medicineId, requestedQuantity: new Decimal(l.requestedQuantity), notes: l.notes })) },
      },
      include: requestInclude,
    });
  },

  async list(query: ListRequestsQuery) {
    return prisma.medicineRequest.findMany({ where: { status: query.status }, include: requestInclude, orderBy: { requestedAt: 'desc' } });
  },

  async getById(id: string) {
    const req = await prisma.medicineRequest.findUnique({ where: { id }, include: requestInclude });
    if (!req) throw new NotFoundError('Medicine request not found');
    return req;
  },

  /** Estimate at requested qty × current sale rate — for the high-value gate only; the real invoice is computed at FEFO/dispense time. */
  async estimatedValue(requestId: string): Promise<Decimal> {
    const lines = await prisma.medicineRequestLine.findMany({ where: { medicineRequestId: requestId }, include: { medicine: true } });
    return lines.reduce((sum, l) => sum.plus(l.requestedQuantity.mul(l.medicine.saleRate)), new Decimal(0));
  },

  // ── Decision (pharmacy.md §7.1 steps 3-4, §7.3) ───────────────────────────
  async approve(id: string, actorId: string) {
    const request = await prisma.medicineRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundError('Medicine request not found');
    if (request.status !== 'REQUESTED') throw new ConflictError('Only a pending request can be approved');
    if (request.approvedById) throw new ConflictError('This request is already approved');
    return prisma.medicineRequest.update({ where: { id }, data: { approvedById: actorId, approvedAt: new Date() }, include: requestInclude });
  },

  async reject(id: string, body: RejectRequestBody, actorId: string) {
    const request = await prisma.medicineRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundError('Medicine request not found');
    if (request.status !== 'REQUESTED') throw new ConflictError('Only a pending request can be rejected');
    return prisma.medicineRequest.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: body.reason, handledById: actorId }, include: requestInclude });
  },

  /**
   * pharmacy.md §7.1 steps 4-6 + §8 — "Accept & Dispense" / "Partial Fulfill"
   * are the same action here, driven purely by the quantity chosen per line.
   * Real FEFO allocation (shared with POS via pharmacyService), posts
   * HMS_DISPENSE_OUT stock, and creates/extends ONE channel=HMS_LINKED
   * PharmacyInvoice per request (0 paid at dispense time — payment is
   * collected separately later via the existing invoice-payments endpoint,
   * which already flips clearanceStatus to CLEARED once outstanding hits 0).
   */
  async fulfill(id: string, body: FulfillRequestBody, actorId: string) {
    const settings = await getOrCreateSettings();
    const request = await prisma.medicineRequest.findUnique({ where: { id }, include: { lines: { include: { medicine: true } } } });
    if (!request) throw new NotFoundError('Medicine request not found');
    if (request.status !== 'REQUESTED' && request.status !== 'PARTIALLY_ACCEPTED') {
      throw new ConflictError(`Cannot fulfill a request with status ${request.status}`);
    }

    if (settings.highValueApprovalEnabled) {
      const value = await hmsRequestsService.estimatedValue(id);
      if (value.greaterThanOrEqualTo(settings.highValueThreshold) && !request.approvedById) {
        throw new ConflictError(`This request (PKR ${value.toFixed(2)}) is at/above the high-value threshold (PKR ${settings.highValueThreshold.toFixed(2)}) and needs approval before dispensing.`);
      }
    }

    const linesByRequestLineId = new Map(request.lines.map((l) => [l.id, l]));
    for (const fl of body.lines) {
      const line = linesByRequestLineId.get(fl.requestLineId);
      if (!line) throw new NotFoundError(`Request line ${fl.requestLineId} not found on this request`);
      const remaining = line.requestedQuantity.minus(line.dispensedQuantity);
      if (new Decimal(fl.dispenseQuantity).greaterThan(remaining)) {
        throw new ValidationError(`Cannot dispense more than the remaining ${remaining} for ${line.medicine.name}`);
      }
    }

    return prisma.$transaction(async (tx) => {
      let subtotal = new Decimal(0);
      let taxTotal = new Decimal(0);
      const invoiceLines: Prisma.PharmacyInvoiceLineCreateManyInvoiceInput[] = [];
      const stockDeductions: { medicineId: string; batchId: string | null; quantity: Decimal }[] = [];

      for (const fl of body.lines) {
        const qty = new Decimal(fl.dispenseQuantity);
        if (qty.lessThanOrEqualTo(0)) continue;
        const line = linesByRequestLineId.get(fl.requestLineId)!;
        const medicine = line.medicine;

        const allocations = await pharmacyService.allocateFefoBatches(medicine.id, qty, tx);
        for (const alloc of allocations) {
          const gross = alloc.quantity.mul(medicine.saleRate);
          const tax = gross.mul(medicine.taxPercent).div(100);
          subtotal = subtotal.plus(gross);
          taxTotal = taxTotal.plus(tax);
          invoiceLines.push({ medicineId: medicine.id, batchId: alloc.batchId, quantity: alloc.quantity, rateSnapshot: medicine.saleRate, discountAmount: 0, taxAmount: tax, lineNet: gross.plus(tax) });
          stockDeductions.push({ medicineId: medicine.id, batchId: alloc.batchId, quantity: alloc.quantity });
        }

        await tx.medicineRequestLine.update({
          where: { id: line.id },
          data: { dispensedQuantity: line.dispensedQuantity.plus(qty), batchId: allocations[0]?.batchId ?? line.batchId },
        });
      }

      const callTotal = subtotal.plus(taxTotal);
      const existingInvoice = await tx.pharmacyInvoice.findUnique({ where: { medicineRequestId: id } });

      if (existingInvoice) {
        const newTotal = existingInvoice.total.plus(callTotal);
        await tx.pharmacyInvoice.update({
          where: { id: existingInvoice.id },
          data: {
            subtotal: existingInvoice.subtotal.plus(subtotal),
            taxTotal: existingInvoice.taxTotal.plus(taxTotal),
            total: newTotal,
            outstanding: existingInvoice.outstanding.plus(callTotal),
            status: existingInvoice.paidTotal.greaterThanOrEqualTo(newTotal) ? 'PAID' : existingInvoice.paidTotal.greaterThan(0) ? 'PARTIALLY_PAID' : 'UNPAID',
            lines: invoiceLines.length ? { create: invoiceLines } : undefined,
          },
        });
      } else {
        const invoiceNumber = `HMS-MED-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        await tx.pharmacyInvoice.create({
          data: {
            invoiceNumber,
            channel: 'HMS_LINKED',
            medicineRequestId: id,
            customerName: request.patientNameSnapshot,
            subtotal,
            discountTotal: 0,
            taxTotal,
            total: callTotal,
            paidTotal: 0,
            outstanding: callTotal,
            status: 'UNPAID',
            clearanceStatus: 'OUTSTANDING',
            dispensedById: actorId,
            lines: { create: invoiceLines },
          },
        });
      }

      for (const d of stockDeductions) {
        await tx.stockLedgerEntry.create({
          data: { medicineId: d.medicineId, batchId: d.batchId, movementType: 'HMS_DISPENSE_OUT', quantityDelta: d.quantity.negated(), referenceTable: 'medicine_requests', referenceId: id, actorId },
        });
      }

      const allLines = await tx.medicineRequestLine.findMany({ where: { medicineRequestId: id } });
      const allFullyDispensed = allLines.every((l) => l.dispensedQuantity.greaterThanOrEqualTo(l.requestedQuantity));
      const anyDispensed = allLines.some((l) => l.dispensedQuantity.greaterThan(0));
      const newStatus = allFullyDispensed ? 'DISPENSED' : anyDispensed ? 'PARTIALLY_ACCEPTED' : request.status;

      const updatedRequest = await tx.medicineRequest.update({
        where: { id },
        data: { status: newStatus, handledById: actorId },
        include: requestInclude,
      });

      return updatedRequest;
    });
  },
};
