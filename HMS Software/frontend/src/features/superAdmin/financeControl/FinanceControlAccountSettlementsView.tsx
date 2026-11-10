import React, { useState } from 'react';
import { CheckSquare, Loader2, Eye, RotateCcw, CheckCircle2, XCircle, Undo2, AlertTriangle } from 'lucide-react';
import { Textarea } from '../../../components/forms/FormControls';
import { Modal } from '../../../components/common/Modal';
import { GenericReportView } from '../../../components/reports/GenericReportView';
import { useReportFilters, useFilterOptions, FilterSelect, opts } from '../../../components/reports/reportFilters';
import { useToast } from '../../../context/ToastContext';
import { formatPKR, formatAmount } from '../../../utils/formatters';
import {
  fetchAllSettlements,
  reviewSettlement,
  reverseSettlement,
  DatePreset,
  FinanceSettlementRecord,
  ReviewAction,
} from '../../../services/financeControlService';
import { fetchManagementFilterOptions, EMPTY_MANAGEMENT_OPTIONS } from '../../../services/managementReportsService';
import type { SettlementStatus } from '../../../services/settlementService';

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

const STATUS_FILTER = opts(
  ['SUBMITTED', 'Pending Review'],
  ['ACCEPTED', 'Settled & Verified'],
  ['PARTIALLY_ACCEPTED', 'Partially Settled'],
  ['RETURNED', 'Returned'],
  ['REJECTED', 'Rejected'],
  ['REVERSED', 'Reversed'],
);

/** Money column: currency in the header so every amount fits on screen. */
const money = (header: string, pick: (r: FinanceSettlementRecord) => number) => ({
  header: `${header} (PKR)`,
  align: 'right' as const,
  cell: (r: FinanceSettlementRecord) => formatAmount(pick(r)),
  excelValue: (r: FinanceSettlementRecord) => pick(r),
});

/**
 * Finance Control — Account Settlements (Admin / Super Admin).
 * Same filter-row + table layout as the Front Desk settlement history, over
 * every cashier's submissions. Review (accept / partially accept / return /
 * reject) and reversal happen here. Defaults to All Time so a settlement
 * awaiting review is never hidden by the period.
 */
