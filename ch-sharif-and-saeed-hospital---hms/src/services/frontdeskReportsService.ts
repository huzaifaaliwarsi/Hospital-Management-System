import apiClient from './apiClient';
import { toErrorMessage } from '../utils/apiErrors';
import { formatPKR, formatDateTimeDDMMYYYY } from '../utils/formatters';
import type { ReportDatePreset, ReportResult } from '../components/reports/GenericReportView';

/**
 * Front Desk / Billing report fetchers — backed by `/api/v1/reports/frontdesk/*`
 * (`hms-backend/src/modules/reports/frontdeskReports.*`). Reporting Guide
 * v7.5 §3–4. Every function returns `GenericReportView`'s `ReportResult<T>`
 * shape directly — no mock fallback.
 */

type RangeParams = { preset: ReportDatePreset; fromDate?: string; toDate?: string };

function params(range: RangeParams, extra?: Record<string, string | undefined>) {
  return { preset: range.preset, ...(range.preset === 'custom' && range.fromDate ? { fromDate: range.fromDate } : {}), ...(range.preset === 'custom' && range.toDate ? { toDate: range.toDate } : {}), ...extra };
}

async function get<T>(url: string, query: Record<string, any>): Promise<T> {
  try {
    const res = await apiClient.get<{ data: T }>(url, { params: query });
    return res.data.data;
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export interface EncounterRow {
  invoiceNumber: string;
  occurredAt: string;
  patient: string;
  payer: string;
  department: string | null;
  doctor: string | null;
  visitType: string;
  encounterType: string | null;
  status: string;
  createdBy: string | null;
}

export async function fetchEncounterRegister(range: RangeParams): Promise<ReportResult<EncounterRow>> {
  const d = await get<any>('/reports/frontdesk/encounters', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [{ label: 'Total Visits', value: String(d.totalVisits) }],
    rows: d.rows.map((r: any) => ({ ...r, occurredAt: formatDateTimeDDMMYYYY(r.occurredAt) })),
  };
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  patient: string;
  sourceType: string;
  department: string | null;
  gross: number;
  discount: number;
  net: number;
  paid: number;
  balance: number;
  createdBy: string | null;
  status: string;
}

export async function fetchInvoiceRegister(range: RangeParams): Promise<ReportResult<InvoiceRow>> {
  const d = await get<any>('/reports/frontdesk/invoices', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Gross Billed', value: formatPKR(d.summary.grossBilled) },
      { label: 'Discount', value: formatPKR(d.summary.discount), accent: 'negative' },
      { label: 'Net Billed', value: formatPKR(d.summary.netBilled) },
      { label: 'Outstanding', value: formatPKR(d.summary.outstanding), accent: 'warning' },
    ],
    rows: d.rows.map((r: any) => ({ ...r, createdAt: formatDateTimeDDMMYYYY(r.createdAt), gross: Number(r.gross), discount: Number(r.discount), net: Number(r.net), paid: Number(r.paid), balance: Number(r.balance) })),
  };
}

export interface CollectionRow {
  receiptNumber: string;
  reference: string;
  patient: string;
  amount: number;
  method: string;
  occurredAt: string;
  collectedBy: string;
}

export async function fetchCollectionReport(range: RangeParams, filters?: { collectedById?: string; method?: string }): Promise<ReportResult<CollectionRow>> {
  const d = await get<any>('/reports/frontdesk/collections', params(range, filters));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Total Collected', value: formatPKR(d.summary.total) },
      { label: 'Cash', value: formatPKR(d.summary.byMethod.CASH) },
      { label: 'Card/Bank/Online', value: formatPKR(Number(d.summary.byMethod.CARD) + Number(d.summary.byMethod.BANK) + Number(d.summary.byMethod.ONLINE)) },
      { label: 'Receipt Count', value: String(d.summary.receiptCount) },
    ],
    rows: d.rows.map((r: any) => ({ ...r, amount: Number(r.amount), occurredAt: formatDateTimeDDMMYYYY(r.occurredAt) })),
  };
}

export interface OutstandingRow {
  invoiceNumber: string;
  patient: string;
  department: string | null;
  net: number;
  paid: number;
  outstanding: number;
  createdBy: string | null;
  status: string;
}

export async function fetchOutstandingInvoices(range: RangeParams): Promise<ReportResult<OutstandingRow>> {
  const d = await get<any>('/reports/frontdesk/outstanding', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Outstanding Amount', value: formatPKR(d.summary.totalOutstanding), accent: 'warning' },
      { label: 'Invoice Count', value: String(d.summary.invoiceCount) },
    ],
    rows: d.rows.map((r: any) => ({ ...r, net: Number(r.net), paid: Number(r.paid), outstanding: Number(r.outstanding) })),
  };
}

export interface DiscountRow {
  invoiceNumber: string;
  patientOrPanel: string;
  service: string;
  standardAmount: number;
  discountAmount: number;
  net: number;
  reason: string | null;
}

export async function fetchDiscountReport(range: RangeParams): Promise<ReportResult<DiscountRow>> {
  const d = await get<any>('/reports/frontdesk/discounts', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Gross Before Discount', value: formatPKR(d.summary.grossBeforeDiscount) },
      { label: 'Discount Amount', value: formatPKR(d.summary.discountAmount), accent: 'negative' },
      { label: 'Net After Discount', value: formatPKR(d.summary.netAfterDiscount) },
    ],
    rows: d.rows.map((r: any) => ({ ...r, standardAmount: Number(r.standardAmount), discountAmount: Number(r.discountAmount), net: Number(r.net) })),
  };
}

