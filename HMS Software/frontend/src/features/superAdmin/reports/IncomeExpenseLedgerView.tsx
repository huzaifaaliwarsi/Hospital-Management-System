import { m01SummaryRows } from './m01Summary';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileSpreadsheet,
  Search,
  RotateCcw,
  Eye,
  Filter,
  Calendar,
  AlertCircle,
  Building2,
  User as UserIcon,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Receipt,
  DollarSign,
  HelpCircle,
  X,
} from 'lucide-react';
import { formatPKR, formatDateTimeDDMMYYYY } from '../../../utils/formatters';
import { formatDateISO, getHospitalCurrentDate } from '../../../utils/dateConstants';
import { useAuth } from '../../../context/AuthContext';
import {
  fetchIncomeExpenseLedger,
  fetchManagementFilterOptions,
  EMPTY_MANAGEMENT_OPTIONS,
  IncomeExpenseLedgerRow,
  IncomeExpenseLedgerResponse,
} from '../../../services/managementReportsService';
import { useFilterOptions } from '../../../components/reports/reportFilters';
import { ExportButtonGroup } from '../financeControl/ExportButtonGroup';
import {
  downloadTablePDF,
  downloadTableExcel,
  downloadTableCSV,
  printTable,
  ExportColumn,
} from '../../../services/tableExportService';

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

const PORTAL_TYPES = [
  { value: 'ALL', label: 'All User Types / Portals' },
  { value: 'Billing', label: 'Front Desk / Billing' },
  { value: 'Admin', label: 'Hospital Admin' },
  { value: 'Super Admin', label: 'Super Admin' },
  { value: 'Inventory', label: 'Inventory Management' },
];

const TRANSACTION_TYPES = [
  { value: 'ALL', label: 'All Transaction Types' },
  { value: 'REVENUE', label: 'Earned Hospital Revenue / Billing' },
  { value: 'COLLECTION', label: 'Collections / Receipts' },
  { value: 'EXPENSE', label: 'Approved Operating Expenses' },
  { value: 'CONSUMABLE', label: 'Direct Consumable Costs' },
  { value: 'PAYROLL', label: 'Staff Payroll' },
  { value: 'COMMISSION', label: 'Doctor Commission' },
  { value: 'REFUND', label: 'Refunds / Credits / Reversals' },
  { value: 'SETTLEMENT', label: 'Internal Cash Transfers' },
];

const PAYMENT_METHODS = [
  { value: 'ALL', label: 'All Payment Methods' },
  { value: 'CASH', label: 'Cash Payment' },
  { value: 'CARD', label: 'Debit / Credit Card' },
  { value: 'BANK', label: 'Bank Transfer' },
  { value: 'ONLINE', label: 'Online / Digital Payment' },
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PAID', label: 'Paid' },
  { value: 'COMPLETED', label: 'Completed / Posted' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'UNPAID', label: 'Unpaid / Outstanding' },
  { value: 'REVERSED', label: 'Reversed / Refunded' },
  { value: 'VOID', label: 'Voided' },
];

