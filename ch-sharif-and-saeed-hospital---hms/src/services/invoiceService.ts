import apiClient from './apiClient';
import { formatDisplayDate } from '../utils/dateConstants';

/**
 * Live Hospital Invoices / Billing service — backed by `/api/v1/invoices*`
 * and `/api/v1/encounters`. This is the pre-v7.2 single-invoice-per-
 * admission/encounter billing model (still the real, tested, working
 * model) — the v7.2 Department Sub-Invoice Split (HMS_V7.2_NEW_REQUIREMENTS.md
 * §2.2) that would replace it with one invoice per (admission × department)
 * is a distinct, larger, not-yet-started schema change; see that doc's
 * open-questions section before attempting it.
 */

export type InvoiceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
export type EncounterType = 'OPD' | 'OBSERVATION' | 'EMERGENCY';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK' | 'ONLINE';

export interface InvoiceLine {
  id: string;
  serviceName: string;
  serviceCode: string;
  quantity: number;
  rate: number;
  lineGross: number;
  discountAmount: number;
  discountReason: string;
  lineNet: number;
  performedByName: string;
}

export interface PaymentReceiptRow {
  id: string;
  receiptNumber: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  isReversed: boolean;
  collectedByName: string;
  collectedAt: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  sourceType: string;
  encounterType: EncounterType | null;
  status: InvoiceStatus;
  patientName: string;
  patientMr: string;
  payerType: 'Corporate / Panel' | 'Self Pay';
  subtotal: number;
  discountTotal: number;
  total: number;
  paidTotal: number;
  balanceDue: number;
  createdAt: string;
  createdAtIso: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  lines: InvoiceLine[];
  receipts: PaymentReceiptRow[];
  doctorName: string;
  departmentName: string;
  panelName: string;
}

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dateStr = formatDisplayDate(d);
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

function toInvoiceSummary(raw: Record<string, any>): InvoiceSummary {
  const isPanel = !!raw.panelPatientId;
  const patient = raw.panelPatient || raw.selfPayEncounter;
  return {
    id: raw.id,
    invoiceNumber: raw.invoiceNumber,
    sourceType: raw.sourceType,
    encounterType: raw.encounterType || null,
    status: raw.status,
    patientName: patient?.fullName || 'Walk-in Patient',
    patientMr: isPanel ? patient?.mrNumber || '' : '— (Self-Pay)',
    payerType: isPanel ? 'Corporate / Panel' : 'Self Pay',
    subtotal: Number(raw.subtotal ?? 0),
    discountTotal: Number(raw.discountTotal ?? 0),
    total: Number(raw.total ?? 0),
    paidTotal: Number(raw.paidTotal ?? 0),
    balanceDue: Number(raw.balanceDue ?? Math.max(0, Number(raw.total ?? 0) - Number(raw.paidTotal ?? 0))),
    createdAt: formatTimestamp(raw.createdAt),
    createdAtIso: raw.createdAt || '',
  };
}

function toInvoiceDetail(raw: Record<string, any>): InvoiceDetail {
  return {
    ...toInvoiceSummary(raw),
    doctorName: raw.appointment?.doctor?.fullName || '',
    departmentName: raw.appointment?.department?.name || '',
    panelName: raw.panelPatient?.corporatePanel?.organizationName || '',
    lines: (raw.lines || []).map((l: any) => ({
      id: l.id,
      serviceName: l.serviceRate?.name || '',
      serviceCode: l.serviceRate?.code || '',
      quantity: Number(l.quantity ?? 1),
      rate: Number(l.rateSnapshot ?? 0),
      lineGross: Number(l.lineGross ?? 0),
      discountAmount: Number(l.discountAmount ?? 0),
      discountReason: l.discountReason || '',
      lineNet: Number(l.lineNet ?? 0),
      performedByName: l.performedBy?.fullName || '',
    })),
    receipts: (raw.paymentReceipts || []).map((r: any) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      amount: Number(r.amount ?? 0),
      method: r.method,
      reference: r.referenceNote || '',
      isReversed: !!r.isReversed,
      collectedByName: r.collectedBy?.username || '',
      collectedAt: formatTimestamp(r.collectedAt),
    })),
  };
}

export async function fetchInvoices(params?: {
  status?: InvoiceStatus;
  encounterType?: EncounterType;
  date?: string;
  search?: string;
}): Promise<InvoiceSummary[]> {
  const res = await apiClient.get<{ data: Record<string, any>[] }>('/invoices', { params });
  return res.data.data.map(toInvoiceSummary);
}

export async function fetchInvoiceDetail(id: string): Promise<InvoiceDetail> {
  const res = await apiClient.get<{ data: Record<string, any> }>(`/invoices/${id}`);
  return toInvoiceDetail(res.data.data);
}

export async function addServiceLine(
  invoiceId: string,
  values: { serviceRateId: string; quantity: number; performedByStaffId?: string },
): Promise<void> {
  await apiClient.post(`/invoices/${invoiceId}/lines`, values);
}

export async function applyDiscount(
  invoiceId: string,
  values: { lineItemId?: string; discountPercent?: number; discountAmount?: number; discountReason: string },
): Promise<void> {
  await apiClient.post(`/invoices/${invoiceId}/discounts`, values);
}

export async function collectPayment(
  invoiceId: string,
  values: { amount: number; paymentMethod: PaymentMethod; reference?: string },
): Promise<void> {
  await apiClient.post(`/invoices/${invoiceId}/payments`, values);
}

export async function refundPayment(
  invoiceId: string,
  values: { paymentReceiptId?: string; amount: number; refundMethod: PaymentMethod; reason: string },
): Promise<void> {
  await apiClient.post(`/invoices/${invoiceId}/refund`, values);
}

export interface CreateEncounterFormValues {
  encounterType: EncounterType;
  panelPatientId?: string;
  selfPayEncounterId?: string;
  newSelfPayPatient?: {
    fullName: string;
    guardianName?: string;
    gender?: string;
    dob?: string;
    cnicOrPassport?: string;
    phone?: string;
    address?: string;
  };
  departmentId?: string;
  doctorStaffId?: string;
  notes?: string;
}

/** `POST /encounters` — Walk-In / Encounter Intake (OPD/Observation/Emergency), creates the invoice shell. */
export async function createEncounter(values: CreateEncounterFormValues): Promise<InvoiceDetail> {
  const res = await apiClient.post<{ data: Record<string, any> }>('/encounters', {
    encounterType: values.encounterType,
    panelPatientId: values.panelPatientId || undefined,
    selfPayEncounterId: values.selfPayEncounterId || undefined,
    newSelfPayPatient: values.newSelfPayPatient || undefined,
    departmentId: values.departmentId || undefined,
    doctorStaffId: values.doctorStaffId || undefined,
    notes: values.notes?.trim() || undefined,
  });
  return toInvoiceDetail(res.data.data);
}

