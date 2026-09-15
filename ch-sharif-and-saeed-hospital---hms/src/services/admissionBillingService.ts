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
): Promise<{ allocations: { invoiceId: string; amount: number }[] }> {
  try {
    const res = await apiClient.post<{ data: { allocations: { invoiceId: string; amount: string | number }[] } }>(
      `/admission-billing/${admissionId}/collect-payment`,
      values,
    );
    return { allocations: res.data.data.allocations.map((a) => ({ invoiceId: a.invoiceId, amount: Number(a.amount) })) };
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}
