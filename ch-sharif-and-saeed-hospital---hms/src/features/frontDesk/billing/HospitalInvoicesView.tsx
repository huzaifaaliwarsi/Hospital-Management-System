import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Receipt,
  Loader2,
  AlertTriangle,
  Search,
  RefreshCw,
  X,
  Calendar,
  Plus,
  RotateCcw,
  Eye,
  CreditCard,
} from 'lucide-react';
import { formatPKR } from '../../../utils/formatters';
import {
  fetchInvoices,
  InvoiceSummary,
  InvoiceStatus,
  EncounterType,
} from '../../../services/invoiceService';
import { InvoiceDetailModal, InvoiceModalAction } from './InvoiceDetailModal';
import {
  formatDateISO,
  getHospitalCurrentDate,
} from '../../../utils/dateConstants';

export type CareQueueFilter = 'ALL' | 'OPD' | 'ER' | 'OBS' | 'ADM' | 'CUSTOM';
export type PayerFilter = 'ALL' | 'SELF_PAY' | 'PANEL';

/** Record-type filter for the Discounts / Refunds / Payments-Receipts nav items — server-side (see `fetchInvoices`), so it holds across the whole table, not just what's currently loaded. */
export type InvoiceRecordFilter = 'DISCOUNTED' | 'REFUNDED' | 'PAID';

interface HospitalInvoicesViewProps {
  /** When true, only invoices with an outstanding balance are shown by default. */
  outstandingOnly?: boolean;
  /** Legacy prop for backward compatibility */
  encounterTypeFilter?: EncounterType;
  initialQueueFilter?: CareQueueFilter;
  /** Restricts the ledger to only invoices with a discount / a refund / at least one payment — used by the Discounts, Refunds, and Payments-Receipts pages so they show only what actually happened, not every invoice. */
  recordFilter?: InvoiceRecordFilter;
  title?: string;
  subtitle?: string;
}

/**
 * Resolves the operational care/queue category for an invoice:
 * - ADM: Admission / Inpatient stay
 * - ER: Emergency encounter
 * - OBS: Observation bed encounter
 * - CUSTOM: Ad-hoc / Custom Billing encounter (e.g. lab-test-only walk-in)
 * - OPD: Outpatient consultation / walk-in encounter
 */
export function getInvoiceCareQueue(inv: InvoiceSummary): 'OPD' | 'ER' | 'OBS' | 'ADM' | 'CUSTOM' {
  if (inv.sourceType === 'ADMISSION') return 'ADM';
  if (inv.encounterType === 'EMERGENCY') return 'ER';
  if (inv.encounterType === 'OBSERVATION') return 'OBS';
  if (inv.encounterType === 'CUSTOM') return 'CUSTOM';
  return 'OPD';
}

const QUEUE_TABS: { key: CareQueueFilter; label: string }[] = [
  { key: 'ALL', label: 'All Invoices' },
  { key: 'OPD', label: 'OPD (Outpatient)' },
  { key: 'ER', label: 'Emergency (ER)' },
  { key: 'OBS', label: 'Observation (OBS)' },
  { key: 'ADM', label: 'Inpatient (ADM)' },
  { key: 'CUSTOM', label: 'Custom Billing' },
];

