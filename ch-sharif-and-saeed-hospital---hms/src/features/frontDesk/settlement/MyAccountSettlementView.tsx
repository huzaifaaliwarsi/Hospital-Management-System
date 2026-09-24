import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Wallet,
  ListChecks,
  Banknote,
  ArrowRight,
  RefreshCw,
  Receipt,
  AlertTriangle,
  History,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Coins,
  Check,
  FileText,
  Eye,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import { useRouter } from '../../../context/RouterContext';
import { useAuth } from '../../../context/AuthContext';
import { frontdeskApiService } from '../../../services/frontdeskApiService';
import { downloadTablePDF, downloadTableExcel, downloadTableCSV, printTable, ExportColumn } from '../../../services/tableExportService';
import { ExportButtonGroup } from '../../superAdmin/financeControl/ExportButtonGroup';
import {
  fetchMySettlements,
  submitSettlement,
  SettlementRecord,
  SettlementStatus,
} from '../../../services/settlementService';

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
  SUBMITTED: 'Awaiting Review',
  ACCEPTED: 'Settled & Verified',
  PARTIALLY_ACCEPTED: 'Partially Settled',
  RETURNED: 'Returned for Correction',
  REJECTED: 'Rejected',
  REVERSED: 'Reversed',
};

const COMMON_VARIANCE_REASONS = [
  'Change / coin shortage',
  'Patient rounding difference',
  'Unrecorded cash receipt pending entry',
  'Drawer counting discrepancy',
  'Emergency advance dispensation',
];

const SETTLEMENT_EXPORT_COLUMNS: ExportColumn<SettlementRecord>[] = [
  { header: 'Submitted At', cell: (s) => s.submittedAt },
  { header: 'Period Start', cell: (s) => s.periodStart },
  { header: 'Period End', cell: (s) => s.periodEnd },
  { header: 'Expected Cash', align: 'right', cell: (s) => formatPKR(s.expectedCash), excelValue: (s) => s.expectedCash },
  { header: 'Physical Count', align: 'right', cell: (s) => formatPKR(s.physicalCash), excelValue: (s) => s.physicalCash },
  { header: 'Variance', align: 'right', cell: (s) => formatPKR(s.variance), excelValue: (s) => s.variance },
  { header: 'Carried Forward', align: 'right', cell: (s) => formatPKR(s.carryForwardAmount), excelValue: (s) => s.carryForwardAmount },
  { header: 'Status', cell: (s) => STATUS_LABEL[s.status] || s.status },
];

/**
 * My Account Settlement — Front Desk shift reconciliation module.
 * Cashiers count physical cash, verify against live collections,
 * and submit shift closeout for finance approval.
 */