export interface RefundVoidRow {
  reference: string;
  originalInvoice: string | null;
  invoiceId?: string | null;
  type: 'REFUND' | 'VOID';
  amount: number;
  performedBy: string;
  occurredAt: string;
}

export async function fetchRefundVoidReport(range: RangeParams): Promise<ReportResult<RefundVoidRow>> {
  const d = await get<any>('/reports/frontdesk/refunds-voids', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Refund Amount', value: formatPKR(d.summary.refundAmount), accent: 'negative' },
      { label: 'Refund Count', value: String(d.summary.refundCount) },
      { label: 'Void Count', value: String(d.summary.voidCount) },
    ],
    rows: d.rows.map((r: any) => ({ ...r, amount: Number(r.amount), occurredAt: formatDateTimeDDMMYYYY(r.occurredAt) })),
  };
}

export interface DepartmentRevenueRow {
  department: string;
  service: string;
  qty: number;
  gross: number;
  discount: number;
  net: number;
}

export async function fetchDepartmentRevenue(range: RangeParams): Promise<ReportResult<DepartmentRevenueRow>> {
  const d = await get<any>('/reports/frontdesk/department-revenue', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Gross', value: formatPKR(d.summary.gross) },
      { label: 'Discount', value: formatPKR(d.summary.discount), accent: 'negative' },
      { label: 'Net', value: formatPKR(d.summary.net) },
    ],
    rows: d.rows.map((r: any) => ({ ...r, qty: Number(r.qty), gross: Number(r.gross), discount: Number(r.discount), net: Number(r.net) })),
  };
}

export interface AdmissionPaymentCollectionRow {
  admissionNumber: string;
  patient: string;
  requestedAmount: number;
  receiptNo: string | null;
  collectedAmount: number;
  method: string | null;
  collectedBy: string | null;
  status: string;
}

export async function fetchAdmissionPaymentCollections(range: RangeParams): Promise<ReportResult<AdmissionPaymentCollectionRow>> {
  const d = await get<any>('/reports/frontdesk/admission-payment-collections', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Requested Amount', value: formatPKR(d.summary.requestedAmount) },
      { label: 'Collected Amount', value: formatPKR(d.summary.collectedAmount), accent: 'positive' },
      { label: 'Remaining Hospital Due', value: formatPKR(d.summary.remainingHospitalDue), accent: 'warning' },
      { label: 'Receipt Count', value: String(d.summary.receiptCount) },
    ],
    rows: d.rows.map((r: any) => ({ ...r, requestedAmount: Number(r.requestedAmount), collectedAmount: Number(r.collectedAmount) })),
  };
}

export interface LedgerEntry {
  occurredAt: string;
  reference: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  performedBy: string;
  runningBalance: number;
}

export async function fetchInvoiceLedger(invoiceId: string): Promise<{ invoiceNumber: string; patient: string; entries: LedgerEntry[] } | null> {
  try {
    const res = await apiClient.get<{ data: any }>(`/reports/frontdesk/invoices/${invoiceId}/ledger`);
    const d = res.data.data;
    return {
      invoiceNumber: d.invoiceNumber,
      patient: d.patient,
      entries: d.entries.map((e: any) => ({ ...e, occurredAt: formatDateTimeDDMMYYYY(e.occurredAt), debit: Number(e.debit), credit: Number(e.credit), runningBalance: Number(e.runningBalance) })),
    };
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export interface PanelPayerRow {
  payer: string;
  invoiceCount: number;
  gross: number;
  discount: number;
  net: number;
  paid: number;
  outstanding: number;
}

export async function fetchPanelPayerReport(range: RangeParams): Promise<ReportResult<PanelPayerRow>> {
  const d = await get<any>('/reports/frontdesk/panel-payer', params(range));
  return {
    periodLabel: d.period.label,
    rows: d.rows.map((r: any) => ({ ...r, gross: Number(r.gross), discount: Number(r.discount), net: Number(r.net), paid: Number(r.paid), outstanding: Number(r.outstanding) })),
  };
}

export interface ReceiptExceptionRow {
  receiptNumber: string;
  invoiceNumber: string | null;
  amount: number;
  printed: boolean;
  voided: boolean;
  collectedBy: string;
  occurredAt: string;
}

export async function fetchReceiptExceptionLog(range: RangeParams): Promise<ReportResult<ReceiptExceptionRow>> {
  const d = await get<any>('/reports/frontdesk/receipt-exceptions', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Printed', value: String(d.summary.printedCount) },
      { label: 'Voided', value: String(d.summary.voidedCount), accent: 'negative' },
    ],
    rows: d.rows.map((r: any) => ({ ...r, amount: Number(r.amount), occurredAt: formatDateTimeDDMMYYYY(r.occurredAt) })),
  };
}

export interface CashierPerformanceRow {
  cashier: string;
  receiptCount: number;
  totalCollected: number;
  averageTransaction: number;
}

export async function fetchCashierPerformance(range: RangeParams): Promise<ReportResult<CashierPerformanceRow>> {
  const d = await get<any>('/reports/frontdesk/cashier-performance', params(range));
  return {
    periodLabel: d.period.label,
    rows: d.rows.map((r: any) => ({ ...r, totalCollected: Number(r.totalCollected), averageTransaction: Number(r.averageTransaction) })),
  };
}

