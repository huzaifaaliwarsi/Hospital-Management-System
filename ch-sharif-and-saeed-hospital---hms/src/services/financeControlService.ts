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

export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

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

export interface UserBalanceSheetRow {
  portalUserId: string;
  user: FinanceUserSummary;
  /** Guide §5.1 — carried forward from this user's last settlement shortfall, already folded into `expectedPhysicalCash`. */
  carriedForwardAmount: number;
  expectedPhysicalCash: number;
  nonPhysicalTotal: number;
  totalCollections: number;
  totalRefunds: number;
  settledCount: number;
  unsettledCount: number;
}

export interface BalanceSheetsResult {
  period: { label: string; start: string; end: string };
  sheets: UserBalanceSheetRow[];
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

export interface FinanceKpis {
  period: { label: string; start: string; end: string };
  totalCashCollectedToday: number;
  totalNonCashCollectedToday: number;
  collectionsByMethod: Record<string, number>;
  totalRefundsToday: number;
  totalExpectedCash: number;
  totalSettledCash: number;
  totalUnsettledCash: number;
  usersPendingSettlementCount: number;
  settlementDifferencesCount: number;
  settlementsCompletedTodayCount: number;
}

function toUserSummary(raw: Record<string, any> | null | undefined): FinanceUserSummary {
  if (!raw) return { id: '', fullName: 'Staff User', username: 'staff', role: 'FRONT_DESK_BILLING' };
  return { id: raw.id || '', fullName: raw.displayName || raw.username || 'Staff User', username: raw.username || 'staff', role: raw.role || 'FRONT_DESK_BILLING' };
}

function toBalanceSheetRow(raw: Record<string, any>): UserBalanceSheetRow {
  return {
    portalUserId: raw.portalUserId,
    user: toUserSummary(raw.user) as FinanceUserSummary,
    carriedForwardAmount: Number(raw.carriedForwardAmount ?? 0),
    expectedPhysicalCash: Number(raw.expectedPhysicalCash ?? 0),
    nonPhysicalTotal: Number(raw.nonPhysicalTotal ?? 0),
    totalCollections: Number(raw.totalCollections ?? 0),
    totalRefunds: Number(raw.totalRefunds ?? 0),
    settledCount: Number(raw.settledCount ?? 0),
    unsettledCount: Number(raw.unsettledCount ?? 0),
  };
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

export async function fetchBalanceSheets(range: DateRangeParams, onlyUnsettled?: boolean): Promise<BalanceSheetsResult> {
  try {
    const res = await apiClient.get<{ data: Record<string, any> }>('/cash/finance-control/balance-sheets', {
      params: { ...dateParams(range), ...(onlyUnsettled ? { onlyUnsettled: true } : {}) },
    });
    return {
      period: res.data.data.period,
      sheets: (res.data.data.sheets || []).map(toBalanceSheetRow),
    };
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export async function fetchUserBalanceSheetDetail(portalUserId: string) {
  try {
    const res = await apiClient.get<{ data: any }>(`/cash/balance-sheet/${portalUserId}`);
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

export async function fetchFinanceKpis(range: DateRangeParams): Promise<FinanceKpis> {
  try {
    const res = await apiClient.get<{ data: Record<string, any> }>('/cash/finance-control/kpis', { params: dateParams(range) });
    const d = res.data.data;
    return {
      period: d.period,
      totalCashCollectedToday: Number(d.totalCashCollectedToday ?? 0),
      totalNonCashCollectedToday: Number(d.totalNonCashCollectedToday ?? 0),
      collectionsByMethod: Object.fromEntries(Object.entries(d.collectionsByMethod || {}).map(([k, v]) => [k, Number(v ?? 0)])),
      totalRefundsToday: Number(d.totalRefundsToday ?? 0),
      totalExpectedCash: Number(d.totalExpectedCash ?? 0),
      totalSettledCash: Number(d.totalSettledCash ?? 0),
      totalUnsettledCash: Number(d.totalUnsettledCash ?? 0),
      usersPendingSettlementCount: Number(d.usersPendingSettlementCount ?? 0),
      settlementDifferencesCount: Number(d.settlementDifferencesCount ?? 0),
      settlementsCompletedTodayCount: Number(d.settlementsCompletedTodayCount ?? 0),
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
