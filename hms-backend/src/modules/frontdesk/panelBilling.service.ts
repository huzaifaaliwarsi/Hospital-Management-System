import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
import { resolvePanelCoverage } from '@/shared/panelCoverage';
import type { ContractResolutionQuery, RecordPanelRemittanceBody } from './panelBilling.schemas';

function generateRemittanceNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PRM-${ts}-${rand}`;
}

/**
 * Panel Billing (HMS_V7.2_NEW_REQUIREMENTS.md §2.5/§3.3): Panel Verification,
 * Contract Resolution, Panel Interim Statement, and Panel Remittance. Reuses
 * the existing `resolvePanelCoverage()` helper (already shared by Appointments
 * and Admission billing) so coverage math never drifts, and mirrors
 * `admissionBilling.service.ts`'s payment-allocation algorithm exactly for
 * remittance allocation across department invoices.
 */
export const panelBillingService = {
  /** Panel Verification — confirms active membership before any billing action. */
  async verifyPanelPatient(panelPatientId: string) {
    const panelPatient = await prisma.panelPatient.findUnique({
      where: { id: panelPatientId },
      include: { corporatePanel: true },
    });
    if (!panelPatient) throw new NotFoundError('Panel patient not found');

    const reasons: string[] = [];
    if (!panelPatient.isActive) reasons.push('Panel patient record is inactive');
    if (panelPatient.status !== 'ACTIVE') reasons.push(`Panel patient status is ${panelPatient.status}`);
    if (!panelPatient.corporatePanel.isActive) reasons.push('Corporate panel is inactive');

    return {
      panelPatient: {
        id: panelPatient.id,
        mrNumber: panelPatient.mrNumber,
        fullName: panelPatient.fullName,
        panelMemberId: panelPatient.panelMemberId,
        status: panelPatient.status,
        isActive: panelPatient.isActive,
      },
      corporatePanel: {
        id: panelPatient.corporatePanel.id,
        code: panelPatient.corporatePanel.code,
        organizationName: panelPatient.corporatePanel.organizationName,
        isActive: panelPatient.corporatePanel.isActive,
      },
      membershipActive: reasons.length === 0,
      reasons,
    };
  },

  /** Contract Resolution — Contract Amount / Patient Share / Panel Receivable preview for one service. */
  async resolveContract(query: ContractResolutionQuery) {
    const panelPatient = await prisma.panelPatient.findUnique({
      where: { id: query.panelPatientId },
      include: { corporatePanel: { include: { discountRules: true } } },
    });
    if (!panelPatient) throw new NotFoundError('Panel patient not found');

    const serviceRate = await prisma.serviceRate.findUnique({ where: { id: query.serviceRateId } });
    if (!serviceRate) throw new NotFoundError('Service not found');

    const quantity = new Decimal(query.quantity ?? 1);
    const contractAmount = serviceRate.standardRate.mul(quantity);

    const resolution = resolvePanelCoverage(contractAmount, panelPatient.corporatePanel?.discountRules, query.serviceRateId);

    const now = new Date();
    const matchingRule = panelPatient.corporatePanel?.discountRules.find(
      (r) => r.serviceRateId === query.serviceRateId && r.effectiveFrom <= now && (!r.effectiveTo || r.effectiveTo >= now),
    );
    const source: 'COVERAGE' | 'LEGACY_DISCOUNT' | 'NOT_COVERED' =
      matchingRule?.coveragePercent != null ? 'COVERAGE' : matchingRule ? 'LEGACY_DISCOUNT' : 'NOT_COVERED';

    return {
      serviceRateId: serviceRate.id,
      serviceCode: serviceRate.code,
      serviceName: serviceRate.name,
      quantity: quantity.toNumber(),
      contractAmount,
      patientShare: resolution.patientShare,
      panelReceivable: resolution.panelReceivable,
      discountAmount: resolution.discountAmount,
      discountReason: resolution.discountReason,
      coveragePercent: matchingRule?.coveragePercent ?? null,
      capAmount: matchingRule?.capAmount ?? null,
      preauthorizationRequired: matchingRule?.preauthorizationRequired ?? false,
      source,
    };
  },

  /**
   * Panel Interim Statement — every invoice with a panel receivable for this
   * panel (optionally one patient). Patient Share (collected/outstanding)
   * and Panel Receivable (realized via remittance/outstanding) are always
   * reported separately, never blended (v7.2 hard rule). Patient Share
   * Collected is derived as `min(paidTotal, patientShare)` — Front Desk only
   * ever collects Patient Share in cash from a panel patient (panel
   * receivable is realized solely via remittance, never patient cash), so
   * this holds exactly under correct operation.
   */
  async getPanelStatement(corporatePanelId: string, panelPatientId?: string) {
    const corporatePanel = await prisma.corporatePanel.findUnique({ where: { id: corporatePanelId } });
    if (!corporatePanel) throw new NotFoundError('Corporate panel not found');

    const patientWhere: Prisma.PanelPatientWhereInput = panelPatientId
      ? { id: panelPatientId, corporatePanelId }
      : { corporatePanelId };
    const panelPatients = await prisma.panelPatient.findMany({
      where: patientWhere,
      select: { id: true, fullName: true, mrNumber: true, panelMemberId: true },
    });
    if (panelPatientId && panelPatients.length === 0) {
      throw new NotFoundError('Panel patient not found in this panel');
    }
    const patientIds = panelPatients.map((p) => p.id);

    const invoices =
      patientIds.length === 0
        ? []
        : await prisma.hospitalInvoice.findMany({
            where: { panelPatientId: { in: patientIds }, panelReceivable: { gt: 0 } },
            include: {
              department: { select: { id: true, name: true, code: true } },
              panelPatient: { select: { id: true, fullName: true, mrNumber: true } },
            },
            orderBy: { createdAt: 'desc' },
          });

    const invoiceIds = invoices.map((inv) => inv.id);
    const realizedGroups =
      invoiceIds.length === 0
        ? []
        : await prisma.panelRemittanceAllocation.groupBy({
            by: ['hospitalInvoiceId'],
            where: { hospitalInvoiceId: { in: invoiceIds } },
            _sum: { allocatedAmount: true },
          });
    const realizedByInvoice = new Map(realizedGroups.map((g) => [g.hospitalInvoiceId, g._sum.allocatedAmount ?? new Decimal(0)]));

    const rows = invoices.map((inv) => {
      const panelReceivableRealized = realizedByInvoice.get(inv.id) ?? new Decimal(0);
      const patientShareCollected = inv.paidTotal.lessThan(inv.patientShare) ? inv.paidTotal : inv.patientShare;
      return {
        hospitalInvoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        panelPatient: inv.panelPatient,
        department: inv.department,
        total: inv.total,
        patientShare: inv.patientShare,
        patientShareCollected,
        patientShareOutstanding: inv.patientShare.minus(patientShareCollected),
        panelReceivable: inv.panelReceivable,
        panelReceivableRealized,
        panelReceivableOutstanding: inv.panelReceivable.minus(panelReceivableRealized),
      };
    });

    const consolidated = rows.reduce(
      (acc, r) => ({
        patientShare: acc.patientShare.plus(r.patientShare),
        patientShareCollected: acc.patientShareCollected.plus(r.patientShareCollected),
        patientShareOutstanding: acc.patientShareOutstanding.plus(r.patientShareOutstanding),
        panelReceivable: acc.panelReceivable.plus(r.panelReceivable),
        panelReceivableRealized: acc.panelReceivableRealized.plus(r.panelReceivableRealized),
        panelReceivableOutstanding: acc.panelReceivableOutstanding.plus(r.panelReceivableOutstanding),
      }),
      {
        patientShare: new Decimal(0),
        patientShareCollected: new Decimal(0),
        patientShareOutstanding: new Decimal(0),
        panelReceivable: new Decimal(0),
        panelReceivableRealized: new Decimal(0),
        panelReceivableOutstanding: new Decimal(0),
      },
    );

    return {
      corporatePanelId: corporatePanel.id,
      corporatePanelName: corporatePanel.organizationName,
      activePatientsCount: panelPatients.length,
      invoices: rows,
      consolidated,
    };
  },

  /**
   * Panel Remittance — record an incoming payment from the panel company and
   * allocate it across this panel's outstanding department invoices. Never
   * touches `HospitalInvoice.paidTotal`/`status` (those track patient cash
   * only); realization lives entirely in `PanelRemittanceAllocation`.
   */
  async recordRemittance(corporatePanelId: string, body: RecordPanelRemittanceBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const corporatePanel = await tx.corporatePanel.findUnique({ where: { id: corporatePanelId } });
      if (!corporatePanel) throw new NotFoundError('Corporate panel not found');

      const panelPatientIds = (await tx.panelPatient.findMany({ where: { corporatePanelId }, select: { id: true } })).map(
        (p) => p.id,
      );
      const invoices =
        panelPatientIds.length === 0
          ? []
          : await tx.hospitalInvoice.findMany({
              where: { panelPatientId: { in: panelPatientIds }, panelReceivable: { gt: 0 } },
            });
      if (invoices.length === 0) {
        throw new NotFoundError('No panel-receivable invoices exist for this panel');
      }

      const realizedGroups = await tx.panelRemittanceAllocation.groupBy({
        by: ['hospitalInvoiceId'],
        where: { hospitalInvoiceId: { in: invoices.map((i) => i.id) } },
        _sum: { allocatedAmount: true },
      });
      const realizedByInvoice = new Map(realizedGroups.map((g) => [g.hospitalInvoiceId, g._sum.allocatedAmount ?? new Decimal(0)]));
      const outstandingByInvoice = new Map(
        invoices.map((inv) => [inv.id, inv.panelReceivable.minus(realizedByInvoice.get(inv.id) ?? new Decimal(0))]),
      );

      const amountDecimal = new Decimal(body.amount);
      let allocations: { hospitalInvoiceId: string; amount: Decimal }[];

      if (body.allocations && body.allocations.length > 0) {
        const byId = new Map(invoices.map((inv) => [inv.id, inv]));
        let sum = new Decimal(0);
        allocations = body.allocations.map((a) => {
          const invoice = byId.get(a.hospitalInvoiceId);
          if (!invoice) throw new ValidationError(`Invoice ${a.hospitalInvoiceId} does not belong to this panel`);
          const amt = new Decimal(a.amount);
          const outstanding = outstandingByInvoice.get(invoice.id)!;
          if (amt.greaterThan(outstanding)) {
            throw new ValidationError(
              `Allocation to ${invoice.invoiceNumber} (${amt.toString()}) exceeds its outstanding panel receivable (${outstanding.toString()})`,
            );
          }
          sum = sum.plus(amt);
          return { hospitalInvoiceId: invoice.id, amount: amt };
        });
        if (!sum.equals(amountDecimal)) {
          throw new ValidationError(`Allocations (${sum.toString()}) must sum to exactly the remittance amount (${amountDecimal.toString()})`);
        }
      } else {
        const eligible = invoices
          .map((inv) => ({ invoice: inv, outstanding: outstandingByInvoice.get(inv.id)! }))
          .filter((x) => x.outstanding.greaterThan(0));
        const totalOutstanding = eligible.reduce((sum, x) => sum.plus(x.outstanding), new Decimal(0));

        if (totalOutstanding.lessThanOrEqualTo(0)) {
          throw new ValidationError('Nothing outstanding to allocate this remittance against for this panel');
        }
        if (amountDecimal.greaterThan(totalOutstanding)) {
          throw new ValidationError(
            `Amount (${amountDecimal.toString()}) exceeds total outstanding panel receivable (${totalOutstanding.toString()}). Provide explicit allocations for any advance/credit portion.`,
          );
        }

        let allocated = new Decimal(0);
        allocations = eligible.map((x, idx) => {
          const isLast = idx === eligible.length - 1;
          const share = isLast
            ? amountDecimal.minus(allocated)
            : amountDecimal.mul(x.outstanding).div(totalOutstanding).toDecimalPlaces(2);
          allocated = allocated.plus(share);
          return { hospitalInvoiceId: x.invoice.id, amount: share };
        });
      }

      const remittance = await tx.panelRemittance.create({
        data: {
          remittanceNumber: generateRemittanceNumber(),
          corporatePanelId,
          amount: amountDecimal,
          method: body.method,
          reference: body.reference,
          remarks: body.remarks,
          receivedAt: body.receivedAt ?? new Date(),
          receivedById: actorId,
          allocations: {
            create: allocations
              .filter((a) => a.amount.greaterThan(0))
              .map((a) => ({ hospitalInvoiceId: a.hospitalInvoiceId, allocatedAmount: a.amount })),
          },
        },
        include: { allocations: true },
      });

      return remittance;
    });
  },

  async listRemittances(corporatePanelId: string) {
    const corporatePanel = await prisma.corporatePanel.findUnique({ where: { id: corporatePanelId } });
    if (!corporatePanel) throw new NotFoundError('Corporate panel not found');

    return prisma.panelRemittance.findMany({
      where: { corporatePanelId },
      include: {
        allocations: {
          include: { hospitalInvoice: { select: { id: true, invoiceNumber: true, departmentId: true } } },
        },
        receivedByUser: { select: { id: true, displayName: true, username: true } },
      },
      orderBy: { receivedAt: 'desc' },
    });
  },
};
