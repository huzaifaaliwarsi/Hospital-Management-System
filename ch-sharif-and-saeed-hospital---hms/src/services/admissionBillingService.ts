import apiClient from './apiClient';
import { toErrorMessage } from '../utils/apiErrors';

/**
 * Front Desk's consolidated view + payment collection over an admission's
 * multiple department invoices — backed by `/api/v1/admission-billing/:id/*`
 * (HMS_V7.2_NEW_REQUIREMENTS.md §2.2/§2.10/§2.11). Each department invoice
 * stays independently owned; this is the presentation/allocation layer, not
 * a merge — the "consolidated" totals here are a display sum only.
 */

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK' | 'ONLINE';

export interface DepartmentInvoiceLine {
  id: string;
  serviceName: string;
  quantity: number;
  lineGross: number;
  discountAmount: number;
  lineNet: number;
  patientShare: number;
  panelReceivable: number;
  performedByName: string;
}

export interface DepartmentInvoiceRow {
  id: string;
  invoiceNumber: string;
  departmentName: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  paidTotal: number;
  outstanding: number;
  patientShare: number;
  panelReceivable: number;
  status: string;
  lines: DepartmentInvoiceLine[];
}

export interface AdmissionStatement {
  admissionId: string;
  admissionNumber: string;
  status: string;
  isNotFinalDischargeInvoice: boolean;
  departmentInvoices: DepartmentInvoiceRow[];
  consolidated: {
    subtotal: number;
    discountTotal: number;
    total: number;
    paidTotal: number;
    patientShare: number;
    panelReceivable: number;
    outstanding: number;
  };
  /** Advance/deposit receipts collected for this admission but not tied to any one department invoice (e.g. the deposit taken at admission creation) — already netted into `departmentInvoices[].outstanding` and `consolidated.outstanding` (oldest invoice first). */
  unallocatedCreditTotal: number;
  /** Portion of `unallocatedCreditTotal` not yet consumed by any outstanding invoice — a genuine available credit for this admission. */
  availableCredit: number;
}

function toNumber(v: any): number {
  return Number(v ?? 0);
}

function normalize(raw: Record<string, any>): AdmissionStatement {
  return {
    admissionId: raw.admissionId,
    admissionNumber: raw.admissionNumber,
    status: raw.status,
    isNotFinalDischargeInvoice: !!raw.isNotFinalDischargeInvoice,
    departmentInvoices: (raw.departmentInvoices || []).map((inv: any) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      departmentName: inv.department?.name || 'Unassigned',
      subtotal: toNumber(inv.subtotal),
      discountTotal: toNumber(inv.discountTotal),
      total: toNumber(inv.total),
      paidTotal: toNumber(inv.paidTotal),
      outstanding: toNumber(inv.outstanding),
      patientShare: toNumber(inv.patientShare),
      panelReceivable: toNumber(inv.panelReceivable),
      status: inv.status,
      lines: (inv.lines || []).map((l: any) => ({
        id: l.id,
        serviceName: l.serviceRate?.name || '',
        quantity: Number(l.quantity ?? 1),
        lineGross: toNumber(l.lineGross),
        discountAmount: toNumber(l.discountAmount),
        lineNet: toNumber(l.lineNet),
        patientShare: toNumber(l.patientShare),
        panelReceivable: toNumber(l.panelReceivable),
        performedByName: l.performedBy?.fullName || '',
      })),
    })),
    consolidated: {
      subtotal: toNumber(raw.consolidated?.subtotal),
      discountTotal: toNumber(raw.consolidated?.discountTotal),
      total: toNumber(raw.consolidated?.total),
      paidTotal: toNumber(raw.consolidated?.paidTotal),
      patientShare: toNumber(raw.consolidated?.patientShare),
      panelReceivable: toNumber(raw.consolidated?.panelReceivable),
      outstanding: toNumber(raw.consolidated?.outstanding),
    },
    unallocatedCreditTotal: toNumber(raw.unallocatedCreditTotal),
    availableCredit: toNumber(raw.availableCredit),
  };
}

