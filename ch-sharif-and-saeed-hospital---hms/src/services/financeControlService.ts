import apiClient from './apiClient';
import { toErrorMessage } from '../utils/apiErrors';
import { formatDateTimeDDMMYYYY } from '../utils/formatters';
import type { SettlementStatus } from './settlementService';

/**
 * Admin / Super Admin "Finance Control" oversight — backed by
 * `/api/v1/cash/finance-control/*` (`hms-backend/src/modules/cash/financeControl.*`).
 * Balance Sheet & Account Settlement Guide §6. Reads across every
 * cash-handling user, unlike `settlementService.ts` / `frontdeskApiService`
 * which are always scoped to the logged-in user.
 */

export type DatePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export interface DateRangeParams {
  preset: DatePreset;
  fromDate?: string;
  toDate?: string;
}

export interface FinanceUserSummary {
  id: string;
  fullName: string;
  username: string;
  role: string;
}

export interface FinanceSettlementRecord {
  id: string;
  portalUserId: string;
  submittedByUser: FinanceUserSummary;
  reviewedByUser: FinanceUserSummary | null;
  reversedByUser: FinanceUserSummary | null;
  periodStart: string;
  periodEnd: string;
  expectedCash: number;
  physicalCash: number;
  variance: number;
  varianceReason: string;
  handoverAmount: number | null;
  carryForwardAmount: number;
  status: SettlementStatus;
  submittedAt: string;
  reviewedAt: string;
  remarks: string;
  reversalReason: string;
  reversedAt: string;
  createdAt: string;
}

export interface SettlementsResult {
  period: { label: string; start: string; end: string };
  settlements: FinanceSettlementRecord[];
}

function toUserSummary(raw: Record<string, any> | null | undefined): FinanceUserSummary {
  if (!raw) return { id: '', fullName: 'Staff User', username: 'staff', role: 'FRONT_DESK_BILLING' };
  return { id: raw.id || '', fullName: raw.displayName || raw.username || 'Staff User', username: raw.username || 'staff', role: raw.role || 'FRONT_DESK_BILLING' };
}

function toSettlementRecord(raw: Record<string, any>): FinanceSettlementRecord {
  return {
    id: raw.id,
    portalUserId: raw.portalUserId,
    submittedByUser: toUserSummary(raw.submittedByUser) as FinanceUserSummary,
    reviewedByUser: toUserSummary(raw.reviewedByUser),
    reversedByUser: toUserSummary(raw.reversedByUser),
    periodStart: formatDateTimeDDMMYYYY(raw.periodStart),
    periodEnd: formatDateTimeDDMMYYYY(raw.periodEnd),
    expectedCash: Number(raw.expectedCash ?? 0),
    physicalCash: Number(raw.physicalCash ?? 0),
    variance: Number(raw.variance ?? 0),
    varianceReason: raw.varianceReason || '',
    handoverAmount: raw.handoverAmount != null ? Number(raw.handoverAmount) : null,
    carryForwardAmount: Number(raw.carryForwardAmount ?? 0),
    status: raw.status,
    submittedAt: formatDateTimeDDMMYYYY(raw.submittedAt),
    reviewedAt: formatDateTimeDDMMYYYY(raw.reviewedAt),
    remarks: raw.remarks || '',
    reversalReason: raw.reversalReason || '',
    reversedAt: formatDateTimeDDMMYYYY(raw.reversedAt),
    createdAt: formatDateTimeDDMMYYYY(raw.createdAt),
  };
}

function dateParams(range: DateRangeParams) {
  return {
    preset: range.preset,
    ...(range.preset === 'custom' && range.fromDate ? { fromDate: range.fromDate } : {}),
    ...(range.preset === 'custom' && range.toDate ? { toDate: range.toDate } : {}),
  };
}

/** Same shape as the cashier's own `GET /cash/balance-sheet`; no `range` = current shift (unsettled). */
export async function fetchUserBalanceSheetDetail(portalUserId: string, range?: { preset: string; fromDate?: string; toDate?: string }) {
  try {
    const res = await apiClient.get<{ data: any }>(`/cash/balance-sheet/${portalUserId}`, { params: range });
    return res.data.data;
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export async function fetchAllSettlements(
  range: DateRangeParams,
  filters?: { status?: SettlementStatus; portalUserId?: string },
): Promise<SettlementsResult> {
  try {
    const res = await apiClient.get<{ data: Record<string, any> }>('/cash/finance-control/settlements', {
      params: { ...dateParams(range), ...(filters?.status ? { status: filters.status } : {}), ...(filters?.portalUserId ? { portalUserId: filters.portalUserId } : {}) },
    });
    return {
      period: res.data.data.period,
      settlements: (res.data.data.settlements || []).map(toSettlementRecord),
    };
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export type ReviewAction = 'ACCEPT' | 'PARTIALLY_ACCEPT' | 'RETURN' | 'REJECT';

export async function reviewSettlement(id: string, action: ReviewAction, remarks?: string): Promise<FinanceSettlementRecord> {
  try {
    const res = await apiClient.post<{ data: Record<string, any> }>(`/cash/finance-control/settlements/${id}/review`, { action, remarks });
    return toSettlementRecord(res.data.data);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export async function reverseSettlement(id: string, reason: string): Promise<FinanceSettlementRecord> {
  try {
    const res = await apiClient.post<{ data: Record<string, any> }>(`/cash/finance-control/settlements/${id}/reverse`, { reason });
    return toSettlementRecord(res.data.data);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}