export const HospitalInvoicesView: React.FC<HospitalInvoicesViewProps> = ({
  outstandingOnly = false,
  encounterTypeFilter,
  initialQueueFilter,
  recordFilter,
  title = 'Hospital Invoices & Patient Queues',
  subtitle = 'Unified billing ledger across OPD, Emergency (ER), Observation (OBS), Inpatient Admissions (ADM), and Custom Billing.',
}) => {
  // Determine initial queue
  const resolvedInitialQueue: CareQueueFilter = useMemo(() => {
    if (initialQueueFilter) return initialQueueFilter;
    if (encounterTypeFilter === 'OPD') return 'OPD';
    if (encounterTypeFilter === 'EMERGENCY') return 'ER';
    if (encounterTypeFilter === 'OBSERVATION') return 'OBS';
    if (encounterTypeFilter === 'CUSTOM') return 'CUSTOM';
    return 'ALL';
  }, [initialQueueFilter, encounterTypeFilter]);

  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter States
  const [activeQueue, setActiveQueue] = useState<CareQueueFilter>(resolvedInitialQueue);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoiceStatus>('ALL');
  const [payerFilter, setPayerFilter] = useState<PayerFilter>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isOutstandingOnly, setIsOutstandingOnly] = useState(outstandingOnly);

  // Active modal — `openInvoiceAction` pre-selects which form the modal opens
  // into (Add Service / Refund) when triggered from a row's quick-action
  // button, instead of always landing on the plain view.
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [openInvoiceAction, setOpenInvoiceAction] = useState<InvoiceModalAction | undefined>(undefined);

  const openInvoice = (id: string, action?: InvoiceModalAction) => {
    setOpenInvoiceId(id);
    setOpenInvoiceAction(action);
  };

  const closeInvoiceModal = () => {
    setOpenInvoiceId(null);
    setOpenInvoiceAction(undefined);
  };

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchInvoices({
        hasDiscount: recordFilter === 'DISCOUNTED' ? true : undefined,
        hasRefund: recordFilter === 'REFUNDED' ? true : undefined,
        hasPayment: recordFilter === 'PAID' ? true : undefined,
        hasOutstandingBalance: outstandingOnly ? true : undefined,
      });
      setInvoices(data);
    } catch (err: any) {
      setLoadError(
        err?.response?.data?.error?.message || err?.message || 'Failed to load invoices from server.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [recordFilter, outstandingOnly]);

  useEffect(() => {
    load();
  }, [load]);

  // This component is reused for every Hospital Invoices / Payments /
  // Discounts / Refunds / Outstanding Balances nav item from the SAME
  // switch statement (FrontDeskModuleView.tsx) — React keeps the same
  // instance across those nav clicks (same component type, same tree slot),
  // it only re-renders with new props. Without this, `isOutstandingOnly`'s
  // `useState(outstandingOnly)` initializer never re-runs, so navigating
  // from any other invoices page onto Outstanding Balances silently kept
  // whatever toggle state was already there instead of the page's own
  // intended default — this is what made it show every invoice.
  useEffect(() => {
    setIsOutstandingOnly(outstandingOnly);
  }, [outstandingOnly]);

  // Sync initial prop changes
  useEffect(() => {
    if (resolvedInitialQueue) {
      setActiveQueue(resolvedInitialQueue);
    }
  }, [resolvedInitialQueue]);

  // Live count by queue tab
  const queueCounts = useMemo(() => {
    const counts: Record<CareQueueFilter, number> = { ALL: invoices.length, OPD: 0, ER: 0, OBS: 0, ADM: 0, CUSTOM: 0 };
    invoices.forEach((inv) => {
      const q = getInvoiceCareQueue(inv);
      counts[q] = (counts[q] || 0) + 1;
    });
    return counts;
  }, [invoices]);

  // Helper to get local date string YYYY-MM-DD
  const getLocalDateString = (isoString?: string): string => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filtered dataset
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Queue / Care type filter
      if (activeQueue !== 'ALL') {
        const queue = getInvoiceCareQueue(inv);
        if (queue !== activeQueue) return false;
      }

      // 2. Outstanding only filter
      if (isOutstandingOnly && inv.balanceDue <= 0) return false;

      // 3. Status filter
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;

      // 4. Payer filter
      if (payerFilter === 'SELF_PAY' && inv.payerType !== 'Self Pay') return false;
      if (payerFilter === 'PANEL' && inv.payerType !== 'Corporate / Panel') return false;

      // 5. Custom Date Range filter
      const invDateStr = getLocalDateString(inv.createdAtIso);
      if (startDate && invDateStr && invDateStr < startDate) return false;
      if (endDate && invDateStr && invDateStr > endDate) return false;

      // 6. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const numMatch = inv.invoiceNumber.toLowerCase().includes(q);
        const nameMatch = inv.patientName.toLowerCase().includes(q);
        const mrMatch = (inv.patientMr || '').toLowerCase().includes(q);
        if (!numMatch && !nameMatch && !mrMatch) return false;
      }

      return true;
    });
  }, [invoices, activeQueue, isOutstandingOnly, statusFilter, payerFilter, startDate, endDate, searchTerm]);

  // Summary Metrics of filtered data
  const metrics = useMemo(() => {
    return filteredInvoices.reduce(
      (acc, i) => {
        acc.totalInvoices += 1;
        acc.totalBilled += i.total;
        acc.totalPaid += i.paidTotal;
        acc.totalDue += i.balanceDue;
        return acc;
      },
      { totalInvoices: 0, totalBilled: 0, totalPaid: 0, totalDue: 0 }
    );
  }, [filteredInvoices]);

  const hasActiveFilters =
    activeQueue !== 'ALL' ||
    searchTerm.trim() !== '' ||
    statusFilter !== 'ALL' ||
    payerFilter !== 'ALL' ||
    startDate !== '' ||
    endDate !== '' ||
    isOutstandingOnly !== outstandingOnly;

  const resetAllFilters = () => {
    setActiveQueue('ALL');
    setSearchTerm('');
    setStatusFilter('ALL');
    setPayerFilter('ALL');
    setStartDate('');
    setEndDate('');
    setIsOutstandingOnly(outstandingOnly);
  };

  const handleSetToday = () => {
    const todayStr = formatDateISO(getHospitalCurrentDate());
    setStartDate(todayStr);
    setEndDate(todayStr);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-slate-500 gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-[#08775A]" />
        <span className="text-sm font-semibold text-slate-600">Loading hospital invoices…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center bg-white rounded-2xl border border-rose-200 p-8 shadow-xs">
        <AlertTriangle className="h-9 w-9 text-rose-500" />
        <h3 className="text-sm font-bold text-rose-950">Failed to Load Invoices</h3>
        <p className="text-xs text-rose-700 max-w-md">{loadError}</p>
        <button
          type="button"
          onClick={() => load()}
          className="mt-2 px-5 py-2.5 bg-[#08775A] hover:bg-[#0e7d5a] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-[#111827]">{title}</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
              Live Front Desk Ledger
            </span>
          </div>
          <p className="text-xs text-[#52665e] max-w-2xl leading-relaxed">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#f6faf8] text-[#52665e] hover:text-[#111827] border border-[#e2eae5] text-xs font-semibold rounded-lg shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Invoices"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#08775A] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Segmented Queue Selector (Hospital Theme) */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-2 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {QUEUE_TABS.map((tab) => {
            const isActive = activeQueue === tab.key;
            const count = queueCounts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveQueue(tab.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#08775A] text-white shadow-xs'
                    : 'bg-[#f8faf9] text-[#52665e] hover:bg-[#eff5f2] hover:text-[#111827] border border-[#e2eae5]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-[#08775A] border border-[#c2e7db]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="bg-white rounded-xl border border-[#e2eae5] p-3.5 shadow-2xs">
          <span className="block text-[11px] font-semibold text-[#52665e] uppercase tracking-wider">
            Invoices in View
          </span>
          <div className="mt-1">
            <span className="text-xl font-bold text-[#111827]">{metrics.totalInvoices}</span>
          </div>
          <span className="text-[10px] text-[#8b9e95] mt-0.5 block">Matching current criteria</span>
        </div>

        <div className="bg-white rounded-xl border border-[#e2eae5] p-3.5 shadow-2xs">
          <span className="block text-[11px] font-semibold text-[#52665e] uppercase tracking-wider">
            Net Billed (PKR)
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold text-[#111827] font-mono">
              {formatPKR(metrics.totalBilled)}
            </span>
          </div>
          <span className="text-[10px] text-[#8b9e95] mt-0.5 block">Total invoice amount</span>
        </div>

        <div className="bg-white rounded-xl border border-[#e2eae5] p-3.5 shadow-2xs">
          <span className="block text-[11px] font-semibold text-[#08775A] uppercase tracking-wider">
            Total Collected (PKR)
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold text-[#08775A] font-mono">
              {formatPKR(metrics.totalPaid)}
            </span>
          </div>
          <span className="text-[10px] text-[#8b9e95] mt-0.5 block">Realized payments</span>
        </div>

        <div className="bg-white rounded-xl border border-[#e2eae5] p-3.5 shadow-2xs">
          <span className="block text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
            Total Balance Due (PKR)
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold text-rose-700 font-mono">
              {formatPKR(metrics.totalDue)}
            </span>
          </div>
          <span className="text-[10px] text-[#8b9e95] mt-0.5 block">Pending settlement</span>
        </div>
      </div>

      {/* Filter Toolbar: Direct Custom Date, Search, Status & Payer */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8b9e95]" />
            <input
              type="text"
              placeholder="Search Invoice #, Patient Name, or MR #…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-7 py-2 border border-[#c2e7db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#08775A] focus:border-[#08775A] bg-white placeholder:text-[#8b9e95]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Custom Date Range Picker (Direct, No Presets Dropdown) */}
          <div className="flex items-center gap-1.5 bg-[#f8faf9] px-2.5 py-1.5 rounded-lg border border-[#c2e7db] shrink-0">
            <Calendar className="h-3.5 w-3.5 text-[#08775A] shrink-0" />
            <span className="text-[11px] font-semibold text-[#52665e]">From:</span>
            <input
              lang="en-GB" type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs px-1.5 py-1 bg-white border border-[#c2e7db] rounded-md text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            />
            <span className="text-[11px] font-semibold text-[#52665e]">To:</span>
            <input
              lang="en-GB" type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs px-1.5 py-1 bg-white border border-[#c2e7db] rounded-md text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            />
            <button
              type="button"
              onClick={handleSetToday}
              className="text-[10px] px-2 py-1 rounded font-semibold border border-[#c2e7db] text-[#08775A] bg-white hover:bg-[#effaf5] transition-colors cursor-pointer"
              title="Set to Today"
            >
              Today
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                title="Clear Dates"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="shrink-0 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#52665e] hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs px-2.5 py-2 border border-[#c2e7db] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#08775A] text-[#111827] font-medium cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </select>
          </div>

          {/* Payer Dropdown */}
          <div className="shrink-0 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#52665e] hidden sm:inline">Payer:</span>
            <select
              value={payerFilter}
              onChange={(e) => setPayerFilter(e.target.value as any)}
              className="text-xs px-2.5 py-2 border border-[#c2e7db] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#08775A] text-[#111827] font-medium cursor-pointer"
            >
              <option value="ALL">All Payers</option>
              <option value="SELF_PAY">Self Pay</option>
              <option value="PANEL">Corporate / Panel</option>
            </select>
          </div>

          {/* Outstanding Due Filter */}
          <button
            type="button"
            onClick={() => setIsOutstandingOnly(!isOutstandingOnly)}
            className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
              isOutstandingOnly
                ? 'bg-rose-50 border-rose-300 text-rose-700'
                : 'bg-white border-[#c2e7db] text-[#52665e] hover:bg-[#f8faf9]'
            }`}
          >
            <span>Due &gt; 0</span>
          </button>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Reset all filters"
            >
              <X className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-xl border border-[#e2eae5] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[320px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[#f8faf9] shadow-2xs">
              <tr className="border-b border-[#e2eae5] text-[11px] font-bold text-[#52665e] uppercase tracking-wider">
                <th className="py-3 px-4 whitespace-nowrap">Invoice #</th>
                <th className="py-3 px-4 whitespace-nowrap">Patient Info</th>
                <th className="py-3 px-4 whitespace-nowrap">Care Type</th>
                <th className="py-3 px-4 whitespace-nowrap">Payer</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Gross</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Discount</th>
                <th className="py-3 px-4 text-right font-bold text-[#111827] whitespace-nowrap">Net Payable</th>
                <th className="py-3 px-4 text-right font-bold text-emerald-800 whitespace-nowrap">Paid</th>
                <th className="py-3 px-4 text-right font-bold text-rose-800 whitespace-nowrap">Due</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Date</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2eae5] text-slate-700">
              {filteredInvoices.map((inv) => {
                const careQueue = getInvoiceCareQueue(inv);
                const isPaid = inv.status === 'PAID';
                const isPartiallyPaid = inv.status === 'PARTIALLY_PAID';
                const isVoid = inv.status === 'VOID';

                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-[#f8fcfa] transition-colors cursor-pointer group"
                    onClick={() => openInvoice(inv.id)}
                  >
                    {/* Invoice # */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 group-hover:text-[#08775A] whitespace-nowrap">
                      {inv.invoiceNumber}
                    </td>

                    {/* Patient Info */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-900 block whitespace-nowrap">{inv.patientName}</span>
                      {inv.patientMr && (
                        <span className="inline-block mt-0.5 font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 whitespace-nowrap">
                          {inv.patientMr}
                        </span>
                      )}
                    </td>

                    {/* Clean Care Type Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {careQueue === 'OPD' && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                          OPD
                        </span>
                      )}
                      {careQueue === 'ER' && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                          Emergency
                        </span>
                      )}
                      {careQueue === 'OBS' && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                          Observation
                        </span>
                      )}
                      {careQueue === 'ADM' && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db] whitespace-nowrap">
                          Admission
                        </span>
                      )}
                      {careQueue === 'CUSTOM' && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                          Custom Billing
                        </span>
                      )}
                    </td>

                    {/* Payer Type */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${
                          inv.payerType === 'Corporate / Panel'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {inv.payerType}
                      </span>
                    </td>

                    {/* Gross */}
                    <td className="py-3 px-4 text-right font-mono text-slate-500 whitespace-nowrap">
                      {formatPKR(inv.subtotal || inv.total + inv.discountTotal)}
                    </td>

                    {/* Discount */}
                    <td className="py-3 px-4 text-right font-mono text-slate-500 whitespace-nowrap">
                      {inv.discountTotal > 0 ? (
                        <span className="text-amber-700 font-semibold whitespace-nowrap">
                          -{formatPKR(inv.discountTotal)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Net Payable */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatPKR(inv.total)}
                    </td>

                    {/* Paid (with a Refunded tag when applicable) */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                      {formatPKR(inv.paidTotal)}
                      {inv.hasRefund && (
                        <span className="block text-[10px] font-semibold text-rose-700 mt-0.5 whitespace-nowrap">
                          Refunded {formatPKR(inv.refundedAmount)}
                        </span>
                      )}
                    </td>

                    {/* Balance Due / Remaining */}
                    <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                      {inv.balanceDue > 0 ? (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 whitespace-nowrap">
                          {formatPKR(inv.balanceDue)}
                        </span>
                      ) : inv.paidTotal > inv.total ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] whitespace-nowrap" title="Excess deposit remaining / refundable">
                          +{formatPKR(inv.paidTotal - inv.total)} Ref
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal whitespace-nowrap">Settled</span>
                      )}
                    </td>

                    {/* Bill Status */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : isPartiallyPaid
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : isVoid
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-right text-[11px] text-slate-500 whitespace-nowrap">
                      {inv.createdAt}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openInvoice(inv.id)}
                          title="View invoice details"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-800 text-slate-700 hover:text-white border border-slate-200 hover:border-slate-800 text-[11px] font-semibold rounded shadow-2xs transition-colors cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View</span>
                        </button>

                        {!isVoid && (inv.balanceDue > 0 || inv.sourceType === 'ADMISSION') && (
                          <button
                            type="button"
                            onClick={() => openInvoice(inv.id, 'payment')}
                            title={inv.sourceType === 'ADMISSION' ? 'Collect payment or additional advance' : 'Collect payment on this invoice'}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#effaf5] hover:bg-[#08775A] text-[#08775A] hover:text-white border border-[#c2e7db] hover:border-[#08775A] text-[11px] font-semibold rounded shadow-2xs transition-colors cursor-pointer"
                          >
                            <CreditCard className="h-3 w-3" />
                            <span>{inv.sourceType === 'ADMISSION' ? 'Pay / Advance' : 'Pay'}</span>
                          </button>
                        )}

                        {!isVoid && (
                          <button
                            type="button"
                            onClick={() => openInvoice(inv.id, 'addLine')}
                            title="Add a service line to this invoice"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-800 text-slate-700 hover:text-white border border-slate-200 hover:border-slate-800 text-[11px] font-semibold rounded shadow-2xs transition-colors cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => inv.paidTotal > 0 && openInvoice(inv.id, 'refund')}
                          disabled={inv.paidTotal <= 0}
                          title={inv.paidTotal > 0 ? 'Refund an amount already collected on this invoice' : 'Nothing collected yet — nothing to refund'}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 text-[11px] font-semibold rounded shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-rose-700"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Refund</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-500">
                    <Receipt className="h-9 w-9 text-slate-300 mx-auto mb-2" />
                    <h4 className="text-sm font-semibold text-slate-800">No Invoices Found</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {hasActiveFilters
                        ? 'No invoices match your currently selected criteria.'
                        : recordFilter === 'DISCOUNTED'
                        ? 'No invoice has had a discount applied yet.'
                        : recordFilter === 'REFUNDED'
                        ? 'No invoice has had a refund posted yet.'
                        : recordFilter === 'PAID'
                        ? 'No invoice has a payment recorded yet.'
                        : 'No invoices have been recorded yet in this queue.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="mt-3 px-3.5 py-1.5 bg-[#f8faf9] hover:bg-[#eff5f2] text-[#08775A] text-xs font-semibold rounded-lg border border-[#c2e7db] transition-colors cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail / Payment Modal */}
      {openInvoiceId && (
        <InvoiceDetailModal
          invoiceId={openInvoiceId}
          initialAction={openInvoiceAction}
          onClose={closeInvoiceModal}
          onChanged={() => load(true)}
        />
      )}
    </div>
  );
};