export const FinanceControlAccountSettlementsView: React.FC = () => {
  const toast = useToast();
  const { cashUsers } = useFilterOptions(fetchManagementFilterOptions, EMPTY_MANAGEMENT_OPTIONS);
  const { filters, bind, reset } = useReportFilters({ portalUserId: '', status: '' });
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => setRefreshKey((k) => k + 1);

  const [reviewTarget, setReviewTarget] = useState<FinanceSettlementRecord | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewActionInFlight, setReviewActionInFlight] = useState<ReviewAction | null>(null);

  const [reverseTarget, setReverseTarget] = useState<FinanceSettlementRecord | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

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
      toast.success(action === 'ACCEPT' ? 'Settlement accepted and marked as settled.' : 'Settlement review updated.');
      closeReview();
      reload();
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
      reload();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reverse settlement.');
    } finally {
      setIsReversing(false);
    }
  };

  const renderAction = (s: FinanceSettlementRecord) => {
    if (s.status === 'SUBMITTED') {
      return (
        <button
          type="button"
          onClick={() => setReviewTarget(s)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded shadow-xs transition-colors cursor-pointer"
        >
          <CheckSquare className="h-3.5 w-3.5" /> Review
        </button>
      );
    }
    return (
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => setReviewTarget(s)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-[#effaf5] border border-slate-200 rounded transition-colors cursor-pointer"
        >
          <Eye className="h-3.5 w-3.5" /> View
        </button>
        {(s.status === 'ACCEPTED' || s.status === 'PARTIALLY_ACCEPTED') && (
          <button
            type="button"
            onClick={() => setReverseTarget(s)}
            className="p-1 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            title="Reverse this settlement"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <GenericReportView<FinanceSettlementRecord>
        key={refreshKey}
        title="Account Settlements"
        subtitle="Every cashier's submitted settlements — review, accept, return or reverse. Card / online payments are never counted as drawer cash."
        icon={CheckSquare}
        filenamePrefix="Account_Settlements"
        compact
        allTimeOption
        fetchReport={async (range) => {
          const result = await fetchAllSettlements(
            { preset: range.preset as DatePreset, fromDate: range.fromDate, toDate: range.toDate },
            {
              portalUserId: filters.portalUserId || undefined,
              status: (filters.status || undefined) as SettlementStatus | undefined,
            },
          );
          return { periodLabel: result.period.label, rows: result.settlements };
        }}
        onResetExtraFilters={reset}
        extraFilters={
          <>
            <FilterSelect label="User" options={cashUsers} {...bind('portalUserId')} />
            <FilterSelect label="Status" options={STATUS_FILTER} {...bind('status')} />
          </>
        }
        rowKey={(r) => r.id}
        noTotalColumns={['Carried Forward (PKR)']}
        emptyMessage="No settlements match these filters."
        columns={[
          { header: 'Submitted At', cell: (r) => r.submittedAt },
          { header: 'Cashier', cell: (r) => r.submittedByUser.fullName },
          { header: 'Shift Period', cell: (r) => `${r.periodStart} → ${r.periodEnd}` },
          money('Expected Cash', (r) => r.expectedCash),
          money('Counted Cash', (r) => r.physicalCash),
          money('Difference', (r) => r.variance),
          money('Carried Forward', (r) => r.carryForwardAmount),
          { header: 'Reason', cell: (r) => r.varianceReason || '—' },
          { header: 'Status', cell: (r) => STATUS_LABEL[r.status] || r.status },
          {
            header: 'Reviewed By',
            cell: (r) => (r.reversedByUser ? `Reversed by ${r.reversedByUser.fullName}` : r.reviewedByUser?.fullName || '—'),
          },
          { header: 'Actions', cell: () => '' },
        ]}
        renderCell={(col, row) => {
          if (col.header === 'Actions') return renderAction(row);
          if (col.header === 'Status') {
            return (
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${STATUS_BADGE[row.status] || ''}`}>
                {STATUS_LABEL[row.status] || row.status}
              </span>
            );
          }
          return col.cell(row);
        }}
      />

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Expected System Cash</span>
                <span className="text-lg font-bold text-slate-900 font-mono">{formatPKR(reviewTarget.expectedCash)}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Recorded collections</span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Physical Cash Counted</span>
                <span className="text-lg font-bold text-slate-900 font-mono">{formatPKR(reviewTarget.physicalCash)}</span>
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
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider block">Reconciliation Variance</span>
                <span
                  className={`text-lg font-bold font-mono ${
                    reviewTarget.variance === 0 ? 'text-emerald-800' : reviewTarget.variance > 0 ? 'text-amber-800' : 'text-rose-800'
                  }`}
                >
                  {reviewTarget.variance > 0 ? `+${formatPKR(reviewTarget.variance)}` : formatPKR(reviewTarget.variance)}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  {reviewTarget.variance === 0 ? 'Perfect match' : reviewTarget.variance > 0 ? 'Surplus excess' : 'Shortfall deficit'}
                </span>
              </div>
            </div>

            {reviewTarget.carryForwardAmount > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Shortfall Carry-Forward:</strong> The deficit of{' '}
                  <strong className="font-mono">{formatPKR(reviewTarget.carryForwardAmount)}</strong> will carry forward and appear on{' '}
                  {reviewTarget.submittedByUser.fullName}'s next shift settlement as a pending liability.
                </div>
              </div>
            )}

            {reviewTarget.varianceReason && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                <strong className="block mb-1 text-[11px] uppercase tracking-wider text-amber-800">Cashier's Stated Variance Reason:</strong>
                <p className="text-slate-800 italic bg-white/70 p-2 rounded-lg border border-amber-200/60">"{reviewTarget.varianceReason}"</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[11px]">Handover Amount:</span>
                <span className="font-mono font-bold text-slate-900">
                  {reviewTarget.handoverAmount != null ? formatPKR(reviewTarget.handoverAmount) : '— None specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Cashier Shift Remarks:</span>
                <span className="text-slate-800 font-medium">{reviewTarget.remarks || '— No remarks provided'}</span>
              </div>
            </div>

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
                    {reviewActionInFlight === 'ACCEPT' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>Accept &amp; Verify Settle</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${STATUS_BADGE[reviewTarget.status]}`}>
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
              Cashier: <strong className="text-slate-900">{reverseTarget.submittedByUser.fullName}</strong> · Physical cash:{' '}
              <strong className="font-mono">{formatPKR(reverseTarget.physicalCash)}</strong>
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
    </>
  );
};
