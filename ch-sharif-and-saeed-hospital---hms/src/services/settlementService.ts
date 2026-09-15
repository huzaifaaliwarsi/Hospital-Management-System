import apiClient from './apiClient';

/**
 * My Account Settlement — backed by `/api/v1/cash/settlements*`
 * (HMS_V7.2_NEW_REQUIREMENTS.md §3.3). Closes out every currently-unsettled
 * `UserCashBalance` row (the same ones `My Balance Sheet` shows) into one
 * settlement record.
 */

export type SettlementStatus = 'PREPARED' | 'SUBMITTED' | 'ACCEPTED' | 'PARTIALLY_ACCEPTED' | 'RETURNED' | 'REJECTED';

export interface SettlementRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  expectedCash: number;
  physicalCash: number;
  variance: number;
  varianceReason: string;
  handoverAmount: number | null;
  status: SettlementStatus;
  submittedAt: string;
  remarks: string;
  createdAt: string;
}

function formatTs(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
    status: raw.status,
    submittedAt: formatTs(raw.submittedAt),
    remarks: raw.remarks || '',
    createdAt: formatTs(raw.createdAt),
  };
}

function toErrorMessage(err: any): string {
  return err?.response?.data?.error?.message || err?.message || 'Something went wrong. Please try again.';
}

export async function fetchMySettlements(): Promise<SettlementRecord[]> {
  try {
    const res = await apiClient.get<{ data: Record<string, any>[] }>('/cash/settlements');
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
}): Promise<SettlementRecord> {
  try {
    const res = await apiClient.post<{ data: Record<string, any> }>('/cash/settlements', values);
    return toSettlementRecord(res.data.data);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}
