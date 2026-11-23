import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  Search,
  RotateCcw,
  Eye,
  Filter,
  Calendar,
  CreditCard,
  Building2,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Printer,
  X,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { formatPKR, formatDateTime, formatDate } from '../utils/format';
import { exportToCSV, exportToExcel, printFinancialReport } from '../utils/reportExportUtils';
import { ALL_REPORTS_LIST } from '../components/ReportView';

type PeriodPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom' | 'all_time';

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
  { value: 'all_time', label: 'All Time' },
];

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Transaction Types' },
  { value: 'INCOME', label: 'Sales / Recognized Income' },
  { value: 'COLLECTION', label: 'Actual Collections Received' },
  { value: 'EXPENSE', label: 'Operating Expenses' },
];

const CHANNEL_OPTIONS = [
  { value: 'ALL', label: 'All Channels' },
  { value: 'RETAIL', label: 'Retail Walk-In POS' },
  { value: 'HMS', label: 'HMS Inpatient Dispense' },
  { value: 'EXPENSE', label: 'Operating Overheads' },
];

const PAYMENT_METHODS = [
  { value: 'ALL', label: 'All Payment Methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Debit / Credit Card' },
  { value: 'BANK', label: 'Bank Transfer' },
  { value: 'ONLINE', label: 'Online / Digital' },
];

function getPKTDate(): Date {
  return new Date(Date.now() + 5 * 3600000);
}

function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface UnifiedLedgerRow {
  id: string;
  date: string;
  reference: string;
  sourceType: 'INVOICE' | 'EXPENSE';
  channel: 'RETAIL' | 'HMS' | 'EXPENSE';
  description: string;
  income: number;
  collections: number;
  expenses: number;
  paymentMethod: string;
  outstanding: number;
  user: string;
  status: string;
  raw: any;
}

interface Props {
  onNavigate?: (pageId: string) => void;
}