export async function fetchAdmissionStatement(admissionId: string): Promise<AdmissionStatement> {
  try {
    const res = await apiClient.get<{ data: Record<string, any> }>(`/admission-billing/${admissionId}/statement`);
    return normalize(res.data.data);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export async function collectAdmissionPayment(
  admissionId: string,
  values: {
    amount: number;
    paymentMethod: PaymentMethod;
    reference?: string;
    allocations?: { invoiceId: string; amount: number }[];
  },
): Promise<{ allocations: { invoiceId: string | null; amount: number }[] }> {
  try {
    const res = await apiClient.post<{ data: { allocations: { invoiceId: string | null; amount: string | number }[] } }>(
      `/admission-billing/${admissionId}/collect-payment`,
      values,
    );
    return { allocations: res.data.data.allocations.map((a) => ({ invoiceId: a.invoiceId, amount: Number(a.amount) })) };
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

/**
 * Admission Patient Records + Running Ledger (Front Desk) — one row per
 * checked-in admission (not per department invoice), and one flattened
 * chronological ledger per admission across every department invoice's
 * lines AND every payment receipt (allocated or unallocated advance/
 * deposit) — backed by `/api/v1/admission-billing/records` and
 * `/api/v1/admission-billing/:id/ledger`.
 */

export type AdmissionBillingStatus = 'NO_CHARGES' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface AdmissionPatientRecordRow {
  id: string;
  admissionNumber: string;
  patientName: string;
  patientMrNumber: string | null;
  payerType: 'PANEL' | 'SELF_PAY';
  admittedAt: string | null;
  ward: string | null;
  room: string | null;
  bed: string | null;
  currentCharges: number;
  totalPaid: number;
  outstanding: number;
  availableCredit: number;
  clinicalStatus: string;
  billingStatus: AdmissionBillingStatus;
}

export interface AdmissionLedgerEntry {
  date: string;
  type: string;
  department: string | null;
  description: string;
  qty: number | null;
  rate: number | null;
  grossAmount?: number;
  discountAmount?: number;
  discountReason?: string | null;
  debit: number;
  credit: number;
  paidAmount?: number;
  dueAmount?: number;
  status?: 'PAID' | 'UNPAID' | 'PARTIAL' | 'SELF';
  runningBalance: number;
  reference: string;
  postedBy: string | null;
}

export interface AdmissionReceiptSummary {
  id: string;
  receiptNumber: string;
  amount: number;
  method: string;
  reference?: string | null;
  collectedAt: string;
  collectedByName?: string | null;
}

export interface AdmissionLedgerPanelFigures {
  grossCharges: number;
  patientShare: number;
  panelReceivable: number;
  patientPaid: number;
  panelRealized: number;
  patientOutstanding: number;
  panelOutstanding: number;
}

export interface AdmissionLedger {
  admissionId: string;
  admissionNumber: string;
  status: string;
  payerType: 'PANEL' | 'SELF_PAY';
  patientName: string;
  patientMrNumber: string | null;
  panelName: string | null;
  admittedAt: string | null;
  ward: string | null;
  room: string | null;
  bed: string | null;
  finalBillNumber: string | null;
  finalBillGeneratedAt: string | null;
  entries: AdmissionLedgerEntry[];
  receipts?: AdmissionReceiptSummary[];
  summary: {
    totalCharges: number;
    totalPaid: number;
    outstandingBalance: number;
    availableCredit: number;
  };
  panel: AdmissionLedgerPanelFigures | null;
}

function toRecordRow(raw: Record<string, any>): AdmissionPatientRecordRow {
  return {
    id: raw.id,
    admissionNumber: raw.admissionNumber,
    patientName: raw.patientName,
    patientMrNumber: raw.patientMrNumber ?? null,
    payerType: raw.payerType,
    admittedAt: raw.admittedAt,
    ward: raw.ward ?? null,
    room: raw.room ?? null,
    bed: raw.bed ?? null,
    currentCharges: toNumber(raw.currentCharges),
    totalPaid: toNumber(raw.totalPaid),
    outstanding: toNumber(raw.outstanding),
    availableCredit: toNumber(raw.availableCredit),
    clinicalStatus: raw.clinicalStatus,
    billingStatus: raw.billingStatus,
  };
}

function toLedger(raw: Record<string, any>): AdmissionLedger {
  return {
    admissionId: raw.admissionId,
    admissionNumber: raw.admissionNumber,
    status: raw.status,
    payerType: raw.payerType,
    patientName: raw.patientName,
    patientMrNumber: raw.patientMrNumber ?? null,
    panelName: raw.panelName ?? null,
    admittedAt: raw.admittedAt,
    ward: raw.ward ?? null,
    room: raw.room ?? null,
    bed: raw.bed ?? null,
    finalBillNumber: raw.finalBillNumber ?? null,
    finalBillGeneratedAt: raw.finalBillGeneratedAt ?? null,
    entries: (raw.entries || []).map((e: any) => ({
      date: e.date,
      type: e.type,
      department: e.department ?? null,
      description: e.description,
      qty: e.qty != null ? toNumber(e.qty) : null,
      rate: e.rate != null ? toNumber(e.rate) : null,
      grossAmount: e.grossAmount != null ? toNumber(e.grossAmount) : undefined,
      discountAmount: e.discountAmount != null ? toNumber(e.discountAmount) : undefined,
      discountReason: e.discountReason ?? null,
      debit: toNumber(e.debit),
      credit: toNumber(e.credit),
      paidAmount: e.paidAmount != null ? toNumber(e.paidAmount) : toNumber(e.credit),
      dueAmount: e.dueAmount != null ? toNumber(e.dueAmount) : Math.max(0, toNumber(e.debit) - toNumber(e.credit)),
      status: e.status || (toNumber(e.dueAmount) <= 0 ? 'PAID' : 'UNPAID'),
      runningBalance: toNumber(e.runningBalance),
      reference: e.reference,
      postedBy: e.postedBy ?? null,
    })),
    receipts: (raw.receipts || []).map((r: any) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      amount: toNumber(r.amount),
      method: r.method,
      reference: r.reference ?? null,
      collectedAt: r.collectedAt,
      collectedByName: r.collectedByName ?? null,
    })),
    summary: {
      totalCharges: toNumber(raw.summary?.totalCharges),
      totalPaid: toNumber(raw.summary?.totalPaid),
      outstandingBalance: toNumber(raw.summary?.outstandingBalance),
      availableCredit: toNumber(raw.summary?.availableCredit),
    },
    panel: raw.panel
      ? {
          grossCharges: toNumber(raw.panel.grossCharges),
          patientShare: toNumber(raw.panel.patientShare),
          panelReceivable: toNumber(raw.panel.panelReceivable),
          patientPaid: toNumber(raw.panel.patientPaid),
          panelRealized: toNumber(raw.panel.panelRealized),
          patientOutstanding: toNumber(raw.panel.patientOutstanding),
          panelOutstanding: toNumber(raw.panel.panelOutstanding),
        }
      : null,
  };
}

export async function fetchAdmissionRecords(): Promise<AdmissionPatientRecordRow[]> {
  try {
    const res = await apiClient.get<{ data: Record<string, any>[] }>('/admission-billing/records');
    return res.data.data.map(toRecordRow);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export async function fetchAdmissionLedger(admissionId: string): Promise<AdmissionLedger> {
  try {
    const res = await apiClient.get<{ data: Record<string, any> }>(`/admission-billing/${admissionId}/ledger`);
    return toLedger(res.data.data);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export async function generateFinalBill(admissionId: string): Promise<AdmissionLedger> {
  try {
    const res = await apiClient.post<{ data: Record<string, any> }>(`/admission-billing/${admissionId}/generate-final-bill`, {});
    return toLedger(res.data.data);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}
