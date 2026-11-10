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

// ── Petty Cash Issuance & Custody Oversight ─────────────────────────────

/** Every cash-handling user's live custody position — `GET /cash/finance-control/balance-sheets`. */
export interface CashCustodySheet {
  portalUserId: string;
  user: FinanceUserSummary;
  physicalCashInHand: number;
  pettyCashIssued: number;
  cashExpenses: number;
  carriedForwardAmount: number;
  totalCollections: number;
  totalRefunds: number;
  unsettledCount: number;
}

function toCustodySheet(raw: Record<string, any>): CashCustodySheet {
  return {
    portalUserId: raw.portalUserId,
    user: toUserSummary(raw.user),
    physicalCashInHand: Number(raw.expectedPhysicalCash ?? 0),
    pettyCashIssued: Number(raw.pettyCashIssued ?? 0),
    cashExpenses: Number(raw.cashExpenses ?? 0),
    carriedForwardAmount: Number(raw.carriedForwardAmount ?? 0),
    totalCollections: Number(raw.totalCollections ?? 0),
    totalRefunds: Number(raw.totalRefunds ?? 0),
    unsettledCount: Number(raw.unsettledCount ?? 0),
  };
}

/** `preset: 'all'` (default) — full live custody picture, not one day's slice. */
export async function fetchCashCustodyOverview(range: DateRangeParams = { preset: 'all' }): Promise<{ period: { label: string; start: string | null; end: string | null }; sheets: CashCustodySheet[] }> {
  try {
    const res = await apiClient.get<{ data: { period: any; sheets: any[] } }>('/cash/finance-control/balance-sheets', {
      params: dateParams(range),
    });
    return { period: res.data.data.period, sheets: (res.data.data.sheets || []).map(toCustodySheet) };
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

/** Staff a Super Admin may issue petty cash to — Inventory Store Managers / Front Desk Cashiers only. */
export async function fetchIssuablePettyCashUsers(): Promise<FinanceUserSummary[]> {
  try {
    const res = await apiClient.get<{ data: Record<string, any>[] }>('/cash/finance-control/issuable-users');
    return (res.data.data || []).map(toUserSummary);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export type PettyCashIssueType = 'OPENING_FLOAT' | 'TOP_UP';

export interface IssuePettyCashPayload {
  portalUserId: string;
  amount: number;
  issueType: PettyCashIssueType;
  note: string;
}

export async function issuePettyCash(payload: IssuePettyCashPayload): Promise<void> {
  try {
    await apiClient.post('/cash/finance-control/petty-cash', payload);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

// ── Main Cash Fund (hospital's central physical cash reserve) ──────────
//
// This is the "source" account petty cash is issued FROM — issuing petty
// cash debits this fund and credits the recipient's own `UserCashBalance`
// in the same backend transaction (`financeControl.service.ts`'s
// `issuePettyCash`), so the two ledgers always move together.

export interface MainFundSummary {
  currentBalance: number;
  totalDeposited: number;
  totalIssued: number;
  totalWithdrawn: number;
}

export async function fetchMainFundSummary(): Promise<MainFundSummary> {
  try {
    const res = await apiClient.get<{ data: Record<string, any> }>('/cash/main-fund/summary');
    const d = res.data.data;
    return {
      currentBalance: Number(d.currentBalance ?? 0),
      totalDeposited: Number(d.totalDeposited ?? 0),
      totalIssued: Number(d.totalIssued ?? 0),
      totalWithdrawn: Number(d.totalWithdrawn ?? 0),
    };
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export type MainFundEntryType = 'DEPOSIT' | 'WITHDRAWAL' | 'PETTY_CASH_ISSUE' | 'SETTLEMENT_RETURN';

export interface MainFundEntry {
  id: string;
  direction: 'IN' | 'OUT';
  amount: number;
  type: MainFundEntryType;
  note: string;
  performedByUser: FinanceUserSummary;
  occurredAt: string;
}

function toMainFundEntry(raw: Record<string, any>): MainFundEntry {
  return {
    id: raw.id,
    direction: raw.direction,
    amount: Number(raw.amount ?? 0),
    type: raw.type,
    note: raw.note || '',
    performedByUser: toUserSummary(raw.performedByUser),
    occurredAt: formatDateTimeDDMMYYYY(raw.occurredAt),
  };
}

export async function fetchMainFundEntries(
  range: { preset: DatePreset; fromDate?: string; toDate?: string },
  type?: MainFundEntryType,
): Promise<{ periodLabel: string; rows: MainFundEntry[] }> {
  try {
    const res = await apiClient.get<{ data: { period: any; entries: any[] } }>('/cash/main-fund/entries', {
      params: { ...dateParams(range), ...(type ? { type } : {}) },
    });
    return { periodLabel: res.data.data.period.label, rows: (res.data.data.entries || []).map(toMainFundEntry) };
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export interface MainFundTransactionPayload {
  amount: number;
  note: string;
}

export async function depositMainFund(payload: MainFundTransactionPayload): Promise<void> {
  try {
    await apiClient.post('/cash/main-fund/deposit', payload);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export async function withdrawMainFund(payload: MainFundTransactionPayload): Promise<void> {
  try {
    await apiClient.post('/cash/main-fund/withdraw', payload);
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}
