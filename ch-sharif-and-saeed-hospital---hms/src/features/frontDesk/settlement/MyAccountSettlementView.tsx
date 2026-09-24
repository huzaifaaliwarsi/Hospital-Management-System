import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  UserCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Wallet,
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
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import { useRouter } from '../../../context/RouterContext';
import { useAuth } from '../../../context/AuthContext';
import { frontdeskApiService } from '../../../services/frontdeskApiService';
import {
  downloadTablePDF,
  downloadTableExcel,
  downloadTableCSV,
  printTable,
  ExportColumn,
} from '../../../services/tableExportService';
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
  ACCEPTED: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold',
  PARTIALLY_ACCEPTED: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
  RETURNED: 'bg-orange-50 text-orange-800 border-orange-200 font-bold',
  REJECTED: 'bg-rose-50 text-rose-800 border-rose-200 font-bold',
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
 * My Account Settlement — Re-architected with modern Hospital ERP aesthetics:
 * - Full-width responsive dashboard layout matching Balance Sheet
 * - Top header with live Refresh and quick navigation to Balance Sheet
 * - Hospital green gradient banner (#0a4636 -> #08775A) with real-time cashier context
 * - 4 primary financial KPI metric cards across the top
 * - Dual-column interactive reconciliation workspace:
 *   - Left: Drawer Physical Cash Count with quick denomination buttons & live status banner
 *   - Right: Handover & Financial Settlement Summary with clean itemized audit breakdown
 * - Settlement History with dark gradient banner, export toolbar, and bordered table
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

  const load = useCallback(async (silent = false) => {
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countedAmount = physicalCash === '' ? 0 : Number(physicalCash);
  const variance = physicalCash === '' ? 0 : countedAmount - expectedCash;
  const handoverVal = handoverAmount === '' ? 0 : Number(handoverAmount);
  const retainedFloat = Math.max(0, countedAmount - handoverVal);

  const validate = (): string | null => {
    if (physicalCash === '' || Number(physicalCash) < 0) {
      return 'Please enter the physical cash counted in your drawer.';
    }
    if (variance !== 0 && !varianceReason.trim()) {
      return `Physical cash does not match expected cash (${formatPKR(expectedCash)}). A variance explanation is mandatory.`;
    }
    if (handoverAmount !== '' && Number(handoverAmount) > countedAmount) {
      return `Handover amount (${formatPKR(Number(handoverAmount))}) cannot exceed counted physical cash (${formatPKR(countedAmount)}).`;
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

  const handleQuickAddCash = (increment: number) => {
    const current = physicalCash === '' ? 0 : Number(physicalCash);
    setPhysicalCash(current + increment);
    if (formError) setFormError(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* 1. Top Header with Title and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Account Settlement</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cashier shift reconciliation, drawer count verification, and finance settlement submission.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={isRefreshing || isLoading}
            className="h-7.5 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
            title="Refresh live data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#08775A]' : ''}`} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/front-desk/my_balance_sheet')}
            className="h-7.5 px-3.5 rounded-md bg-[#08775A] hover:bg-[#065f46] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>View Balance Sheet</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="bg-white rounded-xl border border-rose-200 p-8 flex flex-col items-center gap-2.5 text-center shadow-xs">
          <AlertCircle className="h-7 w-7 text-rose-500" />
          <p className="text-sm text-rose-700 font-semibold">{loadError}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-1 px-4 py-2 bg-[#08775A] text-white text-xs font-semibold rounded-lg hover:bg-[#065f46] transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3 text-slate-400 shadow-xs">
          <Loader2 className="h-6 w-6 animate-spin text-[#08775A]" />
          <span className="text-xs font-medium">Loading live cashier drawer position…</span>
        </div>
      ) : (
        <>
          {/* 2. Hospital Dark Gradient Header Banner (Matching Balance Sheet) */}
          <div className="bg-gradient-to-r from-[#0a4636] to-[#08775A] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide text-white">
              <div className="h-6 w-6 rounded bg-white/15 text-white flex items-center justify-center">
                <UserCheck className="h-3.5 w-3.5" />
              </div>
              <span>Shift Settlement — Cash Reconciliation &amp; Custody Closeout</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-100 font-medium bg-white/10 px-2.5 py-0.5 rounded-md">
                Cashier: {currentUser?.name || 'Front Desk'}
              </span>
              <span className="hidden sm:inline-block text-[11px] text-emerald-200 font-mono">
                Live Custody: {formatPKR(expectedCash)}
              </span>
            </div>
          </div>

          {/* 3. Primary KPI Metric Cards (4 Cards across top) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Expected Physical Cash */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between text-emerald-700 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Expected Cash</span>
                <div className="h-6 w-6 rounded-md bg-emerald-50 flex items-center justify-center">
                  <Banknote className="h-3.5 w-3.5 text-emerald-700" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-slate-900 leading-tight">
                {formatPKR(expectedCash)}
              </p>
              <p className="text-[10.5px] text-slate-500 mt-1.5 truncate">Shift collections awaiting closeout</p>
            </div>

            {/* Unsettled Transactions */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between text-blue-700 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Unsettled Entries</span>
                <div className="h-6 w-6 rounded-md bg-blue-50 flex items-center justify-center">
                  <Receipt className="h-3.5 w-3.5 text-blue-700" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-slate-900 leading-tight">
                {unsettledCount} <span className="text-xs font-sans text-slate-500 font-normal">records</span>
              </p>
              <p className="text-[10.5px] text-slate-500 mt-1.5 truncate">Invoices, walk-ins, &amp; receipts</p>
            </div>

            {/* Prior Deficit (Carried Fwd) */}
            <div
              className={`bg-white rounded-xl border p-3.5 shadow-xs transition-colors ${
                carriedForwardAmount > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-600 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Prior Deficit</span>
                <div
                  className={`h-6 w-6 rounded-md flex items-center justify-center ${
                    carriedForwardAmount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Coins className="h-3.5 w-3.5" />
                </div>
              </div>
              <p
                className={`text-lg font-bold font-mono leading-tight ${
                  carriedForwardAmount > 0 ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {formatPKR(carriedForwardAmount)}
              </p>
              <p className="text-[10.5px] text-slate-500 mt-1.5 truncate">
                {carriedForwardAmount > 0 ? 'Carried from previous shift' : 'No prior shortfall on record'}
              </p>
            </div>

            {/* Current Counted Drawer */}
            <div
              className={`bg-white rounded-xl border p-3.5 shadow-xs transition-colors ${
                physicalCash === ''
                  ? 'border-slate-200 hover:border-slate-300'
                  : variance === 0
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : variance < 0
                  ? 'border-rose-300 bg-rose-50/20'
                  : 'border-amber-300 bg-amber-50/20'
              }`}
            >
              <div className="flex items-center justify-between text-slate-600 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Counted Drawer</span>
                <div
                  className={`h-6 w-6 rounded-md flex items-center justify-center ${
                    physicalCash === ''
                      ? 'bg-slate-100 text-slate-600'
                      : variance === 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : variance < 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <Wallet className="h-3.5 w-3.5" />
                </div>
              </div>
              <p
                className={`text-lg font-bold font-mono leading-tight ${
                  physicalCash === ''
                    ? 'text-slate-400'
                    : variance === 0
                    ? 'text-emerald-700'
                    : variance < 0
                    ? 'text-rose-700'
                    : 'text-amber-700'
                }`}
              >
                {physicalCash === '' ? 'PKR 0' : formatPKR(countedAmount)}
              </p>
              <p className="text-[10.5px] text-slate-500 mt-1.5 truncate">
                {physicalCash === ''
                  ? 'Awaiting cash count input'
                  : variance === 0
                  ? 'Drawer perfectly balanced'
                  : variance < 0
                  ? `Shortfall: -${formatPKR(Math.abs(variance))}`
                  : `Surplus: +${formatPKR(variance)}`}
              </p>
            </div>
          </div>

          {/* Prior Shortfall Alert Notice */}
          {carriedForwardAmount > 0 && (
            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Prior Shift Shortfall:</strong> The amount of{' '}
                <strong className="font-mono">{formatPKR(carriedForwardAmount)}</strong> was carried forward from your
                previous settlement deficit and is folded into your current expected physical cash.
              </div>
            </div>
          )}

          {/* 4. Interactive Reconciliation Workspace (Dual-Column Grid on Desktop) */}
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Count Drawer & Physical Cash Input */}
              <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="bg-[#16a34a] text-white px-3.5 py-2 font-bold text-xs tracking-wide flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Banknote className="h-3.5 w-3.5" />
                      1. Physical Cash Count &amp; Reconciliation
                    </span>
                    {expectedCash > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhysicalCash(expectedCash);
                          if (formError) setFormError(null);
                        }}
                        className="text-[11px] font-semibold bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Auto-Match Expected ({formatPKR(expectedCash)})</span>
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    {formError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Main Currency Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800">
                          Physical Cash Counted <span className="text-rose-500">*</span>
                        </label>
                        {physicalCash !== '' && (
                          <button
                            type="button"
                            onClick={() => setPhysicalCash('')}
                            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          >
                            Clear Input
                          </button>
                        )}
                      </div>

                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 pointer-events-none flex items-center gap-1 font-bold text-slate-600 font-mono text-sm border-r border-slate-200 pr-2.5">
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
                          className="w-full rounded-lg border border-slate-300 bg-white pl-20 pr-4 py-2 text-base sm:text-lg font-bold font-mono text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#08775A] focus:border-[#08775A]"
                        />
                      </div>

                      {/* Quick Denomination / Fill Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">Quick:</span>
                        {expectedCash > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhysicalCash(expectedCash);
                              if (formError) setFormError(null);
                            }}
                            className="text-[10.5px] px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-semibold transition-colors cursor-pointer"
                          >
                            Full Match ({formatPKR(expectedCash)})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleQuickAddCash(500)}
                          className="text-[10.5px] px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-medium transition-colors cursor-pointer"
                        >
                          +500
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddCash(1000)}
                          className="text-[10.5px] px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-medium transition-colors cursor-pointer"
                        >
                          +1,000
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddCash(5000)}
                          className="text-[10.5px] px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-medium transition-colors cursor-pointer"
                        >
                          +5,000
                        </button>
                      </div>
                    </div>

                    {/* Live Dynamic Reconciliation Alert Banner */}
                    {physicalCash === '' ? (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2.5 text-xs text-slate-600">
                        <Wallet className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>Enter the counted physical cash above to perform live reconciliation against expected collections.</span>
                      </div>
                    ) : variance === 0 ? (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5">
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-700 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                              Drawer Balanced · Perfect Match
                            </h4>
                            <span className="px-2 py-0.2 rounded text-[10.5px] font-bold font-mono bg-emerald-100 text-emerald-900 border border-emerald-300">
                              Variance: PKR 0
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-800 mt-0.5">
                            Physical cash matches expected collections ({formatPKR(expectedCash)}) exactly. No variance explanation is required.
                          </p>
                        </div>
                      </div>
                    ) : variance < 0 ? (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5">
                        <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-rose-950 uppercase tracking-wide">
                              Cash Shortfall Detected
                            </h4>
                            <span className="px-2 py-0.2 rounded text-[10.5px] font-bold font-mono bg-rose-100 text-rose-900 border border-rose-300">
                              Deficit: -{formatPKR(Math.abs(variance))}
                            </span>
                          </div>
                          <p className="text-[11px] text-rose-800 mt-0.5">
                            Physical cash is <strong>{formatPKR(Math.abs(variance))}</strong> short. You must provide a variance reason below for financial audit. This deficit will carry forward to your next shift.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
                        <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                              Cash Surplus Detected
                            </h4>
                            <span className="px-2 py-0.2 rounded text-[10.5px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                              Surplus: +{formatPKR(variance)}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Physical cash exceeds expected collections by <strong>{formatPKR(variance)}</strong>. Please document the reason for the excess.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Variance Reason Input & Chips */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          Variance Reason{' '}
                          {variance !== 0 ? (
                            <span className="text-rose-600 font-bold">* Mandatory Explanation</span>
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
                              onClick={() => {
                                setVarianceReason(reason);
                                if (formError) setFormError(null);
                              }}
                              className={`text-[10.5px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
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
                        className={`w-full rounded-lg border bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#08775A] ${
                          variance !== 0 && !varianceReason.trim()
                            ? 'border-amber-300'
                            : 'border-slate-300'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-300 px-4 py-2.5 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Counted Position:</span>
                  <span className="font-mono text-slate-900">
                    {physicalCash === '' ? 'PKR 0' : formatPKR(countedAmount)}
                  </span>
                </div>
              </div>

              {/* Right Column: Handover & Financial Settlement Summary */}
              <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="bg-[#2563eb] text-white px-3.5 py-2 font-bold text-xs tracking-wide flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      2. Handover &amp; Shift Closeout Summary
                    </span>
                    <span className="text-[11px] font-normal text-blue-100">
                      Finance Audit Position
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="py-2.5 px-4 text-slate-600 font-medium">Expected Physical Cash (System):</span>
                      <span className="py-2.5 px-4 bg-slate-50 text-slate-900 font-bold font-mono min-w-40 text-right border-l border-slate-200">
                        {formatPKR(expectedCash)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="py-2.5 px-4 text-slate-600 font-medium">Physical Cash Counted (Register):</span>
                      <span className="py-2.5 px-4 bg-emerald-50 text-emerald-950 font-bold font-mono min-w-40 text-right border-l border-slate-200">
                        {physicalCash === '' ? 'PKR 0' : formatPKR(countedAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50/50">
                      <span className="py-2.5 px-4 text-slate-900 font-bold">Net Reconciliation Variance:</span>
                      <span
                        className={`py-2.5 px-4 font-bold font-mono min-w-40 text-right border-l border-slate-200 ${
                          variance === 0
                            ? 'bg-[#dcfce7] text-emerald-900'
                            : variance > 0
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-[#fee2e2] text-rose-900'
                        }`}
                      >
                        {variance === 0 ? 'PKR 0 (Balanced)' : variance > 0 ? `+${formatPKR(variance)}` : formatPKR(variance)}
                      </span>
                    </div>

                    {carriedForwardAmount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="py-2.5 px-4 text-slate-600 font-medium">Included Prior Deficit:</span>
                        <span className="py-2.5 px-4 bg-amber-50 text-amber-900 font-bold font-mono min-w-40 text-right border-l border-slate-200">
                          {formatPKR(carriedForwardAmount)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Handover & Remarks Form Inputs */}
                  <div className="p-4 space-y-3.5 border-t border-slate-200">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">
                          Physical Cash Handover to Supervisor / Incoming Shift
                        </label>
                        {countedAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => setHandoverAmount(countedAmount)}
                            className="text-[10.5px] font-semibold text-[#08775A] hover:underline cursor-pointer"
                          >
                            Handover Full ({formatPKR(countedAmount)})
                          </button>
                        )}
                      </div>

                      <div className="relative flex items-center">
                        <div className="absolute left-3 pointer-events-none flex items-center text-xs font-bold text-slate-500 font-mono border-r border-slate-200 pr-2">
                          PKR
                        </div>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={handoverAmount}
                          onChange={(e) => setHandoverAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="0"
                          className="w-full rounded-lg border border-slate-300 bg-white pl-16 pr-3.5 py-1.5 text-xs font-mono font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Physical notes handed over to next shift custodian</span>
                        {countedAmount > 0 && handoverVal > 0 && (
                          <span className="font-semibold text-slate-700">
                            Retained in Drawer: {formatPKR(retainedFloat)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Remarks / Shift Closeout Notes (optional)
                      </label>
                      <textarea
                        rows={2}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Optional notes regarding this shift closeout..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Action Bar */}
                <div className="border-t border-slate-300 p-3.5 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <ShieldCheck className="h-4 w-4 text-[#08775A] shrink-0" />
                    <span>Audited and locked upon submission</span>
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] active:bg-[#054e39] rounded-lg shadow-xs transition-all cursor-pointer"
                  >
                    <span>Review &amp; Submit Closeout</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* 5. Settlement History Section */}
          <div className="space-y-3 pt-2">
            {/* Dark Theme Header Banner (matching reference UI) */}
            <div className="bg-gradient-to-r from-[#0a4636] to-[#08775A] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide text-white">
                <div className="h-6 w-6 rounded bg-white/15 text-white flex items-center justify-center">
                  <History className="h-3.5 w-3.5" />
                </div>
                <span>Account Settlement — Past Shift Submissions &amp; Audits</span>
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
              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Back to Edit
            </button>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
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
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 divide-y divide-slate-200/80">
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
            <div className="flex items-center justify-between p-3 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs">
              <span className="font-medium text-emerald-800">Handover to Incoming Shift:</span>
              <span className="font-bold font-mono text-emerald-900">{formatPKR(Number(handoverAmount))}</span>
            </div>
          )}

          {variance !== 0 && varianceReason.trim() && (
            <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200 text-xs text-amber-900">
              <span className="font-bold block mb-0.5">Variance Explanation:</span>
              <p className="text-slate-700 italic">"{varianceReason.trim()}"</p>
            </div>
          )}

          {variance < 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Notice of Shortfall Carry-Forward:</strong> The deficit of{' '}
                <strong className="font-mono">{formatPKR(Math.abs(variance))}</strong> will be carried forward to your
                next shift settlement as an unsettled payable.
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
              className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-[#08775A] hover:bg-[#065f46] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedRecord && (
          <div className="space-y-3.5 py-1 text-xs">
            <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 divide-y divide-slate-200/80">
              <div className="flex items-center justify-between pb-2">
                <span className="text-slate-500">Submitted At:</span>
                <span className="font-semibold text-slate-800">{selectedRecord.submittedAt}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500">Shift Period:</span>
                <span className="font-mono text-slate-700">
                  {selectedRecord.periodStart} → {selectedRecord.periodEnd}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500">Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    STATUS_BADGE[selectedRecord.status] || 'bg-slate-100 text-slate-600'
                  }`}
                >
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
                <span
                  className={`font-bold font-mono ${
                    selectedRecord.variance === 0
                      ? 'text-slate-600'
                      : selectedRecord.variance > 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {selectedRecord.variance > 0
                    ? `+${formatPKR(selectedRecord.variance)}`
                    : formatPKR(selectedRecord.variance)}
                </span>
              </div>
              {selectedRecord.carryForwardAmount > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-amber-800 font-medium">Carried Forward Shortfall:</span>
                  <span className="font-bold font-mono text-amber-800">
                    {formatPKR(selectedRecord.carryForwardAmount)}
                  </span>
                </div>
              )}
              {selectedRecord.handoverAmount != null && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-emerald-800 font-medium">Handover to Incoming Shift:</span>
                  <span className="font-bold font-mono text-emerald-900">
                    {formatPKR(selectedRecord.handoverAmount)}
                  </span>
                </div>
              )}
            </div>

            {selectedRecord.varianceReason && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="font-bold block text-amber-900 mb-0.5">Variance Explanation:</span>
                <p className="text-slate-700 italic">"{selectedRecord.varianceReason}"</p>
              </div>
            )}

            {selectedRecord.remarks && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
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
