import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CheckSquare,
  Loader2,
  AlertCircle,
  Eye,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Undo2,
  Clock,
  History as HistoryIcon,
  ShieldCheck,
  Calendar,
  Banknote,
  Wallet,
  AlertTriangle,
  User,
  ArrowRight,
} from 'lucide-react';
import { Textarea } from '../../../components/forms/FormControls';
import { Modal } from '../../../components/common/Modal';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { formatPKR } from '../../../utils/formatters';
import {
  downloadTablePDF,
  downloadTableExcel,
  downloadTableCSV,
  printTable,
  ExportColumn,
} from '../../../services/tableExportService';
import {
  fetchAllSettlements,
  fetchFinanceKpis,
  reviewSettlement,
  reverseSettlement,
  DatePreset,
  FinanceSettlementRecord,
  FinanceKpis,
  ReviewAction,
} from '../../../services/financeControlService';
import type { SettlementStatus } from '../../../services/settlementService';
import { FinanceDateFilterBar, todayISO } from './FinanceDateFilterBar';
import { FinanceKpiStrip } from './FinanceKpiStrip';
import { ExportButtonGroup } from './ExportButtonGroup';

const STATUS_BADGE: Record<SettlementStatus, string> = {
  PREPARED: 'bg-slate-100 text-slate-700 border-slate-200',
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIALLY_ACCEPTED: 'bg-amber-50 text-amber-700 border-amber-200',
  RETURNED: 'bg-orange-50 text-orange-700 border-orange-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  REVERSED: 'bg-slate-100 text-slate-700 border-slate-300',
};

const STATUS_LABEL: Record<SettlementStatus, string> = {
  PREPARED: 'Prepared',
  SUBMITTED: 'Pending Review',
  ACCEPTED: 'Settled & Verified',
  PARTIALLY_ACCEPTED: 'Partially Settled',
  RETURNED: 'Returned',
  REJECTED: 'Rejected',
  REVERSED: 'Reversed',
};

const EXPORT_COLUMNS: ExportColumn<FinanceSettlementRecord>[] = [
  { header: 'Submitted', cell: (r) => r.submittedAt },
  { header: 'User', cell: (r) => r.submittedByUser.fullName },
  { header: 'Username', cell: (r) => `@${r.submittedByUser.username}` },
  { header: 'Expected Cash', align: 'right', cell: (r) => formatPKR(r.expectedCash), excelValue: (r) => r.expectedCash },
  { header: 'Physical Cash', align: 'right', cell: (r) => formatPKR(r.physicalCash), excelValue: (r) => r.physicalCash },
  { header: 'Variance', align: 'right', cell: (r) => formatPKR(r.variance), excelValue: (r) => r.variance },
  { header: 'Carried Forward', align: 'right', cell: (r) => formatPKR(r.carryForwardAmount), excelValue: (r) => r.carryForwardAmount },
  { header: 'Status', cell: (r) => STATUS_LABEL[r.status] },
  { header: 'Reviewed / Reversed By', cell: (r) => r.reversedByUser?.fullName || r.reviewedByUser?.fullName || '—' },
];

type Tab = 'ALL' | 'PENDING' | 'HISTORY' | 'DIFFERENCES';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'ALL', label: 'All Settlements', icon: CheckSquare },
  { key: 'PENDING', label: 'Pending Review', icon: Clock },
  { key: 'HISTORY', label: 'Settlement History', icon: HistoryIcon },
  { key: 'DIFFERENCES', label: 'Variance / Differences', icon: AlertCircle },
];

/**
 * Finance Control — Account Settlements
 * Admin / Super Admin's central register: review a submitted settlement,
 * verify cashier physical count against live database, or reverse a posted one.
 */
