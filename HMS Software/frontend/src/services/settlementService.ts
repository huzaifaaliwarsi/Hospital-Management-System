import apiClient from './apiClient';
import { toErrorMessage } from '../utils/apiErrors';
import { formatDateTimeDDMMYYYY } from '../utils/formatters';

/**
 * My Account Settlement — backed by `/api/v1/cash/settlements*`
 * (HMS_V7.2_NEW_REQUIREMENTS.md §3.3). Closes out every currently-unsettled
 * `UserCashBalance` row (the same ones `My Balance Sheet` shows) into one
 * settlement record.
 */

export type SettlementStatus = 'PREPARED' | 'SUBMITTED' | 'ACCEPTED' | 'PARTIALLY_ACCEPTED' | 'RETURNED' | 'REJECTED' | 'REVERSED';

export interface SettlementRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  expectedCash: number;
  physicalCash: number;
  variance: number;
  varianceReason: string;
  handoverAmount: number | null;
  /** Guide §5.1 — a shortfall from THIS settlement still owed; folds into the next settlement's expected cash. */
  carryForwardAmount: number;
  status: SettlementStatus;
  submittedAt: string;
  remarks: string;
  createdAt: string;
  receiverUser?: {
    id: string;
    username: string;
    displayName: string | null;
    role: string;
  } | null;
}

export interface EligibleReceiver {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
}

function formatTs(iso?: string | null): string {
  if (!iso) return '';
  return formatDateTimeDDMMYYYY(iso);
}

function toSettlementRecord(raw: Record<string, any>): SettlementRecord {
  return {
    id: raw.id,
    periodStart: formatTs(raw.periodStart),
    periodEnd: formatTs(raw.periodEnd),
    expectedCash: Number(raw.expectedCash ?? 0),
    physicalCash: Number(raw.physicalCash ?? 0),
    variance: Number(raw.variance ?? 0),
    varianceReason: raw.varianceReason || '',
    handoverAmount: raw.handoverAmount != null ? Number(raw.handoverAmount) : null,
    carryForwardAmount: Number(raw.carryForwardAmount ?? 0),
    status: raw.status,
    submittedAt: formatTs(raw.submittedAt),
    remarks: raw.remarks || '',
    createdAt: formatTs(raw.createdAt),
    receiverUser: raw.receiverUser ?? null,
  };
}

export async function fetchEligibleReceivers(): Promise<EligibleReceiver[]> {
  try {
    const res = await apiClient.get<{ data: EligibleReceiver[] }>('/cash/eligible-receivers');
    return res.data.data;
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export async function fetchMySettlements(filters?: { preset?: string; fromDate?: string; toDate?: string; status?: string }): Promise<SettlementRecord[]> {
  try {
    const res = await apiClient.get<{ data: Record<string, any>[] }>('/cash/settlements', { params: filters });
    return res.data.data.map(toSettlementRecord);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export async function submitSettlement(values: {
  physicalCash: number;
  varianceReason?: string;
  handoverAmount?: number;
  remarks?: string;
  receiverUserId?: string;
}): Promise<SettlementRecord> {
  try {
    const res = await apiClient.post<{ data: Record<string, any> }>('/cash/settlements', values);
    return toSettlementRecord(res.data.data);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}
