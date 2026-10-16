import apiClient from './apiClient';
import { toErrorMessage } from '../utils/apiErrors';
import { formatDisplayDate } from '../utils/dateConstants';

/**
 * Front Desk's `AdmissionPaymentRequest` queue — backed by
 * `/api/v1/admission-payment-requests*` (new this session; the Admission
 * portal already raised these via `POST /admissions/:id/request-advance`,
 * but nothing let Front Desk see or collect against them until now).
 */

export type PaymentRequestStatus = 'PENDING' | 'FULFILLED' | 'PARTIALLY_FULFILLED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK' | 'ONLINE';

export interface PaymentRequestRecord {
  id: string;
  requestType: 'ADVANCE' | 'PARTIAL' | 'FINAL';
  requestedAmount: number;
  collectedAmount: number;
  remainingAmount: number;
  status: PaymentRequestStatus;
  notes: string;
  admissionId: string;
  admissionNumber: string;
  patientName: string;
  patientPhone: string;
  patientMrNumber: string;
  payerType: 'Corporate / Panel' | 'Self Pay';
  departmentName: string;
  doctorName: string;
  requestedByLabel: string;
  requestedAt: string;
}

function formatTs(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDisplayDate(d)}, ${d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`;
}

function toPaymentRequestRecord(raw: Record<string, any>): PaymentRequestRecord {
  const admission = raw.admissionRecord || {};
  const isPanel = !!admission.panelPatient;
  const patient = admission.panelPatient || admission.selfPayEncounter;
  const collectedAmount = (raw.paymentReceipts || []).reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0);
  const requestedAmount = Number(raw.requestedAmount ?? 0);

  return {
    id: raw.id,
    requestType: raw.requestType,
    requestedAmount,
    collectedAmount,
    remainingAmount: Math.max(0, requestedAmount - collectedAmount),
    status: raw.status,
    notes: raw.notes || '',
    admissionId: admission.id || '',
    admissionNumber: admission.admissionNumber || '',
    patientName: patient?.fullName || 'Unknown',
    patientPhone: patient?.phone || '',
    patientMrNumber: isPanel ? patient?.mrNumber || '' : '',
    payerType: isPanel ? 'Corporate / Panel' : 'Self Pay',
    departmentName: admission.department?.name || '',
    doctorName: admission.doctor?.fullName || '',
    requestedByLabel: raw.requestedBy?.displayName || raw.requestedBy?.username || '',
    requestedAt: formatTs(raw.requestedAt),
  };
}


export async function fetchPaymentRequests(status?: PaymentRequestStatus): Promise<PaymentRequestRecord[]> {
  try {
    const res = await apiClient.get<{ data: Record<string, any>[] }>('/admission-payment-requests', {
      params: status ? { status } : undefined,
    });
    return res.data.data.map(toPaymentRequestRecord);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export async function collectPaymentRequest(
  id: string,
  values: { amount: number; paymentMethod: PaymentMethod; reference?: string },
): Promise<PaymentRequestRecord> {
  try {
    const res = await apiClient.post<{ data: { request: Record<string, any> } }>(`/admission-payment-requests/${id}/collect`, values);
    return toPaymentRequestRecord(res.data.data.request);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}
