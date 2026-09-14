import apiClient from './apiClient';
import { formatDisplayDate } from '../utils/dateConstants';

/**
 * Live Admission service — backed by `/api/v1/admission*`. This is the
 * v7.2 §2.9 relocation (HMS_V7.2_NEW_REQUIREMENTS.md): admission creation
 * now happens at Front Desk (this service is consumed by
 * `features/frontDesk/newAdmission/NewAdmissionView.tsx`), while the
 * Admission Portal keeps managing the stay after handoff.
 */

export type MedicationMode = 'SELF' | 'HOSPITAL_MANAGED';
export type AdmissionStatus = 'PLANNED' | 'CONFIRMED' | 'ACTIVE' | 'DISCHARGE_PENDING' | 'DISCHARGED' | 'CANCELLED';

export interface AdmissionRecord {
  id: string;
  admissionNumber: string;
  patientName: string;
  patientMrNumber: string;
  payerType: 'Corporate / Panel' | 'Self Pay';
  departmentId: string;
  departmentName: string;
  doctorId: string;
  doctorName: string;
  bedLabel: string | null;
  status: AdmissionStatus;
  medicationMode: MedicationMode;
  diagnosis: string;
  estimatedAmount: number | null;
  expectedAt: string;
  admittedAt: string;
  dischargedAt: string;
  createdAt: string;
  /** Raw ISO timestamp (unlike `createdAt` above, which is display-formatted) — for client-side date filtering. */
  createdAtIso: string;
}

export interface CreateAdmissionFormValues {
  panelPatientId: string;
  selfPayEncounterId: string;
  departmentId: string;
  doctorStaffId: string;
  preferredBedId: string;
  expectedAt: string;
  diagnosis: string;
  estimatedAmount: number | '';
  medicationMode: MedicationMode;
  notes: string;
}

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dateStr = formatDisplayDate(d);
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

function toAdmissionRecord(raw: Record<string, any>): AdmissionRecord {
  const isPanel = !!raw.panelPatientId;
  const patient = raw.panelPatient || raw.selfPayEncounter;
  const bed = raw.bed;
  return {
    id: raw.id,
    admissionNumber: raw.admissionNumber,
    patientName: patient?.fullName || 'Unknown',
    patientMrNumber: isPanel ? patient?.mrNumber || '' : '— (Self-Pay)',
    payerType: isPanel ? 'Corporate / Panel' : 'Self Pay',
    departmentId: raw.departmentId,
    departmentName: raw.department?.name || '',
    doctorId: raw.doctorStaffId,
    doctorName: raw.doctor?.fullName || '',
    bedLabel: bed ? `${bed.room?.ward?.name || ''} / ${bed.room?.name || ''} / ${bed.bedNumber}` : null,
    status: raw.status,
    medicationMode: raw.medicationMode,
    diagnosis: raw.diagnosis || '',
    estimatedAmount: raw.estimatedAmount != null ? Number(raw.estimatedAmount) : null,
    expectedAt: raw.expectedAt ? formatTimestamp(raw.expectedAt) : '',
    admittedAt: raw.admittedAt ? formatTimestamp(raw.admittedAt) : '',
    dischargedAt: raw.dischargedAt ? formatTimestamp(raw.dischargedAt) : '',
    createdAt: formatTimestamp(raw.createdAt),
    createdAtIso: raw.createdAt || '',
  };
}

export async function fetchAdmissions(params?: { status?: AdmissionStatus; search?: string }): Promise<AdmissionRecord[]> {
  const res = await apiClient.get<{ data: Record<string, any>[] }>('/admissions', { params });
  return res.data.data.map(toAdmissionRecord);
}

/**
 * Front Desk creates the admission file (v7.2 §2.9). Exactly one of
 * `panelPatientId` / `selfPayEncounterId` should be set — the caller
 * resolves which from the selected `Patient.payerType`.
 */
export async function createAdmission(values: CreateAdmissionFormValues): Promise<AdmissionRecord> {
  const res = await apiClient.post<{ data: Record<string, any> }>('/admissions', {
    panelPatientId: values.panelPatientId || undefined,
    selfPayEncounterId: values.selfPayEncounterId || undefined,
    departmentId: values.departmentId,
    doctorStaffId: values.doctorStaffId,
    preferredBedId: values.preferredBedId || undefined,
    expectedAt: values.expectedAt || undefined,
    diagnosis: values.diagnosis?.trim() || undefined,
    estimatedAmount: values.estimatedAmount === '' ? undefined : Number(values.estimatedAmount),
    medicationMode: values.medicationMode,
    notes: values.notes?.trim() || undefined,
  });
  return toAdmissionRecord(res.data.data);
}