export const MyAccountSettlementView: React.FC = () => {
  const toast = useToast();
  const { navigate } = useRouter();
  const { currentUser } = useAuth();

  const [expectedCash, setExpectedCash] = useState(0);
  const [carriedForwardAmount, setCarriedForwardAmount] = useState(0);
  const [unsettledCount, setUnsettledCount] = useState(0);
  const [history, setHistory] = useState<SettlementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [physicalCash, setPhysicalCash] = useState<number | ''>('');
  const [varianceReason, setVarianceReason] = useState('');
  const [handoverAmount, setHandoverAmount] = useState<number | ''>('');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SettlementRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const load = async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const [balance, settlements] = await Promise.all([
        frontdeskApiService.getCashBalance(),
        fetchMySettlements(),
      ]);
      setExpectedCash(Number(balance.summary?.expectedPhysicalCash ?? 0));
      setCarriedForwardAmount(Number(balance.summary?.carriedForwardAmount ?? 0));
      setUnsettledCount(balance.summary?.unsettledCount ?? 0);
      setHistory(settlements);
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load settlement data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const variance = physicalCash === '' ? 0 : Number(physicalCash) - expectedCash;

  const validate = (): string | null => {
    if (physicalCash === '' || Number(physicalCash) < 0) {
      return 'Please enter the physical cash counted in your drawer.';
    }
    if (variance !== 0 && !varianceReason.trim()) {
      return `Physical cash does not match expected cash (${formatPKR(expectedCash)}). A variance explanation is mandatory.`;
    }
    return null;
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSaving(true);
    try {
      await submitSettlement({
        physicalCash: Number(physicalCash),
        varianceReason: varianceReason.trim() || undefined,
        handoverAmount: handoverAmount === '' ? undefined : Number(handoverAmount),
        remarks: remarks.trim() || undefined,
      });
      toast.success('Shift settlement submitted successfully for review.');
      setPhysicalCash('');
      setVarianceReason('');
      setHandoverAmount('');
      setRemarks('');
      setIsConfirmOpen(false);
      load(true);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit settlement.');
      setIsConfirmOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Hero Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-[#effaf5] border border-[#c2e7db] text-[#08775A] flex items-center justify-center shrink-0 shadow-xs">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Account Settlement</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#08775A] border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-[#08775A] animate-pulse" />
                Shift Reconciliation
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Verify your physical cash drawer against live system collections and submit shift closeout for finance verification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh live data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#08775A]' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/front-desk/my_balance_sheet')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#08775A] bg-[#effaf5] hover:bg-[#e0f5ec] border border-[#c2e7db] rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>View Balance Sheet</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 flex flex-col items-center gap-3 text-center shadow-xs">
          <div className="h-10 w-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Failed to load settlement details</h3>
            <p className="text-xs text-rose-600 mt-0.5">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="mt-1 px-4 py-1.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3 text-slate-500 shadow-xs">
          <Loader2 className="h-6 w-6 animate-spin text-[#08775A]" />
          <span className="text-xs font-medium">Loading live cashier drawer position…</span>
        </div>
      ) : (
        <>
          {/* Main Reconciliation Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Step 1: Live System Position */}
            <div className="p-5 sm:p-6 bg-slate-50/70 border-b border-slate-200/80">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#08775A] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    1
                  </span>
                  <div>
                    <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Live System Position
                    </h2>
                    <p className="text-[11px] text-slate-500">Unsettled collections currently recorded in your custody</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-xs">
                  Active Drawer Session
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Expected Cash */}
                <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-[#129b70]/40 transition-colors">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Expected Physical Cash</span>
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Banknote className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                    {formatPKR(expectedCash)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Cash collections awaiting drawer closing</p>
                </div>

                {/* Unsettled Transactions */}
                <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-[#129b70]/40 transition-colors">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Unsettled Entries</span>
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Receipt className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                    {unsettledCount}{' '}
                    <span className="text-xs font-semibold text-slate-500 font-sans">
                      {unsettledCount === 1 ? 'record' : 'records'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Invoices, walk-ins, &amp; receipts</p>
                </div>

                {/* Prior Deficit / Carried Forward */}
                <div className={`p-4 bg-white rounded-xl border shadow-2xs transition-colors ${carriedForwardAmount > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200/90'}`}>
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Prior Deficit (Carried Fwd)</span>
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${carriedForwardAmount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      <Coins className="h-4 w-4" />
                    </div>
                  </div>
                  <div className={`text-2xl font-bold font-mono tracking-tight ${carriedForwardAmount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                    {formatPKR(carriedForwardAmount)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {carriedForwardAmount > 0 ? 'Carried from previous shift shortage' : 'No prior shortfall on record'}
                  </p>
                </div>
              </div>

              {carriedForwardAmount > 0 && (
                <div className="mt-3.5 p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Prior Shift Shortfall:</span> The amount of{' '}
                    <strong className="font-mono">{formatPKR(carriedForwardAmount)}</strong> was carried forward from your previous settlement and is folded into your current expected cash.
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Count Drawer & Reconcile */}
            <form onSubmit={handleReviewSubmit} className="p-5 sm:p-6 space-y-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-[#08775A] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    2
                  </span>
                  <div>
                    <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Count Drawer &amp; Reconcile Cash
                    </h2>
                    <p className="text-[11px] text-slate-500">Enter the physical cash present in your register</p>
                  </div>
                </div>

                {/* Quick Auto-Match button */}
                {expectedCash > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhysicalCash(expectedCash);
                      setFormError(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#08775A] bg-[#effaf5] hover:bg-[#d8f3e5] border border-[#c2e7db] rounded-lg transition-colors cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#08775A]" />
                    <span>Auto-Match Expected ({formatPKR(expectedCash)})</span>
                  </button>
                )}
              </div>

              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-medium animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Physical Cash Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    Physical Cash Counted <span className="text-rose-500">*</span>
                  </label>
                  {physicalCash !== '' && (
                    <button
                      type="button"
                      onClick={() => setPhysicalCash('')}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 pointer-events-none flex items-center gap-1 font-bold text-slate-500 font-mono text-sm border-r border-slate-200 pr-2.5">
                    <span>PKR</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={physicalCash}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setPhysicalCash(val);
                      if (formError) setFormError(null);
                    }}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-20 pr-4 py-2.5 text-base sm:text-lg font-bold font-mono text-slate-900 placeholder:text-slate-300 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#129b70]/25 focus:border-[#129b70]"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Physically count all cash notes and coins in your drawer and enter the total amount.
                </p>
              </div>

              {/* Real-Time Dynamic Reconciliation Alert Banner */}
              {physicalCash === '' ? (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 text-xs text-slate-600">
                  <Wallet className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>Enter the counted cash above to perform live reconciliation against expected collections.</span>
                </div>
              ) : variance === 0 ? (
                <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-start gap-3 animate-in fade-in">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                        Drawer Balanced · Perfect Match
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800">
                        Variance: PKR 0
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Your physical cash count matches the expected system collections ({formatPKR(expectedCash)}) perfectly. No variance reason is required.
                    </p>
                  </div>
                </div>
              ) : variance < 0 ? (
                <div className="p-4 bg-rose-50/90 border border-rose-200 rounded-xl flex items-start gap-3 animate-in fade-in">
                  <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                        Cash Shortfall Detected
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-100 text-rose-800">
                        Deficit: -{formatPKR(Math.abs(variance))}
                      </span>
                    </div>
                    <p className="text-xs text-rose-800 mt-0.5">
                      Physical cash is <strong>{formatPKR(Math.abs(variance))}</strong> less than expected. You must specify a variance reason for financial audit. This deficit will carry forward to your next shift.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-3 animate-in fade-in">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                        Cash Surplus Detected
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-100 text-amber-800">
                        Surplus: +{formatPKR(variance)}
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Physical cash exceeds system collections by <strong>{formatPKR(variance)}</strong>. Please document the reason for the excess collection.
                    </p>
                  </div>
                </div>
              )}

              {/* Variance Reason Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    Variance Reason {variance !== 0 ? (
                      <span className="text-rose-500 font-bold">* Required</span>
                    ) : (
                      <span className="text-slate-400 font-normal text-[11px]">(Optional when drawer is balanced)</span>
                    )}
                  </label>
                </div>

                {variance !== 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pb-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Quick Reasons:</span>
                    {COMMON_VARIANCE_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setVarianceReason(reason)}
                        className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                          varianceReason === reason
                            ? 'bg-[#effaf5] text-[#08775A] border-[#c2e7db] font-semibold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  rows={2}
                  value={varianceReason}
                  onChange={(e) => {
                    setVarianceReason(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder={
                    variance !== 0
                      ? 'Explain the cause of variance (e.g. coin shortage, patient rounding, or pending late entry)...'
                      : 'No explanation required for balanced drawer'
                  }
                  className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#129b70]/25 focus:border-[#129b70] ${
                    variance !== 0 && !varianceReason.trim()
                      ? 'border-amber-300'
                      : 'border-slate-300'
                  }`}
                />
              </div>

              {/* Handover Amount & Remarks Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Handover Amount */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Handover Amount (optional)
                    </label>
                    {typeof physicalCash === 'number' && physicalCash > 0 && (
                      <button
                        type="button"
                        onClick={() => setHandoverAmount(physicalCash)}
                        className="text-[11px] font-semibold text-[#08775A] hover:underline cursor-pointer"
                      >
                        Handover Full ({formatPKR(physicalCash)})
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 pointer-events-none flex items-center text-xs font-bold text-slate-400 font-mono border-r border-slate-200 pr-2">
                      PKR
                    </div>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={handoverAmount}
                      onChange={(e) => setHandoverAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 bg-white pl-16 pr-3.5 py-2 text-xs font-mono font-medium text-slate-900 placeholder:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#129b70]/25 focus:border-[#129b70]"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Cash physically handed over to incoming cashier or supervisor.
                  </p>
                </div>

                {/* Remarks */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Remarks / Shift Notes (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional notes regarding this shift closeout..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#129b70]/25 focus:border-[#129b70]"
                  />
                </div>
              </div>

              {/* Form Action Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-[#08775A]" />
                  <span>Submissions are locked and audited by hospital finance</span>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] active:bg-[#054e39] rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <span>Review &amp; Submit Closeout</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Settlement History Section */}
          <div className="space-y-3">
            {/* Dark Theme Header Banner (matching reference UI) */}
            <div className="bg-gradient-to-r from-[#0a4636] to-[#08775A] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide text-white">
                <div className="h-6 w-6 rounded bg-white/15 text-white flex items-center justify-center">
                  <History className="h-3.5 w-3.5" />
                </div>
                <span>Accounts Settlement — History &amp; Shift Submissions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-100 font-medium bg-white/10 px-2.5 py-0.5 rounded-md">
                  {history.length} {history.length === 1 ? 'Record' : 'Records'}
                </span>
              </div>
            </div>

            {/* Export Toolbar */}
            {history.length > 0 && (
              <div className="flex items-center justify-end -mt-1">
                <ExportButtonGroup
                  disabled={history.length === 0}
                  onExcel={() =>
                    downloadTableExcel({
                      documentTitle: 'Accounts Settlement History',
                      filenamePrefix: 'Settlement_History',
                      columns: SETTLEMENT_EXPORT_COLUMNS,
                      rows: history,
                      currentUser,
                    })
                  }
                  onCsv={() =>
                    downloadTableCSV({
                      documentTitle: 'Accounts Settlement History',
                      filenamePrefix: 'Settlement_History',
                      columns: SETTLEMENT_EXPORT_COLUMNS,
                      rows: history,
                      currentUser,
                    })
                  }
                  onPdf={() =>
                    downloadTablePDF({
                      documentTitle: 'Accounts Settlement History',
                      filenamePrefix: 'Settlement_History',
                      columns: SETTLEMENT_EXPORT_COLUMNS,
                      rows: history,
                      currentUser,
                    })
                  }
                  onPrint={() =>
                    printTable({
                      documentTitle: 'Accounts Settlement History',
                      filenamePrefix: 'Settlement_History',
                      columns: SETTLEMENT_EXPORT_COLUMNS,
                      rows: history,
                      currentUser,
                    })
                  }
                />
              </div>
            )}

            {/* Table with proper bordered grid lines */}
            <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden">
              {history.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                  <FileText className="h-8 w-8 text-slate-300" />
                  <p className="text-xs font-medium text-slate-500">No shift settlements submitted yet.</p>
                  <p className="text-[11px] text-slate-400">Completed shift reconciliations will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f1f5f9] border-b border-slate-300 sticky top-0 z-10 text-slate-800 text-[11.5px] font-bold uppercase tracking-wider">
                        <th className="w-12 py-3 px-3 text-center border-r border-slate-300 font-bold text-slate-700">#</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Submitted At</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Shift Period</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 text-right whitespace-nowrap">Expected Cash</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 text-right whitespace-nowrap">Physical Count</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 text-right whitespace-nowrap">Variance</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 text-right whitespace-nowrap">Carried Fwd</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 text-center whitespace-nowrap">Status</th>
                        <th className="py-3 px-3.5 text-center whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {history.map((s, idx) => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200 last:border-b-0">
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/50">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap font-medium text-slate-800">
                            {s.submittedAt}
                          </td>
                          <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {s.periodStart} → {s.periodEnd}
                          </td>
                          <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-right font-bold text-slate-900 font-mono">
                            {formatPKR(s.expectedCash)}
                          </td>
                          <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-right font-bold text-slate-900 font-mono">
                            {formatPKR(s.physicalCash)}
                          </td>
                          <td
                            className={`py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-right font-bold font-mono ${
                              s.variance === 0
                                ? 'text-slate-500'
                                : s.variance > 0
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {s.variance > 0 ? `+${formatPKR(s.variance)}` : formatPKR(s.variance)}
                          </td>
                          <td
                            className={`py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-right font-semibold font-mono ${
                              s.carryForwardAmount > 0 ? 'text-amber-700' : 'text-slate-400'
                            }`}
                          >
                            {s.carryForwardAmount > 0 ? formatPKR(s.carryForwardAmount) : '—'}
                          </td>
                          <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                STATUS_BADGE[s.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {STATUS_LABEL[s.status] || s.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecord(s);
                                setIsDetailOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-[#08775A] hover:bg-[#065f46] text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => !isSaving && setIsConfirmOpen(false)}
        title="Confirm Shift Settlement"
        subtitle="Please review your drawer reconciliation before final submission to Finance."
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Back to Edit
            </button>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting…</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Submit Settlement</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-3.5 py-1">
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 divide-y divide-slate-200/80">
            <div className="flex items-center justify-between pb-2 text-xs">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Banknote className="h-4 w-4 text-slate-400" /> System Expected Cash:
              </span>
              <span className="font-bold text-slate-900 font-mono text-sm">{formatPKR(expectedCash)}</span>
            </div>

            <div className="flex items-center justify-between py-2 text-xs">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-slate-400" /> Counted Physical Cash:
              </span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                {formatPKR(physicalCash === '' ? 0 : Number(physicalCash))}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="font-semibold text-slate-700">Reconciliation Variance:</span>
              <span
                className={`font-bold font-mono text-sm ${
                  variance === 0
                    ? 'text-emerald-700'
                    : variance > 0
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {variance > 0 ? `+${formatPKR(variance)}` : formatPKR(variance)}
              </span>
            </div>
          </div>

          {handoverAmount !== '' && Number(handoverAmount) > 0 && (
            <div className="flex items-center justify-between p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs">
              <span className="font-medium text-emerald-800">Handover to Incoming Shift:</span>
              <span className="font-bold font-mono text-emerald-900">{formatPKR(handoverAmount)}</span>
            </div>
          )}

          {variance !== 0 && varianceReason.trim() && (
            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-900">
              <span className="font-bold block mb-0.5">Variance Explanation:</span>
              <p className="text-slate-700 italic">"{varianceReason.trim()}"</p>
            </div>
          )}

          {variance < 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Notice of Shortfall Carry-Forward:</strong> The deficit of{' '}
                <strong className="font-mono">{formatPKR(Math.abs(variance))}</strong> will be carried forward to your next shift settlement as an unsettled payable.
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Settlement Detail Modal */}
      <Modal
        isOpen={isDetailOpen && !!selectedRecord}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedRecord(null);
        }}
        title="Settlement Submission Details"
        subtitle={`Shift Reconciliation Record — ID: ${selectedRecord?.id || ''}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end w-full">
            <button
              type="button"
              onClick={() => {
                setIsDetailOpen(false);
                setSelectedRecord(null);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-[#08775A] hover:bg-[#065f46] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedRecord && (
          <div className="space-y-3.5 py-1 text-xs">
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 divide-y divide-slate-200/80">
              <div className="flex items-center justify-between pb-2">
                <span className="text-slate-500">Submitted At:</span>
                <span className="font-semibold text-slate-800">{selectedRecord.submittedAt}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500">Shift Period:</span>
                <span className="font-mono text-slate-700">{selectedRecord.periodStart} → {selectedRecord.periodEnd}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500">Status:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[selectedRecord.status] || 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABEL[selectedRecord.status] || selectedRecord.status}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500">Expected Physical Cash:</span>
                <span className="font-bold font-mono text-slate-900">{formatPKR(selectedRecord.expectedCash)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500">Counted Physical Cash:</span>
                <span className="font-bold font-mono text-slate-900">{formatPKR(selectedRecord.physicalCash)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold text-slate-700">Variance:</span>
                <span className={`font-bold font-mono ${selectedRecord.variance === 0 ? 'text-slate-600' : selectedRecord.variance > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {selectedRecord.variance > 0 ? `+${formatPKR(selectedRecord.variance)}` : formatPKR(selectedRecord.variance)}
                </span>
              </div>
              {selectedRecord.carryForwardAmount > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-amber-800 font-medium">Carried Forward Shortfall:</span>
                  <span className="font-bold font-mono text-amber-800">{formatPKR(selectedRecord.carryForwardAmount)}</span>
                </div>
              )}
              {selectedRecord.handoverAmount != null && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-emerald-800 font-medium">Handover to Incoming Shift:</span>
                  <span className="font-bold font-mono text-emerald-900">{formatPKR(selectedRecord.handoverAmount)}</span>
                </div>
              )}
            </div>

            {selectedRecord.varianceReason && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="font-bold block text-amber-900 mb-0.5">Variance Explanation:</span>
                <p className="text-slate-700 italic">"{selectedRecord.varianceReason}"</p>
              </div>
            )}

            {selectedRecord.remarks && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold block text-slate-700 mb-0.5">Remarks / Shift Notes:</span>
                <p className="text-slate-600">{selectedRecord.remarks}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