export const IncomeExpenseLedgerView: React.FC = () => {
  const { currentUser } = useAuth();
  const options = useFilterOptions(fetchManagementFilterOptions, EMPTY_MANAGEMENT_OPTIONS);
  const todayISO = formatDateISO(getHospitalCurrentDate());

  // Filter States - defaults to Today (Asia/Karachi)
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [fromDate, setFromDate] = useState<string>(todayISO);
  const [toDate, setToDate] = useState<string>(todayISO);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [portal, setPortal] = useState<string>('ALL');
  const [portalUserId, setPortalUserId] = useState<string>('');
  const [transactionType, setTransactionType] = useState<string>('ALL');
  const [method, setMethod] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Applied Filters State
  const [appliedFilters, setAppliedFilters] = useState({
    preset: 'today' as PeriodPreset,
    fromDate: todayISO,
    toDate: todayISO,
    departmentId: '',
    portal: 'ALL',
    portalUserId: '',
    transactionType: 'ALL',
    method: 'ALL',
    status: 'ALL',
    search: '',
  });

  // Pagination & Data State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [data, setData] = useState<IncomeExpenseLedgerResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal State
  const [detailRow, setDetailRow] = useState<IncomeExpenseLedgerRow | null>(null);

  // Load report data
  const loadReport = useCallback(
    async (currentPage = page, currentLimit = limit) => {
      setIsLoading(true);
      setError(null);
      try {
        const range = {
          preset: appliedFilters.preset,
          ...(appliedFilters.preset === 'custom'
            ? { fromDate: appliedFilters.fromDate, toDate: appliedFilters.toDate }
            : {}),
        };
        const res = await fetchIncomeExpenseLedger(
          range as any,
          {
            departmentId: appliedFilters.departmentId || undefined,
            portal: appliedFilters.portal !== 'ALL' ? appliedFilters.portal : undefined,
            portalUserId: appliedFilters.portalUserId || undefined,
            transactionType: appliedFilters.transactionType !== 'ALL' ? appliedFilters.transactionType : undefined,
            method: appliedFilters.method !== 'ALL' ? appliedFilters.method : undefined,
            status: appliedFilters.status !== 'ALL' ? appliedFilters.status : undefined,
            search: appliedFilters.search || undefined,
          },
          currentPage,
          currentLimit,
        );
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to load Income & Expense ledger');
      } finally {
        setIsLoading(false);
      }
    },
    [appliedFilters, page, limit],
  );

  useEffect(() => {
    loadReport(page, limit);
  }, [loadReport, page, limit]);

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters({
      preset,
      fromDate,
      toDate,
      departmentId,
      portal,
      portalUserId,
      transactionType,
      method,
      status,
      search,
    });
  };

  const handleResetFilters = () => {
    setPreset('today');
    setFromDate(todayISO);
    setToDate(todayISO);
    setDepartmentId('');
    setPortal('ALL');
    setPortalUserId('');
    setTransactionType('ALL');
    setMethod('ALL');
    setStatus('ALL');
    setSearch('');
    setPage(1);
    setAppliedFilters({
      preset: 'today',
      fromDate: todayISO,
      toDate: todayISO,
      departmentId: '',
      portal: 'ALL',
      portalUserId: '',
      transactionType: 'ALL',
      method: 'ALL',
      status: 'ALL',
      search: '',
    });
  };

  // Export Context & Columns
  const exportColumns = useMemo<ExportColumn<IncomeExpenseLedgerRow>[]>(
    () => [
      { header: 'Reference ID', cell: (r) => r.reference },
      { header: 'Date & Time', cell: (r) => formatDateTimeDDMMYYYY(r.date) },
      { header: 'Transaction Type', cell: (r) => r.typeLabel },
      { header: 'Patient / Payee / Description', cell: (r) => r.patientPayeeDescription },
      { header: 'Department', cell: (r) => r.department },
      { header: 'Status', cell: (r) => r.statusLabel },
      {
        header: 'Gross Bill',
        align: 'right',
        cell: (r) => r.transactionType === 'REVENUE' ? formatPKR(r.grossBilling) : 'N/A',
        excelValue: (r) => r.transactionType === 'REVENUE' ? r.grossBilling : 'N/A',
      },
      {
        header: 'Received / Paid',
        align: 'right',
        cell: (r) => {
          if (r.transactionType === 'SETTLEMENT') {
            if (r.cashIn > 0) return `+${formatPKR(r.cashIn)}`;
            if (r.cashOut > 0) return `-${formatPKR(r.cashOut)}`;
            return 'Net 0.00';
          }
          if (r.collectionsReceived > 0) return `+${formatPKR(r.collectionsReceived)}`;
          if (r.collectionsReceived < 0) return `-${formatPKR(Math.abs(r.collectionsReceived))}`;
          if (r.expensePaid > 0) return `-${formatPKR(r.expensePaid)}`;
          if (r.cashIn > 0) return `+${formatPKR(r.cashIn)}`;
          if (r.cashOut > 0) return `-${formatPKR(r.cashOut)}`;
          return '—';
        },
        excelValue: (r) => {
          if (r.transactionType === 'SETTLEMENT') {
            return (r.cashIn || 0) - (r.cashOut || 0);
          }
          return r.collectionsReceived !== 0 ? r.collectionsReceived : (r.cashIn || 0) - (r.expensePaid || r.cashOut || 0);
        },
      },
      {
        header: 'Outstanding',
        align: 'right',
        cell: (r) => formatPKR(r.outstandingPayable),
        excelValue: (r) => r.outstandingPayable || 0,
      },
      { header: 'Payment Method', cell: (r) => r.paymentMethod || '—' },
    ],
    [],
  );

  const exportContext = useMemo(() => {
    return {
      documentTitle: 'Income & Expense Ledger (M01)',
      documentSubtitle: 'Consolidated Hospital Revenue, Collections, Operating Expenses and Cash Reconciliation',
      filenamePrefix: 'Income_Expense_Ledger',
      columns: exportColumns,
      rows: data?.items || [],
      currentUser,
      periodLabel: data?.period?.label || 'Today',
      filters: [
        `Period: ${appliedFilters.preset}`,
        appliedFilters.departmentId ? `Department: ${options.departments.find((d) => d.value === appliedFilters.departmentId)?.label || 'Selected'}` : 'Department: All',
        appliedFilters.transactionType !== 'ALL' ? `Type: ${appliedFilters.transactionType}` : 'Type: All',
        appliedFilters.method !== 'ALL' ? `Method: ${appliedFilters.method}` : 'Method: All',
      ],
    };
  }, [exportColumns, data, currentUser, appliedFilters, options]);

  const handleExport = async (kind: 'excel' | 'csv' | 'pdf' | 'print') => {
    try {
      const range = { preset: appliedFilters.preset, ...(appliedFilters.preset === 'custom' ? { fromDate: appliedFilters.fromDate, toDate: appliedFilters.toDate } : {}) };
      const filters = Object.fromEntries(Object.entries(appliedFilters).filter(([key, value]) => !['preset', 'fromDate', 'toDate'].includes(key) && value && value !== 'ALL'));
      const report = await fetchIncomeExpenseLedger(range as any, filters, 1, 500, true);
      const context = { ...exportContext, rows: report.items, periodLabel: report.period.label,
        minimalSummary: true,
        summaryRows: m01SummaryRows(report.totals).map(({ label, value }) => ({ label, value })),
      };
      ({ excel: downloadTableExcel, csv: downloadTableCSV, pdf: downloadTablePDF, print: printTable })[kind](context);
    } catch (err: any) { setError(err.message || 'Export failed'); }
  };

  // Clean Number Formatter without repetitive prefix (Matching Salon ERP standard)
  const formatNum = (val: number | string | null | undefined) =>
    formatPKR(Number(val) === 0 ? 0 : val, { showPrefix: Number(val) === 0 });

  // Value Display Helpers for 12 ERP Columns
  const getGrossBillContent = (r: IncomeExpenseLedgerRow) => {
    if (r.transactionType === 'REVENUE') {
      return <span className="font-mono font-semibold text-slate-900">{formatNum(r.grossBilling)}</span>;
    }
    return <span className="text-slate-500">N/A</span>;
  };

  const getReceivedPaidContent = (r: IncomeExpenseLedgerRow) => {
    if (r.transactionType === 'SETTLEMENT') {
      if (r.cashIn > 0) {
        return <span className="font-mono font-semibold text-emerald-600">+{formatNum(r.cashIn)}</span>;
      }
      if (r.cashOut > 0) {
        return <span className="font-mono font-semibold text-rose-600">-{formatNum(r.cashOut)}</span>;
      }
      const handover = r.details?.handoverAmount || 0;
      return (
        <span
          className="font-mono font-medium text-slate-500 text-[11px]"
          title="Internal Cash Custody Handover — Net Zero at Hospital Level"
        >
          {handover > 0 ? `Net 0.00 (±${formatNum(handover)})` : 'Net 0.00'}
        </span>
      );
    }
    if (r.collectionsReceived > 0) {
      return <span className="font-mono font-semibold text-emerald-600">+{formatNum(r.collectionsReceived)}</span>;
    }
    if (r.collectionsReceived < 0) {
      return <span className="font-mono font-semibold text-rose-600">-{formatNum(Math.abs(r.collectionsReceived))}</span>;
    }
    if (r.expensePaid > 0) {
      return <span className="font-mono font-semibold text-rose-600">-{formatNum(r.expensePaid)}</span>;
    }
    if (r.cashIn > 0) {
      return <span className="font-mono font-semibold text-emerald-600">+{formatNum(r.cashIn)}</span>;
    }
    if (r.cashOut > 0) {
      return <span className="font-mono font-semibold text-rose-600">-{formatNum(r.cashOut)}</span>;
    }
    return <span className="text-slate-300 font-mono font-normal">—</span>;
  };

  const getOutstandingContent = (r: IncomeExpenseLedgerRow) => {
    if (r.outstandingPayable > 0) {
      return <span className="font-mono font-semibold text-amber-600">{formatNum(r.outstandingPayable)}</span>;
    }
    return <span className="text-slate-400 font-mono font-normal">{formatNum(0)}</span>;
  };

  // Semantic Pure Text Formatters (Clean ERP Typography — NO Boxes or Pill Badges)
  const renderTransactionType = (type: string, label: string) => {
    switch (type) {
      case 'REVENUE':
        return <span className="font-bold text-emerald-700">{label}</span>;
      case 'COLLECTION':
        return <span className="font-bold text-teal-700">{label}</span>;
      case 'EXPENSE':
        return <span className="font-bold text-amber-700">{label}</span>;
      case 'PAYROLL':
        return <span className="font-bold text-purple-700">{label}</span>;
      case 'COMMISSION':
        return <span className="font-bold text-indigo-700">{label}</span>;
      case 'CONSUMABLE':
        return <span className="font-bold text-slate-600">{label}</span>;
      case 'REFUND':
        return <span className="font-bold text-rose-700">{label}</span>;
      case 'SETTLEMENT':
        return <span className="font-bold text-slate-600">{label}</span>;
      default:
        return <span className="font-bold text-slate-700">{label}</span>;
    }
  };

  const renderStatus = (statusStr: string, label: string) => {
    switch (statusStr.toUpperCase()) {
      case 'PAID':
      case 'COMPLETED':
      case 'APPROVED':
      case 'ACCEPTED':
        return <span className="font-bold text-emerald-600">{label}</span>;
      case 'PARTIALLY_PAID':
      case 'PARTIAL':
        return <span className="font-bold text-amber-600">{label}</span>;
      case 'UNPAID':
      case 'DRAFT':
        return <span className="font-semibold text-slate-400">{label}</span>;
      case 'REVERSED':
      case 'VOID':
        return <span className="font-bold text-rose-600">{label}</span>;
      default:
        return <span className="font-semibold text-slate-500">{label}</span>;
    }
  };

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Income & Expense</h1>
            <span className="px-2 py-0.5 rounded text-[10.5px] font-bold tracking-wide uppercase bg-emerald-50 text-[#08775A] border border-emerald-200">
              Accrual &amp; Cash
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Consolidated hospital revenue, collections, recognized expenses, payments and outstanding balances.
          </p>
        </div>
      </div>

      {/* ── Advanced Filter Panel (Salon Layout Structure + HMS Styling) ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
          <Filter className="h-3.5 w-3.5 text-[#08775A]" />
          <span>Advanced Ledger Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* 1. Period Preset */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Period</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as PeriodPreset)}
              className="w-full h-8.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. From Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              disabled={preset !== 'custom'}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-8.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            />
          </div>

          {/* 3. To Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              disabled={preset !== 'custom'}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-8.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            />
          </div>

          {/* 4. Hospital Department */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full h-8.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              <option value="">All Departments</option>
              {options.departments.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* 5. User Type / Portal */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">User Type / Portal</label>
            <select
              value={portal}
              onChange={(e) => setPortal(e.target.value)}
              className="w-full h-8.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              {PORTAL_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 6. User */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">User / Actor</label>
            <select
              value={portalUserId}
              onChange={(e) => setPortalUserId(e.target.value)}
              className="w-full h-8.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              <option value="">All Users</option>
              {options.users.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          {/* 7. Transaction Type */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Transaction Type</label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className="w-full h-8.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              {TRANSACTION_TYPES.map((tt) => (
                <option key={tt.value} value={tt.value}>
                  {tt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 8. Payment Method */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full h-8.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.value} value={pm.value}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          {/* 9. Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-8.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              {STATUS_OPTIONS.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="flex-1 h-8.5 px-2 rounded-lg bg-[#08775A] hover:bg-[#065f46] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Apply</span>
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset all filters"
              className="h-8.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center transition-colors cursor-pointer shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── ERP Table Container Card ── */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
        {/* Table Subheader Bar */}
        <div className="p-3.5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/80">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Income &amp; Expense Ledger</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
              {data?.totalRecords ?? 0} records
            </span>
            <span className="text-xs text-slate-500 font-medium border-l border-slate-200 pl-2.5">
              Period: <span className="font-semibold text-slate-700">{data?.period?.label ?? 'Today'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search reference, patient, payee…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                className="w-64 h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              />
            </div>

            {/* Export Buttons */}
            <ExportButtonGroup
              disabled={!data || data.items.length === 0}
              onExcel={() => handleExport('excel')}
              onCsv={() => handleExport('csv')}
              onPdf={() => handleExport('pdf')}
              onPrint={() => handleExport('print')}
            />
          </div>
        </div>

        {/* Table View */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
            <div className="h-8 w-8 border-2 border-[#08775A] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">Loading daily income &amp; expense transactions…</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-800">{error}</p>
            <button
              onClick={() => loadReport(page, limit)}
              className="mt-3 text-xs text-[#08775A] font-bold hover:underline"
            >
              Retry
            </button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-20 text-center">
            <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No transactions found for the selected filters.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting the period, department, or transaction type.</p>
          </div>
        ) : (
          <div className="w-full min-w-0 max-w-full overflow-x-auto" role="region" aria-label="Income and expense transactions" tabIndex={0}>
            <table className="w-full min-w-[1430px] table-fixed border-collapse text-left text-xs [&_td]:align-middle [&_th]:align-middle [&_th]:whitespace-normal [&_th]:break-normal [&_th]:leading-4">
              <colgroup>
                {[44, 160, 130, 160, 220, 150, 110, 110, 120, 110, 110, 44].map((width, i) => <col key={i} style={{ width }} />)}
              </colgroup>
              <thead>
                <tr className="bg-[#f1f5f9] border-b border-slate-300 text-slate-800 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 whitespace-nowrap">
                  <th className="w-12 py-2.5 px-3 text-center border-r border-slate-300 font-bold text-slate-700">#</th>
                  <th className="py-2.5 px-3 text-left border-r border-slate-300">Date &amp; Time</th>
                  <th className="py-2.5 px-3 text-left border-r border-slate-300">Reference ID</th>
                  <th className="py-2.5 px-3 text-left border-r border-slate-300 ">Transaction Type</th>
                  <th className="py-2.5 px-2 text-left border-r border-slate-300 ">Patient / Payee / Description</th>
                  <th className="py-2.5 px-3 text-left border-r border-slate-300 ">Department</th>
                  <th className="py-2.5 px-3 text-left border-r border-slate-300">Status</th>
                  <th className="py-2.5 px-2 text-right border-r border-slate-300">Gross Bill</th>
                  <th className="py-2.5 px-2 text-right border-r border-slate-300">Received / Paid</th>
                  <th className="py-2.5 px-2 text-right border-r border-slate-300">Outstanding</th>
                  <th className="py-2.5 px-3 text-left border-r border-slate-300">Payment Method</th>
                  <th className="py-2.5 px-2.5 text-center w-12">View</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 font-medium">
                {data.items.map((r, idx) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-200 hover:bg-slate-50/90 transition-colors cursor-pointer text-slate-800 last:border-b-0"
                    onClick={() => setDetailRow(r)}
                  >
                    <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/60 whitespace-nowrap">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap font-mono text-slate-700 text-[11.5px] border-r border-slate-200">
                      {formatDateTimeDDMMYYYY(r.date)}
                    </td>
                    <td className="py-2.5 px-2 whitespace-normal font-mono font-semibold text-[#08775A] text-[11.5px] hover:underline border-r border-slate-200">
                      {r.reference}
                    </td>
                    <td className="py-2.5 px-2 whitespace-normal text-xs border-r border-slate-200">
                      {renderTransactionType(r.transactionType, r.typeLabel)}
                    </td>
                    <td className="py-2.5 px-2 max-w-[240px] truncate border-r border-slate-200 overflow-hidden" title={r.patientPayeeDescription}>
                      <div className="font-bold text-slate-900 text-xs truncate block">{r.patientPayeeDescription}</div>
                      {r.encounterInvoiceRef && (
                        <div className="text-[10.5px] text-slate-400 font-normal mt-0.5 truncate block">{r.encounterInvoiceRef}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 whitespace-normal text-slate-700 text-xs border-r border-slate-200 truncate max-w-[150px]" title={r.department}>
                      {r.department}
                    </td>
                    <td className="py-2.5 px-2 whitespace-normal text-xs border-r border-slate-200">
                      {renderStatus(r.status, r.statusLabel)}
                    </td>
                    <td className="py-2.5 px-2 text-right whitespace-nowrap text-xs font-mono font-semibold border-r border-slate-200">
                      {getGrossBillContent(r)}
                    </td>
                    <td className="py-2.5 px-2 text-right whitespace-nowrap text-xs font-mono font-semibold border-r border-slate-200">
                      {getReceivedPaidContent(r)}
                    </td>
                    <td className="py-2.5 px-2 text-right whitespace-nowrap text-xs font-mono font-semibold border-r border-slate-200">
                      {getOutstandingContent(r)}
                    </td>
                    <td className="py-2.5 px-2 whitespace-normal text-slate-700 text-xs border-r border-slate-200">
                      {r.paymentMethod || '—'}
                    </td>
                    <td className="py-2.5 px-2.5 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailRow(r);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-[#08775A] hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* ── Table Column-Wise Totals Row ── */}
              <tfoot>
                <tr className="bg-[#f1f5f9] font-bold text-slate-900 border-t-2 border-slate-300 text-xs whitespace-nowrap sticky bottom-0">
                  <td colSpan={7} className="py-2.5 px-2 text-right uppercase tracking-wider text-slate-700 text-[10.5px] font-bold border-r border-slate-300">
                    Matching Report Rows:
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 border-r border-slate-300">
                    {formatNum(data.columnTotals.grossBilling)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold border-r border-slate-300">
                    {(() => {
                      const netMovement = data.columnTotals.collectionsReceived - data.columnTotals.expensePaid;
                      return (
                        <span className={netMovement >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {netMovement >= 0 ? '+' : ''}
                          {formatNum(netMovement)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-amber-700 border-r border-slate-300">
                    {formatNum(data.columnTotals.outstandingPayable)}
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 text-center text-slate-400 font-normal">
                    —
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* M01 cash summary: four rows, using the existing server totals. */}
        {data && (
          <table className="w-full border-collapse bg-white text-xs" aria-label="Income and expense footer">
            <tbody>{m01SummaryRows(data.totals).map(row => (
              <tr key={row.label} className={row.emphasis === 'cash' ? 'bg-emerald-50 text-[#08775A]' : 'text-slate-700'}>
                <th scope="row" className="border border-slate-200 px-4 py-2 text-left font-semibold">{row.label}</th>
                <td className="w-48 whitespace-nowrap border border-slate-200 px-4 py-2 text-right font-mono font-bold tabular-nums">{formatPKR(row.value)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}

        {/* ── Pagination Footer Bar (Default 25 Rows) ── */}
        {data && data.totalRecords > 0 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-7 px-2 rounded border border-slate-200 bg-white font-semibold text-slate-800"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <span>records per page</span>
            </div>

            <div className="flex items-center gap-2">
              <span>
                Page <span className="font-bold text-slate-800">{page}</span> of{' '}
                <span className="font-bold text-slate-800">{data.totalPages}</span> ({data.totalRecords} total items)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 w-7 rounded border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  className="h-7 w-7 rounded border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Transaction Row Detail Modal ── */}
      {detailRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-4xl w-full overflow-hidden animate-in fade-in duration-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Transaction Details:</span>
                  <span className="text-[#08775A]">{detailRow.reference}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{detailRow.typeLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Date &amp; Time</span>
                  <span className="font-semibold text-slate-800">{formatDateTimeDDMMYYYY(detailRow.date)}</span>
                </div>
                <div>
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                  <div>{renderStatus(detailRow.status, detailRow.statusLabel)}</div>
                </div>
                <div>
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Patient / Payee</span>
                  <span className="font-semibold text-slate-800">{detailRow.patientPayeeDescription}</span>
                </div>
                <div>
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Encounter / Reference</span>
                  <span className="font-semibold text-slate-800">{detailRow.encounterInvoiceRef}</span>
                </div>
                <div>
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Department</span>
                  <span className="font-semibold text-slate-800">{detailRow.department}</span>
                </div>
                <div>
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Responsible User</span>
                  <span className="font-semibold text-slate-800">{detailRow.portalUser}</span>
                </div>
              </div>

              {/* Financial Breakdowns */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block pb-1 border-b border-slate-200">
                  Financial Breakdown
                </span>
                {detailRow.grossBilling > 0 && (
                  <div className="flex justify-between">
                    <span>Gross Billing:</span>
                    <span className="font-semibold">{formatPKR(detailRow.grossBilling)}</span>
                  </div>
                )}
                {detailRow.discountCredit > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount / Credit:</span>
                    <span className="font-semibold">-{formatPKR(detailRow.discountCredit)}</span>
                  </div>
                )}
                {detailRow.tax > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Applicable Tax:</span>
                    <span>{formatPKR(detailRow.tax)}</span>
                  </div>
                )}
                {detailRow.netRevenue > 0 && (
                  <div className="flex justify-between font-bold text-[#08775A] border-t border-slate-200 pt-1">
                    <span>Net Earned Revenue:</span>
                    <span>{formatPKR(detailRow.netRevenue)}</span>
                  </div>
                )}
                {detailRow.collectionsReceived !== 0 && (
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>Collections Received:</span>
                    <span>{formatPKR(detailRow.collectionsReceived)}</span>
                  </div>
                )}
                {detailRow.recognizedExpense > 0 && (
                  <div className="flex justify-between font-bold text-amber-900">
                    <span>Recognized Expense / Cost:</span>
                    <span>{formatPKR(detailRow.recognizedExpense)}</span>
                  </div>
                )}
                {detailRow.expensePaid > 0 && (
                  <div className="flex justify-between">
                    <span>Expense Actually Paid:</span>
                    <span className="font-semibold">{formatPKR(detailRow.expensePaid)}</span>
                  </div>
                )}
                {detailRow.transactionType === 'SETTLEMENT' && (
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>Internal Handover Amount:</span>
                    <span>{formatPKR(detailRow.details?.handoverAmount || 0)}</span>
                  </div>
                )}
                {detailRow.cashIn > 0 && (
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>Physical Cash IN:</span>
                    <span>+{formatPKR(detailRow.cashIn)}</span>
                  </div>
                )}
                {detailRow.cashOut > 0 && (
                  <div className="flex justify-between font-bold text-rose-700">
                    <span>Physical Cash OUT:</span>
                    <span>-{formatPKR(detailRow.cashOut)}</span>
                  </div>
                )}
                {detailRow.transactionType === 'SETTLEMENT' && detailRow.cashIn === 0 && detailRow.cashOut === 0 && (
                  <div className="flex justify-between text-slate-500 italic">
                    <span>Hospital-Wide Impact:</span>
                    <span className="font-semibold text-slate-700 not-italic">Net PKR 0.00 (Custody Transfer)</span>
                  </div>
                )}
                {detailRow.outstandingPayable > 0 && (
                  <div className="flex justify-between font-bold text-amber-800">
                    <span>Remaining Outstanding / Payable:</span>
                    <span>{formatPKR(detailRow.outstandingPayable)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 border-t border-slate-200 pt-1">
                  <span>Payment Method:</span>
                  <span className="font-semibold text-slate-800">{detailRow.paymentMethod}</span>
                </div>
              </div>

              {detailRow.details?.invoiceId && <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-3 border border-slate-200 p-3">
                  <span>Service Type: <strong>{detailRow.details.serviceType}</strong></span>
                  <span>Doctor: <strong>{detailRow.details.doctor}</strong></span>
                  <span>Invoice Date: {formatDateTimeDDMMYYYY(detailRow.details.invoiceDate)}</span>
                  <span>Cutoff: {formatDateTimeDDMMYYYY(detailRow.details.cutoff)}</span>
                  <span>Net Invoice Amount: {formatPKR(detailRow.details.netInvoiceAmount)}</span>
                  <span>Total Applied Payments: {formatPKR(detailRow.details.totalAppliedPayments)}</span>
                  <span>Outstanding as of Cutoff: {formatPKR(detailRow.outstandingPayable)}</span>
                  <span>Collection Portal: {detailRow.portal}</span>
                </div>
                <h3 className="font-bold text-slate-700">Payment History ? through selected cutoff</h3>
                <table className="w-full border-collapse text-[11px]">
                  <thead className="bg-slate-100"><tr>{['Receipt No.', 'Date', 'Method', 'Applied Amount', 'Collected By', 'Status'].map(h => <th key={h} className="border border-slate-200 p-2 text-left">{h}</th>)}</tr></thead>
                  <tbody>{detailRow.details.payments.map((p: any) => <tr key={p.id}>
                    <td className="border p-2">{p.reference}</td><td className="border p-2">{formatDateTimeDDMMYYYY(p.date)}</td><td className="border p-2">{p.method}</td>
                    <td className="border p-2 text-right">{formatPKR(p.amount)}</td><td className="border p-2">{p.collectedBy}</td><td className="border p-2">{p.status}</td>
                  </tr>)}</tbody>
                </table>
              </div>}

              {detailRow.details?.history && <div className="space-y-2">
                <p>Approved By: {detailRow.details.approvedBy || 'Unassigned'} ? {detailRow.details.approvedAt ? formatDateTimeDDMMYYYY(detailRow.details.approvedAt) : 'N/A'}</p>
                <h3 className="font-bold">Payment / Approval History</h3>
                <table className="w-full border-collapse"><thead><tr>{['Reference', 'Date', 'Method', 'Paid', 'Actor ID'].map(h => <th className="border p-2 text-left" key={h}>{h}</th>)}</tr></thead>
                  <tbody>{detailRow.details.history.map((p: any) => <tr key={p.reference}><td className="border p-2">{p.reference}</td><td className="border p-2">{formatDateTimeDDMMYYYY(p.date)}</td><td className="border p-2">{p.method}</td><td className="border p-2 text-right">{formatPKR(p.amount)}</td><td className="border p-2">{p.actor}</td></tr>)}</tbody>
                </table>
              </div>}
              {/* Line Items If available */}
              {detailRow.details?.lines && detailRow.details.lines.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Service Line Items</span>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-1.5 px-2 text-left">Item / Service</th>
                          <th className="py-1.5 px-2 text-left">Department</th>
                          <th className="py-1.5 px-2 text-right">Qty</th><th className="py-1.5 px-2 text-right">Historical Rate</th><th className="py-1.5 px-2 text-right">Gross</th><th className="py-1.5 px-2 text-right">Discount</th><th className="py-1.5 px-2 text-right">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailRow.details.lines.map((l: any, i: number) => (
                          <tr key={i}>
                            <td className="py-1.5 px-2 font-medium">{l.name}</td>
                            <td className="py-1.5 px-2 text-slate-500">{l.department || '—'}</td>
                            <td className="py-1.5 px-2 text-right">{l.quantity}</td><td className="py-1.5 px-2 text-right">{formatPKR(l.rate)}</td><td className="py-1.5 px-2 text-right">{formatPKR(l.gross)}</td><td className="py-1.5 px-2 text-right">{formatPKR(l.discount)}</td><td className="py-1.5 px-2 text-right font-bold text-slate-800">{formatPKR(l.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
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