export const PharmacyIncomeExpenseReportPage: React.FC<Props> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const isSales = currentUser?.role === 'SALES_DISPENSING';
  const todayISO = formatDateISO(getPKTDate());

  // Filter States
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [fromDate, setFromDate] = useState<string>(todayISO);
  const [toDate, setToDate] = useState<string>(todayISO);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Applied Filter State for query
  const [appliedFilters, setAppliedFilters] = useState({
    preset: 'today' as PeriodPreset,
    fromDate: todayISO,
    toDate: todayISO,
    typeFilter: 'ALL',
    channelFilter: 'ALL',
    methodFilter: 'ALL',
    search: '',
  });

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  // Detail Modal
  const [detailRow, setDetailRow] = useState<UnifiedLedgerRow | null>(null);

  // Sync date inputs on preset change
  const handlePresetChange = (p: PeriodPreset) => {
    setPreset(p);
    const today = getPKTDate();
    const todayStr = formatDateISO(today);

    if (p === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (p === 'yesterday') {
      const y = new Date(today.getTime() - 86400000);
      const yStr = formatDateISO(y);
      setFromDate(yStr);
      setToDate(yStr);
    } else if (p === 'this_week') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      setFromDate(formatDateISO(d));
      setToDate(todayStr);
    } else if (p === 'this_month') {
      setFromDate(`${todayStr.slice(0, 7)}-01`);
      setToDate(todayStr);
    } else if (p === 'last_month') {
      const curYear = parseInt(todayStr.slice(0, 4), 10);
      const curMonth = parseInt(todayStr.slice(5, 7), 10);
      const lastMonth = curMonth === 1 ? 12 : curMonth - 1;
      const lastYear = curMonth === 1 ? curYear - 1 : curYear;
      const mStr = String(lastMonth).padStart(2, '0');
      const start = `${lastYear}-${mStr}-01`;
      const lastDay = new Date(lastYear, lastMonth, 0).getDate();
      setFromDate(start);
      setToDate(`${lastYear}-${mStr}-${String(lastDay).padStart(2, '0')}`);
    } else if (p === 'all_time') {
      setFromDate('2024-01-01');
      setToDate(todayStr);
    }
  };

  const handleApply = () => {
    setAppliedFilters({
      preset,
      fromDate,
      toDate,
      typeFilter,
      channelFilter,
      methodFilter,
      search,
    });
    setPage(1);
  };

  const handleReset = () => {
    const todayStr = formatDateISO(getPKTDate());
    setPreset('today');
    setFromDate(todayStr);
    setToDate(todayStr);
    setTypeFilter('ALL');
    setChannelFilter('ALL');
    setMethodFilter('ALL');
    setSearch('');
    setAppliedFilters({
      preset: 'today',
      fromDate: todayStr,
      toDate: todayStr,
      typeFilter: 'ALL',
      channelFilter: 'ALL',
      methodFilter: 'ALL',
      search: '',
    });
    setPage(1);
  };

  // Query Backend using OPERATING_PROFIT report to get unified transactions (invoices + expenses) + canonical totals
  const { data: queryData, isLoading, error } = useQuery({
    queryKey: ['pharmacy-income-expense-report', appliedFilters.fromDate, appliedFilters.toDate],
    queryFn: async () => {
      const res = await apiClient.get('/reports', {
        params: {
          type: 'OPERATING_PROFIT',
          from: appliedFilters.fromDate ? `${appliedFilters.fromDate}T00:00:00+05:00` : undefined,
          to: appliedFilters.toDate ? `${appliedFilters.toDate}T23:59:59.999+05:00` : undefined,
        },
      });
      return res.data?.data;
    },
    staleTime: 30 * 1000,
  });

  const totals = queryData?.totals;
  const breakdown = queryData?.breakdown;
  const rawInvoices: any[] = queryData?.invoices || [];
  const rawExpenses: any[] = queryData?.expenses || [];

  // Build Unified Ledger Rows
  const allLedgerRows = useMemo<UnifiedLedgerRow[]>(() => {
    const rows: UnifiedLedgerRow[] = [];

    // 1. Invoices
    rawInvoices.forEach((inv) => {
      const net = Number(inv.netBilling || inv.grossSales || 0);
      const col = Number(inv.collections || 0);
      const out = Number(inv.outstanding || 0);

      rows.push({
        id: `inv-${inv.invoiceNumber}`,
        date: inv.createdAt,
        reference: inv.invoiceNumber,
        sourceType: 'INVOICE',
        channel: inv.channel === 'HMS' ? 'HMS' : 'RETAIL',
        description: inv.customerName || (inv.channel === 'HMS' ? 'HMS Inpatient Prescription' : 'Walk-In Customer'),
        income: net,
        collections: col,
        expenses: 0,
        paymentMethod: inv.paymentMethod || (col > 0 ? 'CASH' : 'CREDIT'),
        outstanding: out,
        user: inv.collectedBy || inv.soldBy || 'Staff',
        status: inv.status || 'POSTED',
        raw: inv,
      });
    });

    // 2. Expenses
    rawExpenses.forEach((exp) => {
      const amt = Number(exp.amount || 0);
      rows.push({
        id: `exp-${exp.id || exp.expenseNumber}`,
        date: exp.date || exp.createdAt,
        reference: exp.expenseNumber || 'EXP-GEN',
        sourceType: 'EXPENSE',
        channel: 'EXPENSE',
        description: `${exp.category || 'Operating Expense'}${exp.description ? ` · ${exp.description}` : ''}${exp.payeeOrVendor ? ` (${exp.payeeOrVendor})` : ''}`,
        income: 0,
        collections: 0,
        expenses: amt,
        paymentMethod: exp.paymentMethod || 'CASH',
        outstanding: 0,
        user: exp.enteredBy || exp.approvedBy || 'Staff',
        status: exp.approvedBy ? 'APPROVED' : 'PENDING',
        raw: exp,
      });
    });

    // Sort descending by date
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawInvoices, rawExpenses]);

  // Apply In-Memory Filters (Search, Type, Channel, Method)
  const filteredRows = useMemo(() => {
    return allLedgerRows.filter((r) => {
      // Type Filter
      if (appliedFilters.typeFilter === 'INCOME' && r.income <= 0) return false;
      if (appliedFilters.typeFilter === 'COLLECTION' && r.collections <= 0) return false;
      if (appliedFilters.typeFilter === 'EXPENSE' && r.expenses <= 0) return false;

      // Channel Filter
      if (appliedFilters.channelFilter !== 'ALL' && r.channel !== appliedFilters.channelFilter) return false;

      // Method Filter
      if (appliedFilters.methodFilter !== 'ALL' && !r.paymentMethod.toUpperCase().includes(appliedFilters.methodFilter)) return false;

      // Search Filter
      if (appliedFilters.search.trim()) {
        const q = appliedFilters.search.toLowerCase();
        const matchesRef = r.reference.toLowerCase().includes(q);
        const matchesDesc = r.description.toLowerCase().includes(q);
        const matchesUser = r.user.toLowerCase().includes(q);
        const matchesStatus = r.status.toLowerCase().includes(q);
        if (!matchesRef && !matchesDesc && !matchesUser && !matchesStatus) return false;
      }

      return true;
    });
  }, [allLedgerRows, appliedFilters]);

  // Pagination slice
  const totalRecords = filteredRows.length;
  const totalPages = Math.ceil(totalRecords / limit) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredRows.slice(start, start + limit);
  }, [filteredRows, page, limit]);

  // Dynamic Page-Level Totals for Footer
  const filteredTotals = useMemo(() => {
    let inc = 0;
    let col = 0;
    let exp = 0;
    let out = 0;
    filteredRows.forEach((r) => {
      inc += r.income;
      col += r.collections;
      exp += r.expenses;
      out += r.outstanding;
    });
    return {
      income: inc,
      collections: col,
      expenses: exp,
      netCash: col - exp,
      outstanding: out,
    };
  }, [filteredRows]);

  // Export Handlers
  const handleExport = (format: 'excel' | 'csv' | 'print') => {
    const columns = [
      { header: 'Date & Time', format: (r: UnifiedLedgerRow) => formatDateTime(r.date) },
      { header: 'Reference ID', key: 'reference' },
      { header: 'Type / Channel', key: 'channel' },
      { header: 'Description / Payee', key: 'description' },
      { header: 'Recognized Income (PKR)', format: (r: UnifiedLedgerRow) => (r.income > 0 ? formatPKR(r.income) : '—'), numeric: true },
      { header: 'Actual Collections (PKR)', format: (r: UnifiedLedgerRow) => (r.collections > 0 ? formatPKR(r.collections) : '—'), numeric: true },
      { header: 'Operating Expenses (PKR)', format: (r: UnifiedLedgerRow) => (r.expenses > 0 ? formatPKR(r.expenses) : '—'), numeric: true },
      { header: 'Payment Method', key: 'paymentMethod' },
      { header: 'Outstanding (PKR)', format: (r: UnifiedLedgerRow) => (r.outstanding > 0 ? formatPKR(r.outstanding) : '—'), numeric: true },
      { header: 'Recorded By', key: 'user' },
      { header: 'Status', key: 'status' },
    ];

    const periodLabel = `${appliedFilters.fromDate} to ${appliedFilters.toDate}`;
    const summaryRows = [
      { label: 'Total Recognized Sales / Income', value: formatPKR(totals?.netBilling || filteredTotals.income) },
      { label: 'Actual Collections Received', value: formatPKR(totals?.collections || filteredTotals.collections) },
      { label: 'Operating Expenses', value: formatPKR(totals?.operatingExpenses || filteredTotals.expenses) },
      { label: 'Net Cash Movement (Collections − Expenses)', value: formatPKR((Number(totals?.collections || 0) - Number(totals?.operatingExpenses || 0))) },
      { label: 'Outstanding Receivables', value: formatPKR(totals?.outstanding || filteredTotals.outstanding) },
    ];

    const opts = {
      title: 'Pharmacy Income & Expense Report',
      subtitle: 'Transactional financial ledger of medicine sales, collections, and operating overheads',
      periodLabel,
      userName: currentUser?.fullName || currentUser?.username,
      filename: 'Pharmacy_Income_Expense',
      columns,
      data: filteredRows,
      summaryRows,
    };

    if (format === 'excel') exportToExcel(opts);
    else if (format === 'csv') exportToCSV(opts);
    else if (format === 'print') printFinancialReport(opts);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1700px] mx-auto">
      {/* ── Top Report Switcher Tabs (Management/Admins) ─────────────── */}
      {onNavigate && !isSales && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 -mt-1">
          {ALL_REPORTS_LIST.map((tab) => {
            const isActive = tab.page === 'reports-income-expense';
            return (
              <button
                key={tab.page}
                type="button"
                onClick={() => onNavigate(tab.page)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-[#0f766e] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-[#0f766e]" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pharmacy Income & Expense</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                ERP LEDGER
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Complete transactional ledger of recognized medicine sales, collections, and operating expenses.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('print')}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Financial Summary KPI Banner ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Sales / Income */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Recognized Income</span>
            <DollarSign className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-base font-bold text-slate-900 font-mono">
            {formatPKR(totals?.netBilling ?? filteredTotals.income)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Gross: {formatPKR(totals?.grossSales ?? 0)}
          </div>
        </div>

        {/* Actual Collections */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Actual Collections</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-base font-bold text-emerald-700 font-mono">
            {formatPKR(totals?.collections ?? filteredTotals.collections)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Cash in hand & digital
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Operating Expenses</span>
            <ArrowDownRight className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-base font-bold text-rose-700 font-mono">
            {formatPKR(totals?.operatingExpenses ?? filteredTotals.expenses)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Overhead & operational
          </div>
        </div>

        {/* Net Cash Movement */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Cash Flow</span>
            <TrendingUp className="h-4 w-4 text-[#0f766e]" />
          </div>
          <div className={`text-base font-bold font-mono ${
            (Number(totals?.collections || filteredTotals.collections) - Number(totals?.operatingExpenses || filteredTotals.expenses)) >= 0
              ? 'text-[#0f766e]'
              : 'text-rose-600'
          }`}>
            {formatPKR(Number(totals?.collections ?? filteredTotals.collections) - Number(totals?.operatingExpenses ?? filteredTotals.expenses))}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Collections − Expenses
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Outstanding</span>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-base font-bold text-amber-700 font-mono">
            {formatPKR(totals?.outstanding ?? filteredTotals.outstanding)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Uncollected balance
          </div>
        </div>
      </div>

      {/* ── Compact Filter Bar ──────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Preset */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Period Preset</label>
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value as PeriodPreset)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0f766e]"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPreset('custom');
              }}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0f766e]"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPreset('custom');
              }}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0f766e]"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Transaction Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0f766e]"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Channel Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Channel / Source</label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0f766e]"
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Payment Method</label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0f766e]"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Second Row: Search and Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-200">
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              placeholder="Search reference #, customer, payee, staff..."
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0f766e]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[#0f766e] text-white hover:bg-[#115e59] shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main ERP Financial Table ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-[#0f766e] border-r-transparent" />
            <div className="text-xs font-medium text-slate-500 mt-2">Loading financial transactions...</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs">
            Failed to load Income & Expense data.
          </div>
        ) : paginatedRows.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No transactions found for the selected period and filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 text-left border-r border-slate-200 whitespace-nowrap">Date & Time</th>
                  <th className="py-2.5 px-3 text-left border-r border-slate-200 whitespace-nowrap">Reference #</th>
                  <th className="py-2.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">Channel / Type</th>
                  <th className="py-2.5 px-3 text-left border-r border-slate-200 min-w-[200px]">Description / Customer / Payee</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-200 whitespace-nowrap">Recognized Income</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-200 whitespace-nowrap">Collections</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-200 whitespace-nowrap">Expenses</th>
                  <th className="py-2.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">Method</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-200 whitespace-nowrap">Outstanding</th>
                  <th className="py-2.5 px-3 text-left border-r border-slate-200 whitespace-nowrap">Staff / Collector</th>
                  <th className="py-2.5 px-3 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {paginatedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition">
                    {/* Date */}
                    <td className="py-2 px-3 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                      {formatDateTime(row.date)}
                    </td>

                    {/* Reference */}
                    <td className="py-2 px-3 border-r border-slate-200 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {row.reference}
                    </td>

                    {/* Type / Channel */}
                    <td className="py-2 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                      {row.channel === 'HMS' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          HMS Presc
                        </span>
                      ) : row.channel === 'RETAIL' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                          Retail POS
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Expense
                        </span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-800">
                      <div className="truncate max-w-[260px]" title={row.description}>
                        {row.description}
                      </div>
                    </td>

                    {/* Recognized Income */}
                    <td className="py-2 px-3 text-right border-r border-slate-200 font-mono text-slate-900 whitespace-nowrap">
                      {row.income > 0 ? formatPKR(row.income) : '—'}
                    </td>

                    {/* Collections */}
                    <td className="py-2 px-3 text-right border-r border-slate-200 font-mono font-bold text-emerald-700 whitespace-nowrap">
                      {row.collections > 0 ? formatPKR(row.collections) : '—'}
                    </td>

                    {/* Operating Expenses */}
                    <td className="py-2 px-3 text-right border-r border-slate-200 font-mono font-bold text-rose-700 whitespace-nowrap">
                      {row.expenses > 0 ? formatPKR(row.expenses) : '—'}
                    </td>

                    {/* Payment Method */}
                    <td className="py-2 px-3 text-center border-r border-slate-200 text-[10px] font-medium text-slate-600 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {row.paymentMethod}
                      </span>
                    </td>

                    {/* Outstanding */}
                    <td className="py-2 px-3 text-right border-r border-slate-200 font-mono whitespace-nowrap">
                      {row.outstanding > 0 ? (
                        <span className="text-amber-700 font-semibold">{formatPKR(row.outstanding)}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* User */}
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-700 whitespace-nowrap">
                      {row.user}
                    </td>

                    {/* Action */}
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setDetailRow(row)}
                        className="p-1 rounded text-slate-500 hover:text-[#0f766e] hover:bg-slate-100 cursor-pointer transition"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* ── Sticky Summary Footer Row ──────────────────────── */}
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                  <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider border-r border-slate-200">
                    Totals (Filtered Period)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono border-r border-slate-200 text-slate-900">
                    {formatPKR(filteredTotals.income)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono border-r border-slate-200 text-emerald-800">
                    {formatPKR(filteredTotals.collections)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono border-r border-slate-200 text-rose-800">
                    {formatPKR(filteredTotals.expenses)}
                  </td>
                  <td className="py-2.5 px-3 text-center border-r border-slate-200 text-[10px] text-slate-500 font-normal">
                    Net: {formatPKR(filteredTotals.netCash)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono border-r border-slate-200 text-amber-800">
                    {formatPKR(filteredTotals.outstanding)}
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 text-slate-500 text-[11px] font-normal">
                    {filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ── Pagination Controls ───────────────────────────────────── */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border border-slate-300 rounded p-1 bg-white text-slate-800 text-xs"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries · Page {page} of {totalPages} ({totalRecords} total transactions)</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Transaction Detail Modal ──────────────────────────────────── */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#0f766e]" />
                <h3 className="font-bold text-sm text-slate-900">Transaction Details</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                  {detailRow.reference}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-150">
                <div>
                  <span className="text-slate-500 block text-[11px]">Date & Time</span>
                  <span className="font-medium text-slate-900">{formatDateTime(detailRow.date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Transaction Type</span>
                  <span className="font-semibold text-slate-900">{detailRow.channel}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Description</span>
                  <span className="font-medium text-slate-900">{detailRow.description}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Payment Method</span>
                  <span className="font-medium text-slate-900">{detailRow.paymentMethod}</span>
                </div>
              </div>

              {detailRow.sourceType === 'INVOICE' ? (
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Gross Sales Value:</span>
                    <span className="font-mono font-medium">{formatPKR(detailRow.raw?.grossSales ?? detailRow.income)}</span>
                  </div>
                  {Number(detailRow.raw?.discount || 0) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Discount / Returns:</span>
                      <span className="font-mono">−{formatPKR(detailRow.raw.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
                    <span>Recognized Net Income:</span>
                    <span className="font-mono">{formatPKR(detailRow.income)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Actual Collections Received:</span>
                    <span className="font-mono">{formatPKR(detailRow.collections)}</span>
                  </div>
                  {detailRow.outstanding > 0 && (
                    <div className="flex justify-between text-amber-700 font-semibold border-t border-slate-200 pt-1.5">
                      <span>Remaining Outstanding:</span>
                      <span className="font-mono">{formatPKR(detailRow.outstanding)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Expense Category:</span>
                    <span className="font-semibold text-slate-900">{detailRow.raw?.category || 'Operating Expense'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Payee / Vendor:</span>
                    <span className="font-medium">{detailRow.raw?.payeeOrVendor || '—'}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-rose-700">
                    <span>Approved Expense Amount:</span>
                    <span className="font-mono">{formatPKR(detailRow.expenses)}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] text-slate-500">
                <div>
                  <span>Handled / Recorded By: </span>
                  <strong className="text-slate-800">{detailRow.user}</strong>
                </div>
                <div>
                  <span>Status: </span>
                  <strong className="text-slate-800">{detailRow.status}</strong>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
