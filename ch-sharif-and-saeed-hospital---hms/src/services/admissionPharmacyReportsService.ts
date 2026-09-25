import apiClient from './apiClient';
import { toErrorMessage } from '../utils/apiErrors';
import { formatDateTimeDDMMYYYY, formatPKR } from '../utils/formatters';
import type { ReportDatePreset, ReportResult } from '../components/reports/GenericReportView';

/**
 * Admission-side Pharmacy-linked report fetchers — backed by
 * `/api/v1/reports/admission/{pharmacy-requests,medicine-fulfillment,
 * high-value-approvals,pharmacy-clearance-status}` (Reporting Guide v7.5
 * §5.9–5.12). Read-only — detailed Pharmacy stock/cash ledger stays
 * Pharmacy-owned.
 */

type RangeParams = { preset: ReportDatePreset; fromDate?: string; toDate?: string };

function params(range: RangeParams) {
  return { preset: range.preset, ...(range.preset === 'custom' && range.fromDate ? { fromDate: range.fromDate } : {}), ...(range.preset === 'custom' && range.toDate ? { toDate: range.toDate } : {}) };
}

async function get<T>(url: string, query: Record<string, any>): Promise<T> {
  try {
    const res = await apiClient.get<{ data: T }>(url, { params: query });
    return res.data.data;
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export interface PharmacyRequestRow {
  requestRef: string;
  admissionNumber: string;
  patient: string;
  medicine: string;
  requestedQty: number;
  requestedBy: string;
  requestedAt: string;
  status: string;
  dispensedQty: number;
}

export async function fetchPharmacyMedicineRequests(range: RangeParams): Promise<ReportResult<PharmacyRequestRow>> {
  const d = await get<any>('/reports/admission/pharmacy-requests', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Requests', value: String(d.summary.requests) },
      { label: 'Pending', value: String(d.summary.pending), accent: 'warning' },
      { label: 'Partial', value: String(d.summary.partial) },
      { label: 'Fulfilled', value: String(d.summary.fulfilled), accent: 'positive' },
    ],
    rows: d.rows.map((r: any) => ({ ...r, requestedQty: Number(r.requestedQty), dispensedQty: Number(r.dispensedQty), requestedAt: formatDateTimeDDMMYYYY(r.requestedAt) })),
  };
}

export interface MedicineFulfillmentRow {
  requestRef: string;
  medicine: string;
  requestedQty: number;
  dispensedQty: number;
  unfulfilledQty: number;
  fulfillmentPercent: number;
  status: string;
  dispensedAt: string | null;
}

export async function fetchMedicineFulfillment(range: RangeParams): Promise<ReportResult<MedicineFulfillmentRow>> {
  const d = await get<any>('/reports/admission/medicine-fulfillment', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Requested Qty', value: String(d.summary.requestedQty) },
      { label: 'Dispensed Qty', value: String(d.summary.dispensedQty), accent: 'positive' },
      { label: 'Unfulfilled Qty', value: String(d.summary.unfulfilledQty), accent: 'warning' },
      { label: 'Fulfillment %', value: `${d.summary.fulfillmentPercent}%` },
    ],
    rows: d.rows.map((r: any) => ({
      ...r,
      requestedQty: Number(r.requestedQty),
      dispensedQty: Number(r.dispensedQty),
      unfulfilledQty: Number(r.unfulfilledQty),
      dispensedAt: r.dispensedAt ? formatDateTimeDDMMYYYY(r.dispensedAt) : '—',
    })),
  };
}

export interface HighValueApprovalRow {
  requestRef: string;
  admissionNumber: string;
  medicine: string;
  chargeAmount: number;
  approvalStatus: string;
  approvedBy: string | null;
  approvedAt: string | null;
  dispenseStatus: string;
}

export async function fetchHighValueApprovals(range: RangeParams): Promise<ReportResult<HighValueApprovalRow>> {
  const d = await get<any>('/reports/admission/high-value-approvals', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Pending', value: String(d.summary.pending), accent: 'warning' },
      { label: 'Approved', value: String(d.summary.approved), accent: 'positive' },
      { label: 'Rejected', value: String(d.summary.rejected), accent: 'negative' },
      { label: 'High-Value Requested', value: formatPKR(d.summary.highValueRequestedAmount) },
    ],
    rows: d.rows.map((r: any) => ({ ...r, chargeAmount: Number(r.chargeAmount), approvedAt: r.approvedAt ? formatDateTimeDDMMYYYY(r.approvedAt) : null })),
  };
}

export interface PharmacyClearanceRow {
  admissionNumber: string;
  patient: string;
  pharmacyInvoiceRef: string;
  chargeSummary: string;
  clearanceStatus: string;
  updatedAt: string;
  pharmacyActor: string | null;
}

export async function fetchPharmacyClearanceStatus(range: RangeParams): Promise<ReportResult<PharmacyClearanceRow>> {
  const d = await get<any>('/reports/admission/pharmacy-clearance-status', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Cleared', value: String(d.summary.cleared), accent: 'positive' },
      { label: 'Outstanding', value: String(d.summary.outstanding), accent: 'negative' },
      { label: 'Pending', value: String(d.summary.pending), accent: 'warning' },
    ],
    rows: d.rows.map((r: any) => ({ ...r, updatedAt: formatDateTimeDDMMYYYY(r.updatedAt) })),
  };
}
