import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { resolveDateRange } from './dashboard.service';
import type {
  PharmacyRequestReportQuery,
  MedicineFulfillmentQuery,
  HighValueApprovalQuery,
  PharmacyClearanceStatusQuery,
} from './admissionPharmacyReports.schemas';

/**
 * Admission-side Pharmacy-linked reporting (Reporting Guide v7.5 §5.9–5.12).
 * Admission reports only request/response and linked summary data here —
 * Pharmacy's own detailed stock/cash ledger stays Pharmacy-owned, read-only
 * from this side.
 */

const patientNameSelect = {
  panelPatient: { select: { id: true, fullName: true, mrNumber: true } },
  selfPayEncounter: { select: { id: true, fullName: true, phone: true } },
} as const;

function patientDisplayName(row: { panelPatient?: { fullName: string } | null; selfPayEncounter?: { fullName: string } | null }) {
  return row.panelPatient?.fullName || row.selfPayEncounter?.fullName || 'Unknown Patient';
}

const userSummarySelect = { id: true, displayName: true, username: true } as const;

export const admissionPharmacyReportsService = {
  /** Guide §5.9 — medicines requested for inpatients and Pharmacy's fulfillment status. */
  async getPharmacyMedicineRequestReport(query: PharmacyRequestReportQuery) {
    const { start, end, label } = resolveDateRange(query);
    const where: Prisma.PharmacyClearanceWhereInput = {
      requestedAt: { gte: start, lte: end },
      ...(query.admissionRecordId ? { admissionRecordId: query.admissionRecordId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.medicineId ? { lines: { some: { medicineId: query.medicineId } } } : {}),
    };

    const rows = await prisma.pharmacyClearance.findMany({
      where,
      include: {
        admissionRecord: { select: { admissionNumber: true, ...patientNameSelect } },
        requestedBy: { select: userSummarySelect },
        lines: { include: { medicine: { select: { name: true } } } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 500,
    });

    let requestedQty = new Decimal(0);
    let dispensedQty = new Decimal(0);
    const statusCounts: Record<string, number> = {};
    for (const r of rows) {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
      for (const l of r.lines) {
        requestedQty = requestedQty.plus(l.requestedQuantity);
        dispensedQty = dispensedQty.plus(l.dispensedQuantity);
      }
    }

    return {
      period: { label, start: start.toISOString(), end: end.toISOString() },
      summary: {
        requests: rows.length,
        requestedQty,
        dispensedQty,
        pending: statusCounts.REQUESTED ?? 0,
        partial: statusCounts.PARTIALLY_FULFILLED ?? 0,
        rejected: statusCounts.REJECTED ?? 0,
        fulfilled: statusCounts.DISPENSED ?? 0,
      },
      rows: rows.flatMap((r) =>
        r.lines.map((l) => ({
          requestRef: r.medicineRequestNumber,
          admissionNumber: r.admissionRecord.admissionNumber,
          patient: patientDisplayName(r.admissionRecord),
          medicine: l.medicine.name,
          requestedQty: l.requestedQuantity,
          requestedBy: r.requestedBy.displayName || r.requestedBy.username,
          requestedAt: r.requestedAt,
          status: r.status,
          dispensedQty: l.dispensedQuantity,
        })),
      ),
    };
  },

  /** Guide §5.10 — requested vs actually dispensed quantities. */
  async getMedicineFulfillmentReport(query: MedicineFulfillmentQuery) {
    const { start, end, label } = resolveDateRange(query);
    const lines = await prisma.pharmacyClearanceLine.findMany({
      where: {
        pharmacyClearance: {
          requestedAt: { gte: start, lte: end },
          ...(query.admissionRecordId ? { admissionRecordId: query.admissionRecordId } : {}),
        },
        ...(query.medicineId ? { medicineId: query.medicineId } : {}),
      },
      include: {
        medicine: { select: { name: true } },
        pharmacyClearance: { select: { medicineRequestNumber: true, status: true, fulfilledAt: true } },
      },
      orderBy: { id: 'desc' },
      take: 1000,
    });

    const totalRequested = lines.reduce((s, l) => s.plus(l.requestedQuantity), new Decimal(0));
    const totalDispensed = lines.reduce((s, l) => s.plus(l.dispensedQuantity), new Decimal(0));

    return {
      period: { label, start: start.toISOString(), end: end.toISOString() },
      summary: {
        requestedQty: totalRequested,
        dispensedQty: totalDispensed,
        unfulfilledQty: totalRequested.minus(totalDispensed),
        fulfillmentPercent: totalRequested.isZero() ? 0 : Math.round(totalDispensed.div(totalRequested).toNumber() * 1000) / 10,
      },
      rows: lines.map((l) => ({
        requestRef: l.pharmacyClearance.medicineRequestNumber,
        medicine: l.medicine.name,
        requestedQty: l.requestedQuantity,
        dispensedQty: l.dispensedQuantity,
        unfulfilledQty: l.requestedQuantity.minus(l.dispensedQuantity),
        fulfillmentPercent: l.requestedQuantity.isZero() ? 0 : Math.round(l.dispensedQuantity.div(l.requestedQuantity).toNumber() * 1000) / 10,
        status: l.pharmacyClearance.status,
        dispensedAt: l.pharmacyClearance.fulfilledAt,
      })),
    };
  },

  /** Guide §5.11 — Pharmacy requests requiring configured high-value authorization before dispense. */
  async getHighValueMedicineApprovalReport(query: HighValueApprovalQuery) {
    const { start, end, label } = resolveDateRange(query);
    const rows = await prisma.highCostMedicineAuthorization.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(query.status ? { status: query.status } : {}),
        ...(query.admissionRecordId ? { pharmacyClearance: { admissionRecordId: query.admissionRecordId } } : {}),
      },
      include: {
        pharmacyClearance: {
          select: { medicineRequestNumber: true, admissionRecord: { select: { admissionNumber: true } }, lines: { include: { medicine: { select: { name: true } } }, take: 1 } },
        },
        managementApprovedByUser: { select: userSummarySelect },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return {
      period: { label, start: start.toISOString(), end: end.toISOString() },
      summary: {
        pending: rows.filter((r) => r.status === 'PENDING').length,
        approved: rows.filter((r) => r.status === 'AUTHORIZED').length,
        rejected: rows.filter((r) => r.status === 'REJECTED').length,
        highValueRequestedAmount: rows.reduce((s, r) => s.plus(r.lineTotal), new Decimal(0)),
      },
      rows: rows.map((r) => ({
        requestRef: r.pharmacyClearance.medicineRequestNumber,
        admissionNumber: r.pharmacyClearance.admissionRecord.admissionNumber,
        medicine: r.pharmacyClearance.lines[0]?.medicine.name ?? '—',
        chargeAmount: r.lineTotal,
        approvalStatus: r.status,
        approvedBy: r.managementApprovedByUser?.displayName || r.managementApprovedByUser?.username || null,
        approvedAt: r.managementApprovedAt,
        dispenseStatus: r.status === 'AUTHORIZED' ? 'Cleared to Dispense' : r.status === 'REJECTED' ? 'Blocked' : 'Awaiting Authorization',
      })),
    };
  },

  /** Guide §5.12 — read-only Admission view of Pharmacy financial/fulfillment clearance for discharge. */
  async getPharmacyClearanceStatusReport(query: PharmacyClearanceStatusQuery) {
    const { start, end, label } = resolveDateRange(query);
    const rows = await prisma.pharmacyClearance.findMany({
      where: {
        requestedAt: { gte: start, lte: end },
        ...(query.departmentId ? { admissionRecord: { departmentId: query.departmentId } } : {}),
      },
      include: {
        admissionRecord: { select: { admissionNumber: true, ...patientNameSelect } },
        fulfilledBy: { select: userSummarySelect },
        lines: true,
      },
      orderBy: { requestedAt: 'desc' },
      take: 500,
    });

    const clearanceOf = (status: string): 'CLEARED' | 'OUTSTANDING' | 'PENDING' => (status === 'DISPENSED' || status === 'INVOICED' || status === 'CLEARANCE_SENT' ? 'CLEARED' : status === 'REJECTED' ? 'OUTSTANDING' : 'PENDING');

    return {
      period: { label, start: start.toISOString(), end: end.toISOString() },
      summary: {
        cleared: rows.filter((r) => clearanceOf(r.status) === 'CLEARED').length,
        outstanding: rows.filter((r) => clearanceOf(r.status) === 'OUTSTANDING').length,
        pending: rows.filter((r) => clearanceOf(r.status) === 'PENDING').length,
      },
      rows: rows.map((r) => ({
        admissionNumber: r.admissionRecord.admissionNumber,
        patient: patientDisplayName(r.admissionRecord),
        pharmacyInvoiceRef: r.medicineRequestNumber,
        chargeSummary: `${r.lines.length} line${r.lines.length === 1 ? '' : 's'}`,
        clearanceStatus: clearanceOf(r.status),
        updatedAt: r.fulfilledAt ?? r.requestedAt,
        pharmacyActor: r.fulfilledBy?.displayName || r.fulfilledBy?.username || null,
      })),
    };
  },
};
