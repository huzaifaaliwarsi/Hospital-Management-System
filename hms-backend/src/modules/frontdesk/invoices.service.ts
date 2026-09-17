import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError, AuthorizationError } from '@/shared/errors/AppError';
import { commissionService } from '@/modules/commission/commission.service';
import type {
  CreateEncounterBody,
  AddServiceLineBody,
  ApplyDiscountBody,
  CollectPaymentBody,
  RefundPaymentBody,
  ListInvoicesQuery,
} from './invoices.schemas';

import { generateInvoiceNumber, generateReceiptNumber } from '@/shared/idGenerator';

const DISCOUNT_APPROVAL_PERCENT_THRESHOLD = 15; // > 15% requires Admin approval
const DISCOUNT_APPROVAL_AMOUNT_THRESHOLD = 1500; // > PKR 1,500 requires Admin approval

export const invoicesService = {
  /**
   * Create immediate encounter (Walk-In, OPD, Observation, Emergency) — §4.6 Sub-flow B
   * D16 p.9: "Observation and Emergency are encounter/workflow types, not separate login portals."
   */
  async createEncounter(body: CreateEncounterBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      let selfPayEncounterId = body.selfPayEncounterId;

      if (!body.panelPatientId && !selfPayEncounterId && body.newSelfPayPatient) {
        const createdSelfPay = await tx.selfPayEncounter.create({
          data: {
            fullName: body.newSelfPayPatient.fullName,
            guardianName: body.newSelfPayPatient.guardianName,
            gender: body.newSelfPayPatient.gender,
            dob: body.newSelfPayPatient.dob,
            cnicOrPassport: body.newSelfPayPatient.cnicOrPassport,
            phone: body.newSelfPayPatient.phone,
            address: body.newSelfPayPatient.address,
            createdById: actorId,
          },
        });
        selfPayEncounterId = createdSelfPay.id;
      }

      const invoiceNumber = await generateInvoiceNumber(tx);

      const invoice = await tx.hospitalInvoice.create({
        data: {
          invoiceNumber,
          sourceType: 'WALK_IN',
          encounterType: body.encounterType,
          panelPatientId: body.panelPatientId,
          selfPayEncounterId,
          subtotal: new Decimal(0),
          discountTotal: new Decimal(0),
          total: new Decimal(0),
          paidTotal: new Decimal(0),
          status: 'UNPAID',
          createdById: actorId,
        },
        include: {
          panelPatient: true,
          selfPayEncounter: true,
          lines: true,
          paymentReceipts: true,
        },
      });

      return invoice;
    });
  },

  /**
   * Add billable service line item to an invoice — §4.6, §8.7
   * Captures rateSnapshot, auto-applies Panel discount rules, updates totals,
   * and triggers doctor commission accrual calculation.
   */
  async addServiceLine(
    invoiceId: string,
    body: AddServiceLineBody,
    _actorId: string,
    actorRole: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.hospitalInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          panelPatient: {
            include: { corporatePanel: { include: { discountRules: true } } },
          },
          lines: true,
        },
      });

      if (!invoice) throw new NotFoundError('Invoice not found');
      if (invoice.status === 'VOID') throw new ValidationError('Cannot modify a void invoice');

      const serviceRate = await tx.serviceRate.findUnique({
        where: { id: body.serviceRateId },
      });
      if (!serviceRate || !serviceRate.isActive) {
        throw new NotFoundError('Service rate not found or inactive');
      }

      // Rate snapshot: frozen at billing time (D15 §15)
      let rate = serviceRate.standardRate;
      if (body.manualRateOverride !== undefined) {
        if (!serviceRate.manualRateOverrideAllowed && !['SUPER_ADMIN', 'ADMIN'].includes(actorRole)) {
          throw new AuthorizationError('Manual rate override is not permitted for this service');
        }
        rate = new Decimal(body.manualRateOverride);
      }

      const qty = new Decimal(body.quantity);
      const lineGross = rate.mul(qty);

      // Discount calculation:
      let discountAmount = new Decimal(0);
      let discountReason = body.discountReason ?? null;

      // 1. Check corporate panel discount rule
      if (invoice.panelPatient?.corporatePanel) {
        const panelRule = invoice.panelPatient.corporatePanel.discountRules.find(
          (r) => r.serviceRateId === serviceRate.id,
        );
        if (panelRule) {
          discountAmount = lineGross.mul(panelRule.discountPercent).div(100);
          discountReason = `Panel discount: ${panelRule.discountPercent}%`;
        }
      }

      // 2. Manual discount override if provided
      if (serviceRate.discountAllowed) {
        if (body.discountPercent !== undefined && body.discountPercent > 0) {
          discountAmount = lineGross.mul(body.discountPercent).div(100);
        } else if (body.discountAmount !== undefined && body.discountAmount > 0) {
          discountAmount = new Decimal(body.discountAmount);
        }
      }

      // 3. Discount threshold governance check (§16 Q-05) for manual staff discounts
      const hasManualDiscount = (body.discountPercent !== undefined && body.discountPercent > 0) || (body.discountAmount !== undefined && body.discountAmount > 0);
      if (hasManualDiscount) {
        const discountPct = lineGross.greaterThan(0)
          ? discountAmount.mul(100).div(lineGross).toNumber()
          : 0;

        if (
          (discountPct > DISCOUNT_APPROVAL_PERCENT_THRESHOLD ||
            discountAmount.toNumber() > DISCOUNT_APPROVAL_AMOUNT_THRESHOLD) &&
          !['SUPER_ADMIN', 'ADMIN'].includes(actorRole)
        ) {
          throw new AuthorizationError(
            `Discount of PKR ${discountAmount.toFixed(2)} (${discountPct.toFixed(1)}%) exceeds the front desk threshold (Max ${DISCOUNT_APPROVAL_PERCENT_THRESHOLD}% or PKR ${DISCOUNT_APPROVAL_AMOUNT_THRESHOLD}). Please request Admin approval.`,
          );
        }
      }

      const lineNet = lineGross.minus(discountAmount);

      const createdLine = await tx.invoiceLineItem.create({
        data: {
          hospitalInvoiceId: invoice.id,
          serviceRateId: serviceRate.id,
          rateSnapshot: rate,
          quantity: qty,
          lineGross,
          discountAmount,
          discountReason,
          lineNet,
          performedByStaffId: body.performedByStaffId ?? null,
          isCompleted: true,
        },
        include: {
          serviceRate: true,
          performedBy: true,
        },
      });

      // Recalculate invoice header totals
      const allLines = [...invoice.lines, createdLine];
      const newSubtotal = allLines.reduce((acc, l) => acc.plus(l.lineGross), new Decimal(0));
      const newDiscountTotal = allLines.reduce((acc, l) => acc.plus(l.discountAmount), new Decimal(0));
      const newTotal = allLines.reduce((acc, l) => acc.plus(l.lineNet), new Decimal(0));

      const newStatus = invoice.paidTotal.greaterThanOrEqualTo(newTotal) && newTotal.greaterThan(0)
        ? 'PAID'
        : invoice.paidTotal.greaterThan(0)
          ? 'PARTIALLY_PAID'
          : 'UNPAID';

      await tx.hospitalInvoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: newSubtotal,
          discountTotal: newDiscountTotal,
          total: newTotal,
          status: newStatus,
        },
      });

      // Automatically accrue doctor commission if doctor is attached (§4.5, §8.6)
      if (body.performedByStaffId) {
        await commissionService.calculateAndAccrueCommission(
          tx,
          createdLine,
          body.performedByStaffId,
        );
      }

      return createdLine;
    });
  },

  /**
   * Request / apply line or invoice-level discount — §4.6, §8.7
   */
  async applyDiscount(
    invoiceId: string,
    body: ApplyDiscountBody,
    _actorId: string,
    actorRole: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.hospitalInvoice.findUnique({
        where: { id: invoiceId },
        include: { lines: true },
      });

      if (!invoice) throw new NotFoundError('Invoice not found');
      if (invoice.lines.length === 0) throw new ValidationError('Cannot discount an empty invoice');

      if (body.lineItemId) {
        const line = invoice.lines.find((l) => l.id === body.lineItemId);
        if (!line) throw new NotFoundError('Invoice line item not found');

        let discAmt = new Decimal(0);
        if (body.discountPercent !== undefined) {
          discAmt = line.lineGross.mul(body.discountPercent).div(100);
        } else if (body.discountAmount !== undefined) {
          discAmt = new Decimal(body.discountAmount);
        }

        const discPct = line.lineGross.greaterThan(0)
          ? discAmt.mul(100).div(line.lineGross).toNumber()
          : 0;

        if (
          (discPct > DISCOUNT_APPROVAL_PERCENT_THRESHOLD ||
            discAmt.toNumber() > DISCOUNT_APPROVAL_AMOUNT_THRESHOLD) &&
          !['SUPER_ADMIN', 'ADMIN'].includes(actorRole)
        ) {
          throw new AuthorizationError(
            `Discount of PKR ${discAmt.toFixed(2)} (${discPct.toFixed(1)}%) requires Admin approval.`,
          );
        }

        const newLineNet = line.lineGross.minus(discAmt);

        await tx.invoiceLineItem.update({
          where: { id: line.id },
          data: {
            discountAmount: discAmt,
            discountReason: body.discountReason,
            lineNet: newLineNet,
          },
        });
      } else {
        // Invoice-wide discount distributed across lines
        const totalGross = invoice.subtotal;
        let totalDiscAmt = new Decimal(0);
        if (body.discountPercent !== undefined) {
          totalDiscAmt = totalGross.mul(body.discountPercent).div(100);
        } else if (body.discountAmount !== undefined) {
          totalDiscAmt = new Decimal(body.discountAmount);
        }

        const discPct = totalGross.greaterThan(0)
          ? totalDiscAmt.mul(100).div(totalGross).toNumber()
          : 0;

        if (
          (discPct > DISCOUNT_APPROVAL_PERCENT_THRESHOLD ||
            totalDiscAmt.toNumber() > DISCOUNT_APPROVAL_AMOUNT_THRESHOLD) &&
          !['SUPER_ADMIN', 'ADMIN'].includes(actorRole)
        ) {
          throw new AuthorizationError(
            `Total discount of PKR ${totalDiscAmt.toFixed(2)} requires Admin approval.`,
          );
        }

        // Distribute proportionally across lines
        for (const line of invoice.lines) {
          const ratio = totalGross.greaterThan(0) ? line.lineGross.div(totalGross) : new Decimal(0);
          const lineDisc = totalDiscAmt.mul(ratio);
          const lineNet = line.lineGross.minus(lineDisc);
          await tx.invoiceLineItem.update({
            where: { id: line.id },
            data: {
              discountAmount: lineDisc,
              discountReason: body.discountReason,
              lineNet,
            },
          });
        }
      }

      // Recalculate invoice totals
      const refreshedLines = await tx.invoiceLineItem.findMany({
        where: { hospitalInvoiceId: invoice.id },
      });

      const newSubtotal = refreshedLines.reduce((acc, l) => acc.plus(l.lineGross), new Decimal(0));
      const newDiscountTotal = refreshedLines.reduce((acc, l) => acc.plus(l.discountAmount), new Decimal(0));
      const newTotal = refreshedLines.reduce((acc, l) => acc.plus(l.lineNet), new Decimal(0));

      const newStatus = invoice.paidTotal.greaterThanOrEqualTo(newTotal) && newTotal.greaterThan(0)
        ? 'PAID'
        : invoice.paidTotal.greaterThan(0)
          ? 'PARTIALLY_PAID'
          : 'UNPAID';

      return tx.hospitalInvoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: newSubtotal,
          discountTotal: newDiscountTotal,
          total: newTotal,
          status: newStatus,
        },
        include: {
          lines: { include: { serviceRate: true, performedBy: true } },
          paymentReceipts: true,
        },
      });
    });
  },

  /**
   * Collect payment against a Hospital Invoice — §4.6, §8.7
   * Adjusts prior advance payment, creates official receipt, updates paidTotal,
   * and feeds cashier physical cash vs digital balance (§4.9, §8.12).
   */
  async collectPayment(invoiceId: string, body: CollectPaymentBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.hospitalInvoice.findUnique({
        where: { id: invoiceId },
        include: { paymentReceipts: true, lines: true },
      });

      if (!invoice) throw new NotFoundError('Invoice not found');
      if (invoice.status === 'PAID') throw new ValidationError('This invoice is already fully paid');
      if (invoice.status === 'VOID') throw new ValidationError('Cannot pay a void invoice');

      const amountDecimal = new Decimal(body.amount);
      const remainingBalance = invoice.total.minus(invoice.paidTotal);

      if (amountDecimal.greaterThan(remainingBalance)) {
        throw new ValidationError(
          `Payment amount of PKR ${amountDecimal.toFixed(2)} exceeds remaining balance of PKR ${remainingBalance.toFixed(2)}`,
        );
      }

      const receiptNumber = await generateReceiptNumber(tx);

      const receipt = await tx.paymentReceipt.create({
        data: {
          receiptNumber,
          hospitalInvoiceId: invoice.id,
          amount: amountDecimal,
          method: body.paymentMethod,
          reference: body.reference ?? `Payment for Invoice ${invoice.invoiceNumber}`,
          collectedById: actorId,
        },
      });

      // Universal Cash Accountability ledger (§4.9, §8.12)
      // Cash increases physical cash; digital methods tracked as non-physical
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

      const newPaidTotal = invoice.paidTotal.plus(amountDecimal);
      const newStatus = newPaidTotal.greaterThanOrEqualTo(invoice.total) ? 'PAID' : 'PARTIALLY_PAID';

      const updatedInvoice = await tx.hospitalInvoice.update({
        where: { id: invoice.id },
        data: {
          paidTotal: newPaidTotal,
          status: newStatus,
        },
        include: {
          lines: { include: { serviceRate: true, performedBy: true } },
          paymentReceipts: true,
        },
      });

      return { receipt, invoice: updatedInvoice };
    });
  },

  /**
   * Process refund against an invoice / receipt with strict audit trail — §4.6, §8.7
   * Decreases cashier physical cash (if cash), reduces invoice paidTotal,
   * and creates linked Doctor Commission reversal if commission was accrued.
   */
  async refundPayment(invoiceId: string, body: RefundPaymentBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.hospitalInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          lines: { include: { commissionAccrual: true } },
          paymentReceipts: true,
        },
      });

      if (!invoice) throw new NotFoundError('Invoice not found');

      const refundAmount = new Decimal(body.amount);
      if (refundAmount.greaterThan(invoice.paidTotal)) {
        throw new ValidationError(
          `Refund amount PKR ${refundAmount.toFixed(2)} cannot exceed total paid PKR ${invoice.paidTotal.toFixed(2)}`,
        );
      }

      const receiptNumber = await generateReceiptNumber(tx);

      // Record reversal receipt row (preserving audit trail, no silent deletion per D16 p.22)
      const reversalReceipt = await tx.paymentReceipt.create({
        data: {
          receiptNumber,
          hospitalInvoiceId: invoice.id,
          amount: refundAmount.negated(),
          method: body.refundMethod,
          reference: `Refund for ${invoice.invoiceNumber}: ${body.reason}`,
          collectedById: actorId,
          isReversed: true,
        },
      });

      // Cashier Balance Sheet: OUT transaction reduces expected physical cash
      await tx.userCashBalance.create({
        data: {
          portalUserId: actorId,
          moduleScope: 'BILLING',
          direction: 'OUT',
          amount: refundAmount,
          category: 'REFUND',
          isPhysicalCash: body.refundMethod === 'CASH',
          paymentReceiptId: reversalReceipt.id,
        },
      });

      const newPaidTotal = invoice.paidTotal.minus(refundAmount);
      const newStatus = newPaidTotal.equals(0)
        ? 'UNPAID'
        : newPaidTotal.lessThan(invoice.total)
          ? 'PARTIALLY_PAID'
          : 'PAID';

      const updatedInvoice = await tx.hospitalInvoice.update({
        where: { id: invoice.id },
        data: {
          paidTotal: newPaidTotal,
          status: newStatus,
        },
      });

      // Reverse doctor commission accruals for lines where commission was accrued
      for (const line of invoice.lines) {
        if (line.commissionAccrual) {
          await commissionService.reverseCommissionAccrual(
            tx,
            line.id,
            `Refund: ${body.reason}`,
            actorId,
          );
        }
      }

      return {
        refundReceipt: reversalReceipt,
        invoice: updatedInvoice,
      };
    });
  },

  /**
   * Printable receipt & invoice view payload (§8.7, D17 p.8)
   */
  async getReceipt(invoiceId: string) {
    const invoice = await prisma.hospitalInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        panelPatient: { include: { corporatePanel: true } },
        selfPayEncounter: true,
        appointment: { include: { doctor: true, department: true } },
        lines: { include: { serviceRate: true, performedBy: true } },
        paymentReceipts: { include: { collectedBy: { select: { id: true, username: true } } } },
        createdByUser: { select: { id: true, username: true } },
      },
    });

    if (!invoice) throw new NotFoundError('Invoice not found');

    const hospitalProfile = await prisma.hospitalProfile.findFirst();

    const outstanding = invoice.total.minus(invoice.paidTotal);

    return {
      hospital: {
        name: hospitalProfile?.name ?? 'CH Sharif & Saeed Hospital',
        address: hospitalProfile?.address ?? '',
        phone: hospitalProfile?.contactPhone ?? '',
        email: hospitalProfile?.contactEmail ?? '',
        billingLegalMetadata: hospitalProfile?.billingLegalMetadata ?? {},
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        sourceType: invoice.sourceType,
        encounterType: invoice.encounterType,
        createdAt: invoice.createdAt,
        status: invoice.status,
        subtotal: invoice.subtotal,
        discountTotal: invoice.discountTotal,
        total: invoice.total,
        paidTotal: invoice.paidTotal,
        outstandingBalance: outstanding,
      },
      patient: invoice.panelPatient
        ? {
            type: 'PANEL',
            name: invoice.panelPatient.fullName,
            mrNumber: invoice.panelPatient.mrNumber,
            phone: invoice.panelPatient.phone,
            corporatePanel: invoice.panelPatient.corporatePanel.organizationName,
          }
        : {
            type: 'SELF_PAY',
            name: invoice.selfPayEncounter?.fullName ?? 'Walk-In Patient',
            mrNumber: invoice.selfPayEncounterId
              ? `MR-26-${invoice.selfPayEncounterId.replace(/\D/g, '').slice(0, 5) || invoice.selfPayEncounterId.replace(/-/g, '').slice(0, 4).toUpperCase()}`
              : '',
            phone: invoice.selfPayEncounter?.phone,
            cnic: invoice.selfPayEncounter?.cnicOrPassport,
          },
      lines: invoice.lines.map((l) => ({
        id: l.id,
        serviceName: l.serviceRate.name,
        billingUnit: l.serviceRate.billingUnit,
        rate: l.rateSnapshot,
        quantity: l.quantity,
        gross: l.lineGross,
        discount: l.discountAmount,
        net: l.lineNet,
        performedBy: l.performedBy?.fullName ?? 'Hospital',
      })),
      payments: invoice.paymentReceipts.map((p) => ({
        receiptNumber: p.receiptNumber,
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        collectedAt: p.collectedAt,
        collectedBy: p.collectedBy.username,
        isReversed: p.isReversed,
      })),
    };
  },

  async listInvoices(query: ListInvoicesQuery) {
    const where: Prisma.HospitalInvoiceWhereInput = {};
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.encounterType) where.encounterType = query.encounterType;
    if (query.status) where.status = query.status;
    if (query.panelPatientId) where.panelPatientId = query.panelPatientId;
    if (query.selfPayEncounterId) where.selfPayEncounterId = query.selfPayEncounterId;

    if (query.date) {
      const startOfDay = new Date(`${query.date}T00:00:00.000Z`);
      const endOfDay = new Date(`${query.date}T23:59:59.999Z`);
      where.createdAt = { gte: startOfDay, lte: endOfDay };
    }

    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { panelPatient: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { panelPatient: { mrNumber: { contains: query.search, mode: 'insensitive' } } },
        { selfPayEncounter: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    return prisma.hospitalInvoice.findMany({
      where,
      include: {
        panelPatient: { select: { id: true, fullName: true, mrNumber: true } },
        selfPayEncounter: { select: { id: true, fullName: true } },
        lines: { select: { id: true, lineNet: true, quantity: true } },
        paymentReceipts: { select: { id: true, receiptNumber: true, amount: true, method: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  },

  async getInvoice(id: string) {
    const invoice = await prisma.hospitalInvoice.findUnique({
      where: { id },
      include: {
        panelPatient: { include: { corporatePanel: true } },
        selfPayEncounter: true,
        appointment: { include: { doctor: true, department: true } },
        lines: {
          include: {
            serviceRate: true,
            performedBy: true,
            commissionAccrual: true,
          },
        },
        paymentReceipts: {
          include: { collectedBy: { select: { id: true, username: true } } },
          orderBy: { collectedAt: 'asc' },
        },
        createdByUser: { select: { id: true, username: true, role: true } },
      },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  },
};
