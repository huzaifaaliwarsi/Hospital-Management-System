import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BarChart2,
  Loader2,
  AlertCircle,
  Wallet,
  Tag,
  RotateCcw,
  FileSpreadsheet,
  RefreshCw,
  Banknote,
  CreditCard,
  Receipt,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Building2,
  Landmark,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { formatPKR } from '../../../utils/formatters';
import {
  fetchFrontDeskBillingReport,
  FrontDeskBillingReport,
  DatePreset,
} from '../../../services/frontdeskBillingReportService';
import { formatDateISO, getHospitalCurrentDate } from '../../../utils/dateConstants';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from '../../../context/RouterContext';
import {
  downloadTablePDF,
  downloadTableExcel,
  downloadTableCSV,
  printTable,
  ExportColumn,
} from '../../../services/tableExportService';
import { ExportButtonGroup } from '../../superAdmin/financeControl/ExportButtonGroup';

const PRESET_OPTIONS: { label: string; value: DatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Custom Range', value: 'custom' },
];

interface ExportRow {
  category: string;
  metric: string;
  detail: string;
  amountOrCount: string;
}

const EXPORT_COLUMNS: ExportColumn<ExportRow>[] = [
  { header: 'Category', cell: (r) => r.category },
  { header: 'Metric / Channel', cell: (r) => r.metric },
  { header: 'Details / Type', cell: (r) => r.detail },
  { header: 'Value / Amount', align: 'right', cell: (r) => r.amountOrCount },
];

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  PAID: { label: 'Paid in Full', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  PARTIALLY_PAID: { label: 'Partially Paid', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  UNPAID: { label: 'Unpaid / Pending', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  VOID: { label: 'Void / Cancelled', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
};

/**
 * Front Desk / Billing Reports — Re-architected with modern Hospital ERP aesthetics:
 * - Clean title & quick export toolbar (Excel, CSV, PDF, Print)
 * - Hospital green gradient banner (#0a4636 -> #08775A)
 * - Active pill filter selectors & custom date pickers
 * - 6 primary KPI metric cards with financial indicators
 * - Dual side-by-side bordered tables (Collections by Channel vs Invoice Mix)
 * - Financial Turnover & Billing Reconciliation Summary grid
 * - Quick drill-down shortcuts to operational sub-registers
 */
export const FrontDeskBillingReportsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { navigate } = useRouter();
  const todayISO = formatDateISO(getHospitalCurrentDate());

  const [preset, setPreset] = useState<DatePreset>('today');
  const [fromDate, setFromDate] = useState(todayISO);
  const [toDate, setToDate] = useState(todayISO);
  const [report, setReport] = useState<FrontDeskBillingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchFrontDeskBillingReport({
        preset,
        fromDate: preset === 'custom' ? fromDate : undefined,
        toDate: preset === 'custom' ? toDate : undefined,
      });
      setReport(data);
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load report.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [preset, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  // Derived financial metrics
  const totalCollections = report?.collections.total ?? 0;
  const cashCollections = report?.collections.byMethod.CASH ?? 0;
  const nonCashCollections = totalCollections - cashCollections;
  const totalGross = report?.billing.totalGross ?? 0;
  const totalDiscounts = report?.billing.totalDiscounts ?? 0;
  const totalNet = report?.billing.totalNet ?? 0;
  const totalOutstanding = report?.billing.totalOutstanding ?? 0;
  const totalRefunds = report?.refunds.total ?? 0;
  const totalInvoices = report?.billing.invoiceCount ?? 0;
  const netIntake = totalCollections - totalRefunds;

  const discountRate = totalGross > 0 ? ((totalDiscounts / totalGross) * 100).toFixed(1) : '0.0';
  const collectionRate = totalNet > 0 ? Math.min(100, Math.round((totalCollections / totalNet) * 100)) : 0;

  // Flattened export rows for Excel / CSV / PDF
  const exportRows: ExportRow[] = useMemo(() => {
    if (!report) return [];
    const rows: ExportRow[] = [
      { category: 'Financial Summary', metric: 'Gross Billed', detail: 'Gross charges before discount', amountOrCount: formatPKR(totalGross) },
      { category: 'Financial Summary', metric: 'Total Discounts', detail: `${discountRate}% concession rate`, amountOrCount: formatPKR(totalDiscounts) },
      { category: 'Financial Summary', metric: 'Net Billed', detail: 'Gross billed minus discounts', amountOrCount: formatPKR(totalNet) },
      { category: 'Financial Summary', metric: 'Realized Collections', detail: 'Total payments collected', amountOrCount: formatPKR(totalCollections) },
      { category: 'Financial Summary', metric: 'Total Refunds', detail: 'Refunds and reversals', amountOrCount: formatPKR(totalRefunds) },
      { category: 'Financial Summary', metric: 'Net Hospital Intake', detail: 'Collections minus refunds', amountOrCount: formatPKR(netIntake) },
      { category: 'Financial Summary', metric: 'Outstanding Receivables', detail: 'Unpaid / partially paid balances', amountOrCount: formatPKR(totalOutstanding) },
      { category: 'Payment Methods', metric: 'Cash Collections', detail: 'Physical counter cash', amountOrCount: formatPKR(report.collections.byMethod.CASH) },
      { category: 'Payment Methods', metric: 'Debit / Credit Card', detail: 'POS machine receipts', amountOrCount: formatPKR(report.collections.byMethod.CARD) },
      { category: 'Payment Methods', metric: 'Direct Bank Transfer', detail: 'Hospital bank accounts', amountOrCount: formatPKR(report.collections.byMethod.BANK) },
      { category: 'Payment Methods', metric: 'Online / Gateway', detail: 'Mobile wallet & gateway', amountOrCount: formatPKR(report.collections.byMethod.ONLINE) },
    ];

    Object.entries(report.billing.invoiceCountsByStatus).forEach(([status, count]) => {
      rows.push({
        category: 'Invoice Status',
        metric: status,
        detail: 'Invoice count distribution',
        amountOrCount: `${count} invoices`,
      });
    });

    return rows;
  }, [report, totalGross, totalDiscounts, totalNet, totalCollections, totalRefunds, netIntake, totalOutstanding, discountRate]);

  const exportContext = {
    documentTitle: 'Front Desk / Billing Reports',
    documentSubtitle: `Hospital Billing & Collections Overview — ${report?.period.label || 'Selected Period'}`,
    filenamePrefix: 'Billing_Summary_Report',
    columns: EXPORT_COLUMNS,
    rows: exportRows,
    currentUser,
    periodLabel: report?.period.label,
    filters: [
      `Period: ${report?.period.label || preset}`,
      `Total Collections: ${formatPKR(totalCollections)}`,
      `Net Billed: ${formatPKR(totalNet)}`,
      `Outstanding: ${formatPKR(totalOutstanding)}`,
    ],
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* 1. Top Header with Title and Export Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Front Desk / Billing Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Hospital billing turnover, live collections, discounts, refunds, and invoice status distribution.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ExportButtonGroup
            disabled={!report || isLoading}
            onExcel={() => downloadTableExcel(exportContext)}
            onCsv={() => downloadTableCSV(exportContext)}
            onPdf={() => downloadTablePDF(exportContext)}
            onPrint={() => printTable(exportContext)}
          />

          <button
            type="button"
            onClick={() => load(true)}
            disabled={isRefreshing || isLoading}
            className="h-7.5 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
            title="Refresh billing report"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Date Preset Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Period:</span>
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPreset(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                preset === opt.value
                  ? 'bg-[#08775A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">From:</span>
              <input
                type="date"
                lang="en-GB"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">To:</span>
              <input
                type="date"
                lang="en-GB"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              />
            </div>
            <button
              type="button"
              onClick={() => load()}
              className="h-8 px-3 rounded-lg bg-[#08775A] text-white text-xs font-semibold hover:bg-[#065f46] transition-colors cursor-pointer shadow-xs"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* 3. Error / Loading / Content States */}
      {loadError ? (
        <div className="bg-white rounded-xl border border-rose-200 p-8 flex flex-col items-center gap-2.5 text-center shadow-xs">
          <AlertCircle className="h-7 w-7 text-rose-500" />
          <p className="text-sm text-rose-700 font-semibold">{loadError}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-1 px-4 py-2 bg-[#08775A] text-white text-xs font-semibold rounded-lg hover:bg-[#065f46] transition-colors cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3 text-slate-400 shadow-xs">
          <Loader2 className="h-6 w-6 animate-spin text-[#08775A]" />
          <span className="text-xs font-medium">Aggregating hospital billing report…</span>
        </div>
      ) : report ? (
        <>
          {/* Distinctive Dark Theme Banner (matching reference UI) */}
          <div className="bg-gradient-to-r from-[#0a4636] to-[#08775A] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide text-white">
              <div className="h-6 w-6 rounded bg-white/15 text-white flex items-center justify-center">
                <BarChart2 className="h-3.5 w-3.5" />
              </div>
              <span>Front Desk / Billing Summary — Financial Turnover &amp; Reconciliation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-100 font-medium bg-white/10 px-2.5 py-0.5 rounded-md">
                Period: {report.period.label}
              </span>
              <span className="hidden sm:inline-block text-[11px] text-emerald-200 font-mono">
                {totalInvoices} invoice{totalInvoices === 1 ? '' : 's'} raised
              </span>
            </div>
          </div>

          {/* 4. Primary KPI Metric Cards (6 Cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Total Collections */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between text-emerald-700 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Collections</span>
                <div className="h-6 w-6 rounded-md bg-emerald-50 flex items-center justify-center">
                  <Wallet className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-emerald-700 leading-tight">
                {formatPKR(totalCollections)}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[10.5px] text-slate-500">
                <span className="font-semibold text-slate-700">Cash:</span>
                <span>{formatPKR(cashCollections)}</span>
              </div>
            </div>

            {/* Gross Billed */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between text-slate-600 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Gross Billed</span>
                <div className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center">
                  <Receipt className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-slate-900 leading-tight">
                {formatPKR(totalGross)}
              </p>
              <p className="text-[10.5px] text-slate-400 mt-1.5 truncate">Total patient charges</p>
            </div>

            {/* Total Discounts */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between text-amber-700 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Discounts</span>
                <div className="h-6 w-6 rounded-md bg-amber-50 flex items-center justify-center">
                  <Tag className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-amber-700 leading-tight">
                {formatPKR(totalDiscounts)}
              </p>
              <p className="text-[10.5px] text-amber-600 font-medium mt-1.5">
                {discountRate}% concession rate
              </p>
            </div>

            {/* Net Billed */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-[#08775A]/40 transition-colors">
              <div className="flex items-center justify-between text-[#08775A] mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Net Billed</span>
                <div className="h-6 w-6 rounded-md bg-[#effaf5] flex items-center justify-center">
                  <CreditCard className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-[#08775A] leading-tight">
                {formatPKR(totalNet)}
              </p>
              <p className="text-[10.5px] text-slate-500 mt-1.5">Gross minus discounts</p>
            </div>

            {/* Total Refunds */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-rose-300 transition-colors">
              <div className="flex items-center justify-between text-rose-700 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Refunds</span>
                <div className="h-6 w-6 rounded-md bg-rose-50 flex items-center justify-center">
                  <RotateCcw className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-rose-700 leading-tight">
                {formatPKR(totalRefunds)}
              </p>
              <p className="text-[10.5px] text-slate-400 mt-1.5 truncate">Reversals &amp; returns</p>
            </div>

            {/* Outstanding Receivables */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-rose-300 transition-colors">
              <div className="flex items-center justify-between text-rose-600 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Outstanding</span>
                <div className="h-6 w-6 rounded-md bg-rose-50 flex items-center justify-center">
                  <AlertCircle className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-rose-600 leading-tight">
                {formatPKR(totalOutstanding)}
              </p>
              <p className="text-[10.5px] text-rose-600 font-medium mt-1.5">Uncollected dues</p>
            </div>
          </div>

          {/* 5. Dual Side-by-Side Breakdown Tables (Matching Balance Sheet Style) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Table: Collections Breakdown by Payment Method */}
            <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-[#16a34a] text-white px-3.5 py-2 font-bold text-xs tracking-wide flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5" />
                    Collections by Payment Method
                  </span>
                  <span className="text-[11px] font-normal text-emerald-100">
                    {collectionRate}% of net billed realized
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#f1f5f9] border-b border-slate-300 text-slate-800 text-[11px] font-bold uppercase">
                        <th className="w-10 py-2.5 px-2.5 text-center border-r border-slate-300">#</th>
                        <th className="py-2.5 px-3 border-r border-slate-300">Channel / Method</th>
                        <th className="py-2.5 px-3 border-r border-slate-300">Instrument Type</th>
                        <th className="py-2.5 px-3 text-center border-r border-slate-300">Share %</th>
                        <th className="py-2.5 px-3 text-right">Amount (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {[
                        { method: 'CASH', label: 'Cash Counter Collections', isPhysical: true, amount: report.collections.byMethod.CASH },
                        { method: 'CARD', label: 'Credit / Debit Card (POS)', isPhysical: false, amount: report.collections.byMethod.CARD },
                        { method: 'BANK', label: 'Direct Bank Transfer', isPhysical: false, amount: report.collections.byMethod.BANK },
                        { method: 'ONLINE', label: 'Online / Gateway Payment', isPhysical: false, amount: report.collections.byMethod.ONLINE },
                      ].map((item, idx) => {
                        const share = totalCollections > 0 ? ((item.amount / totalCollections) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={item.method} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-2.5 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/50">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap font-semibold text-slate-900">
                              <span className="flex items-center gap-1.5">
                                {item.isPhysical ? (
                                  <Coins className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                                )}
                                <span>{item.label}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold ${
                                  item.isPhysical
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {item.isPhysical ? 'Physical Counter Cash' : 'Electronic / Digital'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {share}%
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                              {formatPKR(item.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Total */}
              <div className="border-t border-slate-300 flex items-center justify-between bg-slate-50 text-xs font-bold">
                <span className="py-2.5 px-3.5 text-slate-700 uppercase tracking-wide">Total Collections</span>
                <span className="py-2.5 px-4 bg-[#dcfce7] text-emerald-950 font-mono text-sm border-l border-slate-300">
                  {formatPKR(totalCollections)}
                </span>
              </div>
            </div>

            {/* Right Table: Invoice Mix by Status */}
            <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-[#2563eb] text-white px-3.5 py-2 font-bold text-xs tracking-wide flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Invoice Mix by Status
                  </span>
                  <span className="text-[11px] font-normal text-blue-100">
                    {totalInvoices} total invoice{totalInvoices === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#f1f5f9] border-b border-slate-300 text-slate-800 text-[11px] font-bold uppercase">
                        <th className="w-10 py-2.5 px-2.5 text-center border-r border-slate-300">#</th>
                        <th className="py-2.5 px-3 border-r border-slate-300">Status</th>
                        <th className="py-2.5 px-3 border-r border-slate-300">Classification</th>
                        <th className="py-2.5 px-3 text-center border-r border-slate-300">Share %</th>
                        <th className="py-2.5 px-3 text-right">Invoices Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {Object.keys(report.billing.invoiceCountsByStatus).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-400">
                            No invoices generated in this period.
                          </td>
                        </tr>
                      ) : (
                        Object.entries(report.billing.invoiceCountsByStatus).map(([status, count], idx) => {
                          const badge = STATUS_BADGE[status] || {
                            label: status,
                            bg: 'bg-slate-100',
                            text: 'text-slate-700',
                            border: 'border-slate-200',
                          };
                          const share = totalInvoices > 0 ? ((count / totalInvoices) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={status} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-2.5 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/50">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap font-mono text-[11px] font-semibold text-slate-800">
                                {status}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                                >
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                {share}%
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                {count}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Total */}
              <div className="border-t border-slate-300 flex items-center justify-between bg-slate-50 text-xs font-bold">
                <span className="py-2.5 px-3.5 text-slate-700 uppercase tracking-wide">Total Invoices Raised</span>
                <span className="py-2.5 px-4 bg-[#eff6ff] text-blue-950 font-mono text-sm border-l border-slate-300">
                  {totalInvoices}
                </span>
              </div>
            </div>
          </div>

          {/* 6. Comprehensive Financial Turnover & Billing Reconciliation Summary */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-[#08775A]" />
                Financial Turnover &amp; Billing Reconciliation Summary
              </span>
              <span className="text-[11px] font-normal text-slate-500 font-mono">
                {report.period.label}
              </span>
            </div>

            <div className="divide-y divide-slate-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="py-2.5 px-4 text-slate-600 font-medium">Gross Hospital Billed (List Price):</span>
                <span className="py-2.5 px-4 bg-slate-50 text-slate-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  {formatPKR(totalGross)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="py-2.5 px-4 text-slate-600 font-medium">(-) Total Approved Discounts &amp; Waivers:</span>
                <span className="py-2.5 px-4 bg-amber-50 text-amber-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  -{formatPKR(totalDiscounts)}
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-50/40">
                <span className="py-2.5 px-4 text-slate-900 font-bold">(=) Net Hospital Billed Revenue:</span>
                <span className="py-2.5 px-4 bg-emerald-50/60 text-emerald-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  {formatPKR(totalNet)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="py-2.5 px-4 text-slate-600 font-medium">Realized Cash Collections (Counter):</span>
                <span className="py-2.5 px-4 bg-[#dcfce7]/70 text-emerald-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  {formatPKR(cashCollections)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="py-2.5 px-4 text-slate-600 font-medium">Realized Non-Cash Collections (Card / Bank / Online):</span>
                <span className="py-2.5 px-4 bg-blue-50 text-blue-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  {formatPKR(nonCashCollections)}
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-50/40">
                <span className="py-2.5 px-4 text-slate-900 font-bold">Total Realized Collections:</span>
                <span className="py-2.5 px-4 bg-[#dcfce7] text-emerald-950 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  {formatPKR(totalCollections)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="py-2.5 px-4 text-slate-600 font-medium">(-) Total Refunds &amp; Reversal Payouts:</span>
                <span className="py-2.5 px-4 bg-[#fee2e2] text-rose-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  -{formatPKR(totalRefunds)}
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-50/50">
                <span className="py-3 px-4 text-slate-900 font-bold">(=) Net Hospital Intake (Collections - Refunds):</span>
                <span className="py-3 px-4 bg-[#bbf7d0] text-emerald-950 font-black font-mono text-sm min-w-44 text-right border-l border-slate-200">
                  {formatPKR(netIntake)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="py-2.5 px-4 text-slate-600 font-medium">Remaining Uncollected / Outstanding Receivables:</span>
                <span className="py-2.5 px-4 bg-rose-50 text-rose-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  {formatPKR(totalOutstanding)}
                </span>
              </div>
            </div>
          </div>

          {/* 7. Quick Navigation to Specialized Front Desk Registers */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-[#08775A]" />
                Detailed Front Desk / Billing Registers
              </span>
              <span className="text-[11px] text-slate-400">Click to drill down into itemized registers</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/front-desk/fd_collection_report')}
                className="p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-[#08775A]">
                    Collection &amp; Receipts
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#08775A] group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500">Itemized cashier receipts, receipts log, and tender methods</p>
              </button>

              <button
                type="button"
                onClick={() => navigate('/front-desk/fd_invoice_register')}
                className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                    Invoice Register
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500">Every Hospital-side invoice with patient ledger drilldown</p>
              </button>

              <button
                type="button"
                onClick={() => navigate('/front-desk/fd_outstanding_invoices')}
                className="p-3 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-rose-700">
                    Outstanding Invoices
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-rose-700 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500">Unpaid &amp; partially settled balances requiring recovery</p>
              </button>

              <button
                type="button"
                onClick={() => navigate('/front-desk/fd_discount_report')}
                className="p-3 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-amber-700">
                    Discount &amp; Waiver Audit
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500">Concession reasons, authorized managers, and waiver totals</p>
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
