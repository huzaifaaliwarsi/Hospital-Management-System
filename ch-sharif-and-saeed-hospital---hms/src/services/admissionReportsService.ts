import apiClient from './apiClient';
import { toErrorMessage } from '../utils/apiErrors';
import { formatPKR, formatDateTimeDDMMYYYY } from '../utils/formatters';
import type { ReportDatePreset, ReportResult } from '../components/reports/GenericReportView';

/**
 * Admission report fetchers — backed by `/api/v1/reports/admission/*`
 * (`hms-backend/src/modules/reports/admissionReports.*`). Reporting Guide
 * v7.5 §5. Admission has no cashier Balance Sheet / Account Settlement —
 * these are case lifecycle, bed and read-only financial status only.
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

export async function fetchAdmissionDailySummary(range: RangeParams): Promise<ReportResult<{ metric: string; value: string }>> {
  const d = await get<any>('/reports/admission/daily-summary', params(range));
  const rows = [
    { metric: 'Admissions Today', value: String(d.admissionsToday) },
    { metric: 'Active Admissions', value: String(d.activeAdmissions) },
    { metric: 'Pending Admissions', value: String(d.pendingAdmissions) },
    { metric: 'Discharges Today', value: String(d.dischargesToday) },
    { metric: 'Pending Discharge Clearance', value: String(d.pendingDischargeClearance) },
    { metric: 'Beds Occupied', value: `${d.bedsOccupied} / ${d.totalBeds}` },
    { metric: 'Beds Available', value: String(d.bedsAvailable) },
    { metric: 'Average Length of Stay', value: `${d.averageLengthOfStayDays} days` },
    { metric: 'Outstanding Inpatient Balance', value: formatPKR(d.outstandingInpatientBalance) },
  ];
  return { periodLabel: d.period.label, rows };
}

export interface AdmissionRegisterRow {
  id: string;
  admissionNumber: string;
  patient: string;
  payer: string;
  doctor: string | null;
  department: string;
  ward: string | null;
  bed: string | null;
  admittedAt: string | null;
  dischargedAt: string | null;
  status: string;
  createdBy: string | null;
}

export async function fetchAdmissionRegister(range: RangeParams, filters?: { status?: string; departmentId?: string }): Promise<ReportResult<AdmissionRegisterRow>> {
  const d = await get<any>('/reports/admission/register', params(range, filters));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Admissions', value: String(d.summary.admissionsCount) },
      { label: 'Active', value: String(d.summary.active), accent: 'positive' },
      { label: 'Discharged', value: String(d.summary.discharged) },
      { label: 'Panel / Self-Pay', value: `${d.summary.panel} / ${d.summary.selfPay}` },
    ],
    rows: d.rows.map((r: any) => ({ ...r, admittedAt: r.admittedAt ? formatDateTimeDDMMYYYY(r.admittedAt) : '—', dischargedAt: r.dischargedAt ? formatDateTimeDDMMYYYY(r.dischargedAt) : '—' })),
  };
}

export interface CensusRow {
  admissionNumber: string;
  patient: string;
  doctor: string | null;
  department: string;
  ward: string | null;
  room: string | null;
  bed: string | null;
  admittedAt: string;
  hospitalDue: number;
  pharmacyClearance: string;
  dischargeReady: boolean;
}

export async function fetchInpatientCensus(filters?: { departmentId?: string; wardId?: string }): Promise<ReportResult<CensusRow>> {
  const d = await get<any>('/reports/admission/census', filters || {});
  return {
    periodLabel: `As of ${formatDateTimeDDMMYYYY(d.asOf)}`,
    kpis: [{ label: 'Active Census', value: String(d.activeCensus) }],
    rows: d.rows.map((r: any) => ({ ...r, admittedAt: formatDateTimeDDMMYYYY(r.admittedAt), hospitalDue: Number(r.hospitalDue) })),
  };
}

export interface BedOccupancyRow {
  ward: string;
  capacity: number;
  occupied: number;
  available: number;
  occupancyPercent: number;
}

export async function fetchBedOccupancy(filters?: { departmentId?: string; wardId?: string }): Promise<ReportResult<BedOccupancyRow>> {
  const d = await get<any>('/reports/admission/bed-occupancy', filters || {});
  return {
    kpis: [
      { label: 'Beds Occupied', value: String(d.summary.bedsOccupied) },
      { label: 'Beds Available', value: String(d.summary.bedsAvailable) },
      { label: 'Occupancy %', value: `${d.summary.occupancyPercent}%` },
    ],
    rows: d.rows,
  };
}

export interface BedTransferRow {
  admissionNumber: string;
  patient: string;
  fromWard: string | null;
  fromBed: string | null;
  toWard: string | null;
  toBed: string;
  transferredAt: string;
  reason: string | null;
  changedBy: string;
}

export async function fetchBedTransferHistory(range: RangeParams): Promise<ReportResult<BedTransferRow>> {
  const d = await get<any>('/reports/admission/bed-transfers', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [{ label: 'Transfer Count', value: String(d.transferCount) }],
    rows: d.rows.map((r: any) => ({ ...r, transferredAt: formatDateTimeDDMMYYYY(r.transferredAt) })),
  };
}

export interface LengthOfStayRow {
  admissionNumber: string;
  patient: string;
  department: string;
  admittedAt: string;
  dischargedAt: string | null;
  lengthOfStayDays: number;
  status: string;
}

export async function fetchLengthOfStay(range: RangeParams): Promise<ReportResult<LengthOfStayRow>> {
  const d = await get<any>('/reports/admission/length-of-stay', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Average LOS', value: `${d.summary.averageLosDays} days` },
      { label: 'Longest Current Stay', value: `${d.summary.longestCurrentStayDays} days` },
      { label: 'Discharged', value: String(d.summary.dischargedCount) },
    ],
    rows: d.rows.map((r: any) => ({ ...r, admittedAt: formatDateTimeDDMMYYYY(r.admittedAt), dischargedAt: r.dischargedAt ? formatDateTimeDDMMYYYY(r.dischargedAt) : '—' })),
  };
}

export interface ServiceConsumptionRow {
  department: string;
  service: string;
  qty: number;
  gross: number;
  discount: number;
  net: number;
  admissionCount: number;
}

export async function fetchServiceConsumption(range: RangeParams): Promise<ReportResult<ServiceConsumptionRow>> {
  const d = await get<any>('/reports/admission/service-consumption', params(range));
  return {
    periodLabel: d.period.label,
    rows: d.rows.map((r: any) => ({ ...r, qty: Number(r.qty), gross: Number(r.gross), discount: Number(r.discount), net: Number(r.net) })),
  };
}

export interface InpatientOutstandingRow {
  admissionNumber: string;
  patient: string;
  hospitalNet: number;
  hospitalPaid: number;
  hospitalOutstanding: number;
  admissionStatus: string;
  invoiceStatus: string;
}

export async function fetchInpatientOutstanding(range: RangeParams): Promise<ReportResult<InpatientOutstandingRow>> {
  const d = await get<any>('/reports/admission/outstanding', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Total Hospital Outstanding', value: formatPKR(d.summary.totalHospitalOutstanding), accent: 'warning' },
      { label: 'Active Outstanding', value: formatPKR(d.summary.activeOutstanding) },
      { label: 'Discharged Outstanding', value: formatPKR(d.summary.dischargedOutstanding) },
    ],
    rows: d.rows.map((r: any) => ({ ...r, hospitalNet: Number(r.hospitalNet), hospitalPaid: Number(r.hospitalPaid), hospitalOutstanding: Number(r.hospitalOutstanding) })),
  };
}

export interface DischargeClearanceRow {
  admissionNumber: string;
  patient: string;
  doctor: string | null;
  clinicalReady: boolean;
  hospitalClearance: string;
  hospitalDue: number;
  pharmacyClearance: string;
  dischargeReady: boolean;
  completedBy: string | null;
  dischargeDate: string | null;
}

export async function fetchDischargeClearance(range: RangeParams): Promise<ReportResult<DischargeClearanceRow>> {
  const d = await get<any>('/reports/admission/discharge-clearance', params(range));
  return {
    periodLabel: d.period.label,
    kpis: [
      { label: 'Clinical Ready', value: String(d.summary.clinicalReady) },
      { label: 'Hospital Cleared', value: String(d.summary.hospitalCleared) },
      { label: 'Pharmacy Cleared', value: String(d.summary.pharmacyCleared) },
      { label: 'Fully Discharge-Ready', value: String(d.summary.fullyDischargeReady), accent: 'positive' },
    ],
    rows: d.rows.map((r: any) => ({ ...r, hospitalDue: Number(r.hospitalDue), dischargeDate: r.dischargeDate ? formatDateTimeDDMMYYYY(r.dischargeDate) : '—' })),
  };
}

export async function fetchRunningHospitalBill(admissionRecordId: string) {
  try {
    const res = await apiClient.get<{ data: any }>(`/reports/admission/${admissionRecordId}/running-bill`);
    const d = res.data.data;
    return {
      admissionNumber: d.admissionNumber,
      patient: d.patient,
      summary: {
        hospitalSubtotal: Number(d.summary.hospitalSubtotal),
        hospitalDiscount: Number(d.summary.hospitalDiscount),
        hospitalPaymentsReceived: Number(d.summary.hospitalPaymentsReceived),
        hospitalOutstanding: Number(d.summary.hospitalOutstanding),
      },
      rows: d.rows.map((r: any) => ({ ...r, occurredAt: formatDateTimeDDMMYYYY(r.occurredAt), qty: Number(r.qty), rate: Number(r.rate), gross: Number(r.gross), discount: Number(r.discount), net: Number(r.net), runningBalance: Number(r.runningBalance) })),
    };
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}