export const FinanceControlAccountSettlementsView: React.FC = () => {
  const toast = useToast();
  const { currentUser } = useAuth();
  const [preset, setPreset] = useState<DatePreset>('today');
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [tab, setTab] = useState<Tab>('PENDING');

  const [settlements, setSettlements] = useState<FinanceSettlementRecord[]>([]);
  const [periodLabel, setPeriodLabel] = useState('');
  const [kpis, setKpis] = useState<FinanceKpis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reviewTarget, setReviewTarget] = useState<FinanceSettlementRecord | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewActionInFlight, setReviewActionInFlight] = useState<ReviewAction | null>(null);

  const [reverseTarget, setReverseTarget] = useState<FinanceSettlementRecord | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const range = {
    preset,
    fromDate: preset === 'custom' ? fromDate : undefined,
    toDate: preset === 'custom' ? toDate : undefined,
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [result, kpiResult] = await Promise.all([
        fetchAllSettlements(range),
        fetchFinanceKpis(range),
      ]);
      setSettlements(result.settlements);
      setPeriodLabel(result.period.label);
      setKpis(kpiResult);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load settlements.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, preset === 'custom' ? fromDate : null, preset === 'custom' ? toDate : null]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleSettlements = useMemo(() => {
    switch (tab) {
      case 'PENDING':
        return settlements.filter((s) => s.status === 'SUBMITTED');
      case 'HISTORY':
        return settlements.filter((s) =>
          ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'REVERSED'].includes(s.status)
        );
      case 'DIFFERENCES':
        return settlements.filter((s) => s.variance !== 0);
      default:
        return settlements;
    }
  }, [settlements, tab]);

  const tabCounts: Record<Tab, number> = {
    ALL: settlements.length,
    PENDING: settlements.filter((s) => s.status === 'SUBMITTED').length,
    HISTORY: settlements.filter((s) =>
      ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'REVERSED'].includes(s.status)
    ).length,
    DIFFERENCES: settlements.filter((s) => s.variance !== 0).length,
  };

  const closeReview = () => {
    setReviewTarget(null);
    setReviewRemarks('');
    setReviewActionInFlight(null);
  };

  const handleReview = async (action: ReviewAction) => {
    if (!reviewTarget) return;
    if ((action === 'RETURN' || action === 'REJECT') && !reviewRemarks.trim()) {
      toast.error('Remarks are required when returning or rejecting a settlement.');
      return;
    }
    setReviewActionInFlight(action);
    try {
      await reviewSettlement(reviewTarget.id, action, reviewRemarks.trim() || undefined);
      toast.success(
        action === 'ACCEPT'
          ? 'Settlement accepted and marked as settled.'
          : 'Settlement review updated.'
      );
      closeReview();
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to review settlement.');
    } finally {
      setReviewActionInFlight(null);
    }
  };

  const handleReverse = async () => {
    if (!reverseTarget) return;
    if (!reverseReason.trim()) {
      toast.error('A reversal reason is required.');
      return;
    }
    setIsReversing(true);
    try {
      await reverseSettlement(reverseTarget.id, reverseReason.trim());
      toast.success('Settlement reversed — the underlying transactions are unsettled again.');
      setReverseTarget(null);
      setReverseReason('');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reverse settlement.');
    } finally {
      setIsReversing(false);
    }
  };

  const exportContext = {
    documentTitle: 'Account Settlements',
    documentSubtitle: `Finance Control — Central Settlement Register (${TABS.find((t) => t.key === tab)?.label})`,
    filenamePrefix: 'Account_Settlements',
    columns: EXPORT_COLUMNS,
    rows: visibleSettlements,
    currentUser,
    periodLabel,
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Hero Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-[#effaf5] border border-[#c2e7db] text-[#08775A] flex items-center justify-center shrink-0 shadow-xs">
            <CheckSquare className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Account Settlements</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#08775A] border border-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Financial Audit &amp; Control
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Central register of cashier shift submissions — review, verify, and reconcile physical cash custody.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <ExportButtonGroup
            disabled={visibleSettlements.length === 0}
            onPrint={() => printTable(exportContext)}
            onPdf={() => downloadTablePDF(exportContext)}
            onExcel={() => downloadTableExcel(exportContext)}
            onCsv={() => downloadTableCSV(exportContext)}
          />
        </div>
      </div>

      {/* Date Filter Bar */}
      <FinanceDateFilterBar
        preset={preset}
        onPresetChange={setPreset}
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onRefresh={load}
      />

      {loadError ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 flex flex-col items-center gap-3 text-center shadow-xs">
          <div className="h-10 w-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Failed to load settlements</h3>
            <p className="text-xs text-rose-600 mt-0.5">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="mt-1 px-4 py-1.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3 text-slate-500 shadow-xs">
          <Loader2 className="h-6 w-6 animate-spin text-[#08775A]" />
          <span className="text-xs font-medium">Loading settlement audit records…</span>
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          {kpis && <FinanceKpiStrip kpis={kpis} />}

          {/* Period context bar */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 -mt-2">
            <span className="font-medium text-slate-600 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#08775A]" />
              Showing records for: <strong className="text-slate-800">{periodLabel || 'Active Filter'}</strong>
            </span>
            <span className="text-slate-400 text-[11px]">
              Live data from cashier balance ledgers
            </span>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200/90 overflow-x-auto pb-px">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              const count = tabCounts[t.key];
              const isPending = t.key === 'PENDING' && count > 0;
              const isDiff = t.key === 'DIFFERENCES' && count > 0;

              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'border-[#08775A] text-[#08775A] bg-[#effaf5]/60 rounded-t-lg'
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-[#08775A]' : 'text-slate-400'}`} />
                  <span>{t.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      active
                        ? 'bg-[#08775A] text-white border-[#08775A]'
                        : isPending
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : isDiff
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[300px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-[#f1f5f9] shadow-2xs">
                  <tr className="border-b border-slate-300 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                    <th className="w-12 py-3 px-3 text-center border-r border-slate-300 font-bold text-slate-700">#</th>
                    <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Submission Time</th>
                    <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Cashier / Staff</th>
                    <th className="py-3 px-3.5 border-r border-slate-300 text-right whitespace-nowrap">Expected Cash</th>
                    <th className="py-3 px-3.5 border-r border-slate-300 text-right whitespace-nowrap">Physical Count</th>
                    <th className="py-3 px-3.5 border-r border-slate-300 text-right whitespace-nowrap">Variance</th>
                    <th className="py-3 px-3.5 border-r border-slate-300 text-center whitespace-nowrap">Status</th>
                    <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Audited / Reversed By</th>
                    <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {visibleSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-14 text-center text-slate-400">
                        <CheckSquare className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-medium text-slate-600">No settlements found in this view.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Try adjusting the period filter or selecting another tab.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    visibleSettlements.map((s, idx) => {
                      const userInitial = (s.submittedByUser?.fullName || 'U').charAt(0).toUpperCase();

                      return (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200 last:border-b-0">
                          {/* # Serial */}
                          <td className="py-3 px-3 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/50">
                            {idx + 1}
                          </td>

                          {/* Submission Time */}
                          <td className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap text-slate-700 font-medium">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span>{s.submittedAt}</span>
                            </div>
                            <span className="text-[10.5px] text-slate-400 block mt-0.5 font-mono">
                              {s.periodStart} → {s.periodEnd}
                            </span>
                          </td>

                          {/* Cashier / Staff */}
                          <td className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-[#effaf5] border border-[#c2e7db] text-[#08775A] font-bold text-xs flex items-center justify-center shrink-0">
                                {userInitial}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 leading-tight">
                                  {s.submittedByUser.fullName}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  @{s.submittedByUser.username}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Expected Cash */}
                          <td className="py-3 px-3.5 border-r border-slate-200 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatPKR(s.expectedCash)}
                          </td>

                          {/* Physical Cash */}
                          <td className="py-3 px-3.5 border-r border-slate-200 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                            {formatPKR(s.physicalCash)}
                          </td>

                          {/* Variance */}
                          <td className="py-3 px-3.5 border-r border-slate-200 text-right whitespace-nowrap">
                            {s.variance === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Balanced · PKR 0
                              </span>
                            ) : s.variance > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                +{formatPKR(s.variance)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                {formatPKR(s.variance)}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3.5 border-r border-slate-200 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                                STATUS_BADGE[s.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {STATUS_LABEL[s.status] || s.status}
                            </span>
                          </td>

                          {/* Audited / Reversed By */}
                          <td className="py-3 px-3.5 border-r border-slate-200 text-slate-600 whitespace-nowrap">
                            {s.reversedByUser ? (
                              <span className="text-rose-700 font-medium">Reversed by {s.reversedByUser.fullName}</span>
                            ) : s.reviewedByUser ? (
                              <span className="text-slate-800 font-medium">{s.reviewedByUser.fullName}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            {s.status === 'SUBMITTED' ? (
                              <button
                                type="button"
                                onClick={() => setReviewTarget(s)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded shadow-xs transition-colors cursor-pointer"
                              >
                                <CheckSquare className="h-3.5 w-3.5" />
                                <span>Review</span>
                              </button>
                            ) : s.status === 'ACCEPTED' || s.status === 'PARTIALLY_ACCEPTED' ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setReviewTarget(s)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded shadow-2xs transition-colors cursor-pointer"
                                  title="View details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReverseTarget(s)}
                                  className="inline-flex items-center gap-1 p-1 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Reverse this settlement"
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setReviewTarget(s)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-[#08775A] bg-slate-50 hover:bg-[#effaf5] border border-slate-200 hover:border-[#c2e7db] rounded-lg transition-colors cursor-pointer"
                                title="View detail"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Detail</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={!!reviewTarget}
        onClose={closeReview}
        title="Settlement Audit Review"
        subtitle={
          reviewTarget
            ? `Submitted by ${reviewTarget.submittedByUser.fullName} (@${reviewTarget.submittedByUser.username}) · Period: ${reviewTarget.periodStart} → ${reviewTarget.periodEnd}`
            : ''
        }
        maxWidth="lg"
      >
        {reviewTarget && (
          <div className="space-y-4 py-1">
            {/* 3 Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Expected System Cash
                </span>
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {formatPKR(reviewTarget.expectedCash)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Recorded collections</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Physical Cash Counted
                </span>
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {formatPKR(reviewTarget.physicalCash)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Declared by cashier</span>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  reviewTarget.variance === 0
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : reviewTarget.variance > 0
                    ? 'bg-amber-50/60 border-amber-200'
                    : 'bg-rose-50/60 border-rose-200'
                }`}
              >
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider block">
                  Reconciliation Variance
                </span>
                <span
                  className={`text-lg font-bold font-mono ${
                    reviewTarget.variance === 0
                      ? 'text-emerald-800'
                      : reviewTarget.variance > 0
                      ? 'text-amber-800'
                      : 'text-rose-800'
                  }`}
                >
                  {reviewTarget.variance > 0
                    ? `+${formatPKR(reviewTarget.variance)}`
                    : formatPKR(reviewTarget.variance)}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  {reviewTarget.variance === 0
                    ? 'Perfect match'
                    : reviewTarget.variance > 0
                    ? 'Surplus excess'
                    : 'Shortfall deficit'}
                </span>
              </div>
            </div>

            {/* Carry Forward Notice */}
            {reviewTarget.carryForwardAmount > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Shortfall Carry-Forward:</strong> The deficit of{' '}
                  <strong className="font-mono">{formatPKR(reviewTarget.carryForwardAmount)}</strong> will carry
                  forward and appear on {reviewTarget.submittedByUser.fullName}'s next shift settlement as a pending liability.
                </div>
              </div>
            )}

            {/* Variance Reason */}
            {reviewTarget.varianceReason && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                <strong className="block mb-1 text-[11px] uppercase tracking-wider text-amber-800">
                  Cashier's Stated Variance Reason:
                </strong>
                <p className="text-slate-800 italic bg-white/70 p-2 rounded-lg border border-amber-200/60">
                  "{reviewTarget.varianceReason}"
                </p>
              </div>
            )}

            {/* Handover & Remarks Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[11px]">Handover Amount:</span>
                <span className="font-mono font-bold text-slate-900">
                  {reviewTarget.handoverAmount != null ? formatPKR(reviewTarget.handoverAmount) : '— None specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Cashier Shift Remarks:</span>
                <span className="text-slate-800 font-medium">
                  {reviewTarget.remarks || '— No remarks provided'}
                </span>
              </div>
            </div>

            {/* Review Action Controls */}
            {reviewTarget.status === 'SUBMITTED' ? (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <Textarea
                  label="Audit Remarks (Mandatory for Return or Reject)"
                  rows={2}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="Enter audit notes or reason for returning/rejecting this settlement..."
                />

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!!reviewActionInFlight}
                    onClick={() => handleReview('REJECT')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Reject</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!reviewActionInFlight}
                    onClick={() => handleReview('RETURN')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Return for Recount</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!reviewActionInFlight}
                    onClick={() => handleReview('PARTIALLY_ACCEPT')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Partially Accept</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!reviewActionInFlight}
                    onClick={() => handleReview('ACCEPT')}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {reviewActionInFlight === 'ACCEPT' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    <span>Accept &amp; Verify Settle</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                    STATUS_BADGE[reviewTarget.status]
                  }`}
                >
                  {STATUS_LABEL[reviewTarget.status]}
                </span>
                <button
                  type="button"
                  onClick={closeReview}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reverse Modal */}
      <Modal
        isOpen={!!reverseTarget}
        onClose={() => !isReversing && setReverseTarget(null)}
        title="Reverse Settlement"
        subtitle="This flips the settlement to REVERSED and re-opens its underlying collections as unsettled back into cashier custody."
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setReverseTarget(null)}
              disabled={isReversing}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReverse}
              disabled={isReversing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isReversing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirm Reversal</span>
            </button>
          </div>
        }
      >
        {reverseTarget && (
          <div className="space-y-3 py-1">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              Cashier: <strong className="text-slate-900">{reverseTarget.submittedByUser.fullName}</strong> ·
              Physical cash: <strong className="font-mono">{formatPKR(reverseTarget.physicalCash)}</strong>
            </div>
            <Textarea
              label="Reversal Reason"
              required
              rows={3}
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              placeholder="Why is this settlement being reversed?"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
