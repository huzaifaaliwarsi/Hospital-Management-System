import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  Receipt,
  Wallet,
  Package,
  CreditCard,
  Scale,
  Calendar,
  Filter,
  RotateCcw,
  Download,
  Printer,
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  DollarSign,
  Building2,
  ShieldCheck,
  Layers,
  FileText,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import {
  pharmacyApi,
  OperatingProfitReportData,
  OperatingProfitInvoiceRow,
  OperatingProfitExpenseRow,
  OperatingProfitTrendPoint,
} from '../services/pharmacyApi';
import { formatDate, formatDateTime, formatNumber } from '../utils/format';
import { useToast } from '../context/ToastContext';

type DatePreset = 'TODAY' | 'YESTERDAY' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'ALL_TIME' | 'CUSTOM';

export function formatPKR2(val: number | string | null | undefined): string {
  const n = Number(val ?? 0);
  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return n < 0 ? `-Rs. ${formatted}` : `Rs. ${formatted}`;
}

export const OperatingProfitPage: React.FC<{ onNavigate?: (page: string) => void }> = ({ onNavigate }) => {
  const toast = useToast();

  // Date filters
  const [preset, setPreset] = useState<DatePreset>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Active view tab
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'INVOICES' | 'EXPENSES' | 'TREND'>('OVERVIEW');

  // Search in drill-downs
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'RETAIL' | 'HMS_LINKED'>('ALL');

  // Data state
  const [data, setData] = useState<OperatingProfitReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Compute date boundaries based on preset
  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'TODAY') {
      const today = toYMD(now);
      return { fromDate: today, toDate: today };
    }
    if (preset === 'YESTERDAY') {
      const y = new Date(now.getTime() - 86400000);
      const yStr = toYMD(y);
      return { fromDate: yStr, toDate: yStr };
    }
    if (preset === 'THIS_MONTH') {
      const first = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      const today = toYMD(now);
      return { fromDate: first, toDate: today };
    }
    if (preset === 'LAST_MONTH') {
      const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { fromDate: toYMD(firstLastMonth), toDate: toYMD(lastDayLastMonth) };
    }
    if (preset === 'THIS_YEAR') {
      const first = `${now.getFullYear()}-01-01`;
      const today = toYMD(now);
      return { fromDate: first, toDate: today };
    }
    if (preset === 'ALL_TIME') {
      return { fromDate: undefined, toDate: undefined };
    }
    return {
      fromDate: customFrom || undefined,
      toDate: customTo || undefined,
    };
  }, [preset, customFrom, customTo]);

  // Load report data
  const loadReport = () => {
    setLoading(true);
    pharmacyApi
      .getOperatingProfitReport(fromDate, toDate)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error('Failed to load Operating Profit Report:', err);
        toast.error('Failed to load Operating Profit Report.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const bd = data?.breakdown;
  const vs = data?.vendorSummary;

  // Filtered invoices for drill-down
  const filteredInvoices = useMemo(() => {
    if (!data?.invoices) return [];
    return data.invoices.filter((inv) => {
      if (channelFilter !== 'ALL' && inv.channel !== channelFilter) return false;
      if (invoiceSearch.trim()) {
        const q = invoiceSearch.toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.customerName.toLowerCase().includes(q) ||
          inv.soldBy.toLowerCase().includes(q) ||
          inv.status.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data?.invoices, channelFilter, invoiceSearch]);

  // Filtered expenses for drill-down
  const filteredExpenses = useMemo(() => {
    if (!data?.expenses) return [];
    return data.expenses.filter((exp) => {
      if (expenseSearch.trim()) {
        const q = expenseSearch.toLowerCase();
        return (
          exp.expenseNumber.toLowerCase().includes(q) ||
          exp.category.toLowerCase().includes(q) ||
          exp.description.toLowerCase().includes(q) ||
          exp.payeeOrVendor.toLowerCase().includes(q) ||
          exp.enteredBy.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data?.expenses, expenseSearch]);

  // CSV Export
  const handleExportCsv = () => {
    if (!data || !bd) return;
    const lines: string[] = [
      'CH HOSPITAL MANAGEMENT SYSTEM - PHARMACY OPERATING PROFIT / LOSS REPORT',
      `Period: ${data.reportPeriod.from ? formatDate(data.reportPeriod.from) : 'Beginning'} to ${data.reportPeriod.to ? formatDate(data.reportPeriod.to) : 'Present'}`,
      `Generated: ${new Date().toLocaleString('en-PK')}`,
      '',
      'SECTION,FINANCIAL METRIC,AMOUNT (PKR),NOTES',
      `Revenue,Gross Sales,${bd.grossSales},Valid invoice gross amount`,
      `Revenue,Discounts & Returns,${bd.discounts},Approved sales discounts and refunds`,
      `Revenue,Net Sales / Billing,${bd.netBilling},Sales excluding tax liability`,
      `Revenue,Tax Billed,${bd.taxBilled},Output tax liability`,
      `Revenue,Total Invoiced,${bd.totalInvoiced},Net billing + tax`,
      `Collections,Actual Collections,${bd.actualCollections},Valid payments received minus refunds`,
      `Collections,Outstanding Receivables,${bd.outstanding},Unpaid customer balance as of period end`,
      `Recognized Revenue,Recognized Revenue,${bd.recognizedRevenue},Fully-paid eligible revenue (excl tax)`,
      `COGS,Medicine COGS,${bd.medicineCogs},Historical batch landed cost matched to recognized sales`,
      `Gross Profit,Gross Profit,${bd.grossProfit},Recognized Revenue minus Matched COGS`,
      `Expenses,Operating Expenses,${bd.operatingExpenses},Approved overhead expenses (excl vendor payments)`,
      `Operating Profit,Net Operating Profit / Loss,${bd.operatingProfit},Gross Profit minus Operating Expenses`,
      '',
      'VENDOR SAFEGUARD & RECONCILIATION,METRIC,AMOUNT (PKR),ACCOUNTING CLASSIFICATION',
      `Vendor Capital,Total Vendor Payments,${vs?.totalVendorPayments || 0},Balance Sheet Outflow (Reduces Cash/Bank and Vendor Payable)`,
      `Vendor Capital,Supplier Refunds,${vs?.supplierRefundsReceived || 0},Balance Sheet Inflow`,
      `Vendor Capital,Vendor Net Outstanding,${vs?.vendorOutstanding || 0},Current Vendor Payable Liability`,
      `Vendor Capital,Supplier Advances,${vs?.supplierAdvances || 0},Supplier Prepayments Asset`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy_operating_profit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Operating Profit Report exported to CSV.');
  };

  // Excel Export
  const handleExportExcel = async () => {
    if (!data || !bd) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Sheet 1: Executive Statement
      const statementRows = [
        ['CH HOSPITAL PHARMACY — OPERATING PROFIT / LOSS REPORT'],
        [`Reporting Period: ${data.reportPeriod.from ? formatDate(data.reportPeriod.from) : 'Beginning'} to ${data.reportPeriod.to ? formatDate(data.reportPeriod.to) : 'Present'}`],
        [`Generated: ${new Date().toLocaleString('en-PK')}`],
        [],
        ['Line #', 'Financial Classification', 'Amount (PKR)', 'Basis / Formula'],
        ['1.0', 'OPERATING REVENUE & BILLING', '', ''],
        ['1.1', '  Gross Sales', Number(bd.grossSales), 'Pharmacy Invoice Gross Billed'],
        ['1.2', '  Less: Sales Discounts & Returns', -Number(bd.discounts), 'Approved Customer Discounts & Returns'],
        ['1.3', '  Net Sales / Billing (excl tax)', Number(bd.netBilling), 'Gross Sales − Discounts & Returns'],
        ['1.4', '  Tax Liability Billed', Number(bd.taxBilled), 'Output GST / Tax'],
        ['1.5', '  Total Invoiced Amount', Number(bd.totalInvoiced), 'Net Billing + Tax'],
        ['1.6', '  Actual Collections Received', Number(bd.actualCollections), 'Cash & Bank Inflow − Cash Refunds'],
        ['1.7', '  Outstanding Customer Receivables', Number(bd.outstanding), 'Unpaid Invoice Balances'],
        ['1.8', 'RECOGNIZED REVENUE (Full-Paid Basis)', Number(bd.recognizedRevenue), 'Full-Payment Recognized Sales (excl tax)'],
        [],
        ['2.0', 'COST OF GOODS SOLD (COGS)', '', ''],
        ['2.1', '  Medicine COGS', Number(bd.medicineCogs), 'Historical Landed Batch Cost Matched to Recognized Sales'],
        [],
        ['3.0', 'GROSS PROFIT', Number(bd.grossProfit), 'Recognized Revenue − Medicine COGS'],
        ['3.1', '  Gross Profit Margin %', `${bd.grossMarginPercent}%`, '(Gross Profit / Recognized Revenue) * 100'],
        [],
        ['4.0', 'OPERATING EXPENSES', '', ''],
        ['4.1', '  Operational Overheads & Expenses', Number(bd.operatingExpenses), 'Administrative, Utilities, Rent, Salaries, Supplies'],
        [],
        ['5.0', 'NET OPERATING PROFIT / (LOSS)', Number(bd.operatingProfit), 'Gross Profit − Operating Expenses'],
        ['5.1', '  Operating Profit Margin %', `${bd.operatingMarginPercent}%`, '(Operating Profit / Recognized Revenue) * 100'],
        [],
        ['6.0', 'VENDOR SAFEGUARD RECONCILIATION (Balance Sheet Only)', '', ''],
        ['6.1', '  Total Vendor Disbursements', Number(vs?.totalVendorPayments || 0), 'Settles Vendor Payable; NOT an Operating Expense'],
        ['6.2', '  Supplier Refunds Received', Number(vs?.supplierRefundsReceived || 0), 'Vendor Refund Inflow'],
        ['6.3', '  Vendor Outstanding Payables', Number(vs?.vendorOutstanding || 0), 'Current Net Balance Sheet Liability'],
        ['6.4', '  Supplier Advances & Credits', Number(vs?.supplierAdvances || 0), 'Advance Prepayments Asset'],
      ];
      const wsStatement = XLSX.utils.aoa_to_sheet(statementRows);
      XLSX.utils.book_append_sheet(wb, wsStatement, 'P&L Statement');

      // Sheet 2: Invoices Breakdown
      const invHeader = [
        'Invoice #',
        'Channel',
        'Customer / Patient',
        'Date',
        'Status',
        'Gross Sales',
        'Discounts',
        'Net Billing',
        'Collections',
        'Outstanding',
        'Recognized Revenue',
        'Matched COGS',
        'Gross Profit',
        'Sold By',
      ];
      const invRows = filteredInvoices.map((i) => [
        i.invoiceNumber,
        i.channel,
        i.customerName,
        formatDateTime(i.createdAt),
        i.status,
        Number(i.grossSales),
        Number(i.discount),
        Number(i.netBilling),
        Number(i.collections),
        Number(i.outstanding),
        Number(i.recognizedRevenue),
        Number(i.recognizedCogs),
        Number(i.grossProfit),
        i.soldBy,
      ]);
      const wsInvoices = XLSX.utils.aoa_to_sheet([invHeader, ...invRows]);
      XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices Drill-Down');

      // Sheet 3: Expenses Breakdown
      const expHeader = [
        'Expense #',
        'Date',
        'Category',
        'Description',
        'Payee / Vendor',
        'Payment Method',
        'Amount',
        'Entered By',
        'Approved By',
      ];
      const expRows = filteredExpenses.map((e) => [
        e.expenseNumber,
        formatDate(e.date),
        e.category,
        e.description,
        e.payeeOrVendor,
        e.paymentMethod,
        Number(e.amount),
        e.enteredBy,
        e.approvedBy,
      ]);
      const wsExpenses = XLSX.utils.aoa_to_sheet([expHeader, ...expRows]);
      XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses Drill-Down');

      XLSX.writeFile(wb, `pharmacy_operating_profit_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Operating Profit Report exported to Excel (.xlsx).');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel.');
    }
  };

  const isProfit = Number(bd?.operatingProfit ?? 0) >= 0;

  return (
    <div className="space-y-5 pb-12">
      {/* ═════════════════════════════════════════════════════════════════════
          1. HEADER & FILTER TOOLBAR
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-[#0e7d5a] flex items-center justify-center shadow-xs shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Operating Profit / Loss Report
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100/70 text-emerald-800 border border-emerald-300/60">
                  Full-Payment Accrual Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Full-payment revenue recognition policy, matched batch landed cost (COGS), and operational overheads.
              </p>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || !data}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Download Excel Worksheet"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || !data}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Download CSV"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Print P&L Statement"
            >
              <Printer className="h-4 w-4" /> Print / PDF
            </button>
            <button
              type="button"
              onClick={loadReport}
              disabled={loading}
              className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Report Data"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Date Presets Toolbar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" /> Period:
            </span>
            {(
              [
                ['TODAY', 'Today'],
                ['YESTERDAY', 'Yesterday'],
                ['THIS_MONTH', 'This Month'],
                ['LAST_MONTH', 'Last Month'],
                ['THIS_YEAR', 'This Year'],
                ['ALL_TIME', 'All Time'],
                ['CUSTOM', 'Custom Range'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setPreset(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  preset === val
                    ? 'bg-[#0e7d5a] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {preset === 'CUSTOM' && (
            <div className="flex items-center gap-2 flex-wrap bg-slate-50 p-2 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">From:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-mono"
              />
              <span className="text-xs text-slate-500 font-semibold">To:</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs">
          <Loader2 className="h-8 w-8 animate-spin text-[#0e7d5a] mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">Calculating Operating Profit & Recognition Ledgers…</p>
          <p className="text-xs text-slate-400 mt-1">Reconciling invoices, matched COGS and operating expenses</p>
        </div>
      ) : !data || !bd ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
          <p className="font-bold text-slate-800">No report data returned for this period.</p>
        </div>
      ) : (
        <>
          {/* ═════════════════════════════════════════════════════════════════
              2. EXECUTIVE KPI CARDS STRIP
              ═════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
            {/* 1. Gross Sales */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">1. Gross Sales</span>
                <Receipt className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-lg font-black text-slate-900 font-mono tracking-tight">
                {formatPKR2(bd.grossSales)}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
                <span>Discounts:</span>
                <span className="font-semibold text-rose-600 font-mono">-{formatPKR2(bd.discounts)}</span>
              </div>
            </div>

            {/* 2. Collections */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">2. Collections</span>
                <Wallet className="h-4 w-4 text-sky-600" />
              </div>
              <div className="text-lg font-black text-slate-900 font-mono tracking-tight">
                {formatPKR2(bd.actualCollections)}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
                <span>Outstanding:</span>
                <span className="font-semibold text-amber-700 font-mono">{formatPKR2(bd.outstanding)}</span>
              </div>
            </div>

            {/* 3. Recognized Revenue */}
            <div className="bg-white rounded-2xl border border-emerald-300/80 bg-linear-to-b from-emerald-50/40 to-white p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-emerald-800 mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-700">3. Recognized Revenue</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-lg font-black text-emerald-900 font-mono tracking-tight">
                {formatPKR2(bd.recognizedRevenue)}
              </div>
              <div className="mt-1.5 text-[11px] text-emerald-700 flex items-center justify-between border-t border-emerald-100 pt-1.5">
                <span>Eligible Sales:</span>
                <span className="font-bold">Full-Paid Basis</span>
              </div>
            </div>

            {/* 4. Medicine COGS */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">4. Medicine COGS</span>
                <Package className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-lg font-black text-slate-900 font-mono tracking-tight">
                {formatPKR2(bd.medicineCogs)}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
                <span>Gross Margin:</span>
                <span className="font-bold text-emerald-700">{bd.grossMarginPercent}%</span>
              </div>
            </div>

            {/* 5. Operating Expenses */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">5. Operating Expenses</span>
                <CreditCard className="h-4 w-4 text-rose-600" />
              </div>
              <div className="text-lg font-black text-slate-900 font-mono tracking-tight">
                {formatPKR2(bd.operatingExpenses)}
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
                <span>Vendor Pay:</span>
                <span className="font-bold text-slate-600">Excluded (Capital)</span>
              </div>
            </div>

            {/* 6. Net Operating Profit / Loss */}
            <div
              className={`rounded-2xl border p-4 shadow-xs relative overflow-hidden ${
                isProfit
                  ? 'bg-linear-to-b from-emerald-500 to-[#0e7d5a] text-white border-emerald-600'
                  : 'bg-linear-to-b from-rose-500 to-rose-700 text-white border-rose-600'
              }`}
            >
              <div className="flex items-center justify-between text-white/90 mb-2">
                <span className="text-[11px] font-black tracking-wider uppercase">
                  {isProfit ? 'Operating Profit' : 'Operating Loss'}
                </span>
                <Scale className="h-4 w-4 text-white/80" />
              </div>
              <div className="text-xl font-black text-white font-mono tracking-tight">
                {formatPKR2(bd.operatingProfit)}
              </div>
              <div className="mt-1.5 text-[11px] text-white/90 flex items-center justify-between border-t border-white/20 pt-1.5">
                <span>Net Margin:</span>
                <span className="font-extrabold">{bd.operatingMarginPercent}%</span>
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              3. VENDOR PAYMENTS & RECONCILIATION SAFEGUARD CARD
              ═════════════════════════════════════════════════════════════════ */}
          <div className="bg-linear-to-r from-blue-50/60 via-slate-50 to-emerald-50/40 rounded-2xl border border-blue-200/80 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-800 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    Vendor Payments &amp; Balance Sheet Safeguard
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                      IFRS Non-Expense
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Vendor disbursements settle supplier liabilities or record advance credits. They strictly reduce
                    Cash/Bank balances and are <strong className="text-slate-900">excluded from Operating Expenses</strong> to prevent
                    double-deducting against Medicine COGS.
                  </p>
                </div>
              </div>

              {/* Vendor Ledger Summary Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                <div className="bg-white/90 rounded-xl border border-slate-200 p-2.5 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vendor Payments</span>
                  <span className="text-xs font-black text-slate-900 font-mono">{formatPKR2(vs?.totalVendorPayments)}</span>
                </div>
                <div className="bg-white/90 rounded-xl border border-slate-200 p-2.5 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Supplier Refunds</span>
                  <span className="text-xs font-black text-emerald-700 font-mono">{formatPKR2(vs?.supplierRefundsReceived)}</span>
                </div>
                <div className="bg-white/90 rounded-xl border border-slate-200 p-2.5 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vendor Due</span>
                  <span className="text-xs font-black text-amber-700 font-mono">{formatPKR2(vs?.vendorOutstanding)}</span>
                </div>
                <div className="bg-white/90 rounded-xl border border-slate-200 p-2.5 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Supplier Advances</span>
                  <span className="text-xs font-black text-blue-700 font-mono">{formatPKR2(vs?.supplierAdvances)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              4. INTERACTIVE RECHARTS TREND SECTION
              ═════════════════════════════════════════════════════════════════ */}
          {data.trend && data.trend.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" /> Operating Performance Trend
                  </h3>
                  <p className="text-xs text-slate-400">
                    Chronological progression of Recognized Revenue, Medicine COGS, Expenses and Operating Profit.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#0e7d5a]" /> Revenue
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#f59e0b]" /> COGS
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#ef4444]" /> Expenses
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#0284c7]" /> Op Profit
                  </span>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0e7d5a" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0e7d5a" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickFormatter={(val) => (Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`)}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload as OperatingProfitTrendPoint;
                          return (
                            <div className="bg-white rounded-xl p-3 shadow-xl border border-slate-200 text-xs w-60">
                              <p className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 mb-1.5 flex items-center justify-between">
                                <span>{item.date}</span>
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {item.invoiceCount} invoices
                                </span>
                              </p>
                              <div className="space-y-1 font-mono text-[11px]">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Revenue:</span>
                                  <span className="font-bold text-emerald-700">{formatPKR2(item.recognizedRevenue)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">COGS:</span>
                                  <span className="font-semibold text-amber-700">{formatPKR2(item.medicineCogs)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Expenses:</span>
                                  <span className="font-semibold text-rose-600">{formatPKR2(item.operatingExpenses)}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-100 pt-1 font-bold">
                                  <span className="text-slate-800">Operating Profit:</span>
                                  <span className={Number(item.operatingProfit) >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                                    {formatPKR2(item.operatingProfit)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="recognizedRevenue" stroke="#0e7d5a" strokeWidth={2} fill="url(#revGrad)" />
                    <Area type="monotone" dataKey="operatingProfit" stroke="#0284c7" strokeWidth={2.5} fill="url(#profitGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              5. TABS NAVIGATION & DRILL-DOWN CONTAINER
              ═════════════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Tabs Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 pt-3 flex items-center justify-between gap-4 overflow-x-auto">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('OVERVIEW')}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'OVERVIEW'
                      ? 'border-[#0e7d5a] text-[#0e7d5a] bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <FileText className="h-4 w-4" /> P&amp;L Statement Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('INVOICES')}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'INVOICES'
                      ? 'border-[#0e7d5a] text-[#0e7d5a] bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Receipt className="h-4 w-4" /> Invoices Drill-Down ({filteredInvoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('EXPENSES')}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'EXPENSES'
                      ? 'border-[#0e7d5a] text-[#0e7d5a] bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <CreditCard className="h-4 w-4" /> Operating Expenses ({filteredExpenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('TREND')}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'TREND'
                      ? 'border-[#0e7d5a] text-[#0e7d5a] bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <TrendingUp className="h-4 w-4" /> Periodic Trend Table ({data.trend.length})
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: FORMAL P&L STATEMENT OVERVIEW */}
            {activeTab === 'OVERVIEW' && (
              <div className="p-5 sm:p-6">
                <div className="max-w-4xl mx-auto border border-slate-300 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-[#0e5944] text-white px-6 py-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-base tracking-tight text-white">Statement of Operating Profit &amp; Loss</h4>
                      <p className="text-xs text-emerald-200 mt-0.5">
                        Reporting Standard: Revenue recognized strictly upon full cash/bank clearance
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-emerald-800/80 px-3 py-1 rounded-full border border-emerald-500/40">
                      PKR Standard
                    </span>
                  </div>

                  <table className="w-full text-xs text-left border-collapse">
                    <tbody className="divide-y divide-slate-200">
                      {/* Section 1: Operating Revenue */}
                      <tr className="bg-slate-100/80 font-bold text-slate-800">
                        <td colSpan={2} className="py-2.5 px-6 uppercase tracking-wider text-[11px]">
                          1. Operating Revenue &amp; Sales Billed
                        </td>
                        <td className="py-2.5 px-6 text-right uppercase tracking-wider text-[11px]">Amount (PKR)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-6 font-medium text-slate-700 pl-10">1.1 Gross Sales (Valid Invoices)</td>
                        <td className="py-2.5 px-6 text-slate-400 text-[11px]">Billed price before discounts</td>
                        <td className="py-2.5 px-6 text-right font-mono font-bold text-slate-900">{formatPKR2(bd.grossSales)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-6 font-medium text-slate-700 pl-10">1.2 Less: Discounts &amp; Sales Returns</td>
                        <td className="py-2.5 px-6 text-slate-400 text-[11px]">Approved price reductions</td>
                        <td className="py-2.5 px-6 text-right font-mono font-bold text-rose-600">-{formatPKR2(bd.discounts)}</td>
                      </tr>
                      <tr className="bg-slate-50/70 font-semibold text-slate-900">
                        <td className="py-2.5 px-6 pl-10">1.3 Net Sales / Billing (excluding tax)</td>
                        <td className="py-2.5 px-6 text-slate-500 text-[11px]">Gross Sales − Discounts</td>
                        <td className="py-2.5 px-6 text-right font-mono font-bold text-slate-900">{formatPKR2(bd.netBilling)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-6 font-medium text-slate-700 pl-10">1.4 Tax Liability Billed</td>
                        <td className="py-2.5 px-6 text-slate-400 text-[11px]">Output GST collected</td>
                        <td className="py-2.5 px-6 text-right font-mono font-semibold text-slate-700">{formatPKR2(bd.taxBilled)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-6 font-medium text-slate-700 pl-10">1.5 Actual Collections Received</td>
                        <td className="py-2.5 px-6 text-slate-400 text-[11px]">Cash/Card received − refunds</td>
                        <td className="py-2.5 px-6 text-right font-mono font-semibold text-sky-700">{formatPKR2(bd.actualCollections)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-6 font-medium text-slate-700 pl-10">1.6 Outstanding Customer Receivables</td>
                        <td className="py-2.5 px-6 text-slate-400 text-[11px]">Unpaid customer balances</td>
                        <td className="py-2.5 px-6 text-right font-mono font-semibold text-amber-700">{formatPKR2(bd.outstanding)}</td>
                      </tr>
                      <tr className="bg-emerald-50/80 font-bold text-emerald-950 border-t-2 border-emerald-300">
                        <td className="py-3 px-6 text-emerald-900 font-extrabold">1.7 RECOGNIZED OPERATING REVENUE</td>
                        <td className="py-3 px-6 text-emerald-700 text-[11px]">Full-Payment Eligible Sales (excl tax)</td>
                        <td className="py-3 px-6 text-right font-mono text-sm font-black text-emerald-900">
                          {formatPKR2(bd.recognizedRevenue)}
                        </td>
                      </tr>

                      {/* Section 2: Cost of Goods Sold */}
                      <tr className="bg-slate-100/80 font-bold text-slate-800">
                        <td colSpan={2} className="py-2.5 px-6 uppercase tracking-wider text-[11px]">
                          2. Cost of Goods Sold (COGS)
                        </td>
                        <td className="py-2.5 px-6 text-right uppercase tracking-wider text-[11px]">Amount (PKR)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-6 font-medium text-slate-700 pl-10">2.1 Medicine COGS</td>
                        <td className="py-2.5 px-6 text-slate-400 text-[11px]">Matched historical batch purchase landed cost</td>
                        <td className="py-2.5 px-6 text-right font-mono font-bold text-rose-700">-{formatPKR2(bd.medicineCogs)}</td>
                      </tr>

                      {/* Section 3: Gross Profit */}
                      <tr className="bg-amber-50/60 font-bold text-slate-900 border-t-2 border-b-2 border-amber-300">
                        <td className="py-3 px-6 text-amber-950 font-extrabold">3.0 GROSS PROFIT</td>
                        <td className="py-3 px-6 text-amber-800 text-[11px]">Recognized Revenue − Medicine COGS (Margin: {bd.grossMarginPercent}%)</td>
                        <td className="py-3 px-6 text-right font-mono text-sm font-black text-amber-950">{formatPKR2(bd.grossProfit)}</td>
                      </tr>

                      {/* Section 4: Operating Expenses */}
                      <tr className="bg-slate-100/80 font-bold text-slate-800">
                        <td colSpan={2} className="py-2.5 px-6 uppercase tracking-wider text-[11px]">
                          4. Operating Expenses
                        </td>
                        <td className="py-2.5 px-6 text-right uppercase tracking-wider text-[11px]">Amount (PKR)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-6 font-medium text-slate-700 pl-10">4.1 Operational Overheads &amp; Administrative Expenses</td>
                        <td className="py-2.5 px-6 text-slate-400 text-[11px]">Rent, utilities, staff salaries, supplies (excl vendor payments)</td>
                        <td className="py-2.5 px-6 text-right font-mono font-bold text-rose-700">-{formatPKR2(bd.operatingExpenses)}</td>
                      </tr>

                      {/* Section 5: Net Operating Profit / (Loss) */}
                      <tr
                        className={`font-black border-t-4 ${
                          isProfit
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-rose-600 text-white border-rose-700'
                        }`}
                      >
                        <td className="py-4 px-6 text-base tracking-tight text-white">
                          5.0 NET OPERATING {isProfit ? 'PROFIT' : 'LOSS'}
                        </td>
                        <td className="py-4 px-6 text-white/90 text-xs font-semibold">
                          Gross Profit − Operating Expenses (Margin: {bd.operatingMarginPercent}%)
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-lg font-black text-white">
                          {formatPKR2(bd.operatingProfit)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: INVOICES & REVENUE DRILL-DOWN */}
            {activeTab === 'INVOICES' && (
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search invoice #, customer, staff…"
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">Channel:</span>
                    {(['ALL', 'RETAIL', 'HMS_LINKED'] as const).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setChannelFilter(ch)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          channelFilter === ch
                            ? 'bg-[#0e7d5a] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {ch === 'ALL' ? 'All' : ch === 'RETAIL' ? 'POS (Retail)' : 'HMS Linked'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#0e5944] text-white font-bold text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Invoice #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Channel</th>
                        <th className="py-2.5 px-3">Customer / Patient</th>
                        <th className="py-2.5 px-3 text-right">Gross Sales</th>
                        <th className="py-2.5 px-3 text-right">Collections</th>
                        <th className="py-2.5 px-3 text-right">Outstanding</th>
                        <th className="py-2.5 px-3 text-right">Recognized Rev</th>
                        <th className="py-2.5 px-3 text-right">COGS</th>
                        <th className="py-2.5 px-3 text-right">Gross Profit</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-slate-400 font-sans">
                            No invoices matching filters in this reporting period.
                          </td>
                        </tr>
                      ) : (
                        filteredInvoices.map((inv) => (
                          <tr key={inv.invoiceNumber} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{inv.invoiceNumber}</td>
                            <td className="py-2.5 px-3 text-slate-500 font-sans">{formatDateTime(inv.createdAt)}</td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inv.channel === 'RETAIL'
                                  ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                  : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                              }`}>
                                {inv.channel === 'RETAIL' ? 'POS' : 'HMS'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 font-sans font-medium">{inv.customerName}</td>
                            <td className="py-2.5 px-3 text-right text-slate-700">{formatPKR2(inv.grossSales)}</td>
                            <td className="py-2.5 px-3 text-right text-sky-700 font-semibold">{formatPKR2(inv.collections)}</td>
                            <td className="py-2.5 px-3 text-right text-amber-700">{formatPKR2(inv.outstanding)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-800">{formatPKR2(inv.recognizedRevenue)}</td>
                            <td className="py-2.5 px-3 text-right text-slate-700">{formatPKR2(inv.recognizedCogs)}</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              Number(inv.grossProfit) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}>
                              {formatPKR2(inv.grossProfit)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : inv.status === 'PARTIALLY_PAID'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: OPERATING EXPENSES DRILL-DOWN */}
            {activeTab === 'EXPENSES' && (
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search expense #, category, payee…"
                      value={expenseSearch}
                      onChange={(e) => setExpenseSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-semibold">
                    Showing {filteredExpenses.length} operational expenses
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#0e5944] text-white font-bold text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Expense #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Payee / Vendor</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Entered By</th>
                        <th className="py-2.5 px-3">Approved By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                            No operating expenses recorded for this period.
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{exp.expenseNumber}</td>
                            <td className="py-2.5 px-3 text-slate-500 font-sans">{formatDate(exp.date)}</td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                                {exp.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 font-sans max-w-xs truncate">{exp.description}</td>
                            <td className="py-2.5 px-3 text-slate-700 font-sans">{exp.payeeOrVendor}</td>
                            <td className="py-2.5 px-3 text-slate-600 font-sans">{exp.paymentMethod}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-700">{formatPKR2(exp.amount)}</td>
                            <td className="py-2.5 px-3 text-slate-600 font-sans">{exp.enteredBy}</td>
                            <td className="py-2.5 px-3 text-slate-600 font-sans">{exp.approvedBy}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: PERIODIC TREND TABLE */}
            {activeTab === 'TREND' && (
              <div className="p-4 sm:p-5">
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#0e5944] text-white font-bold text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-center">Invoices</th>
                        <th className="py-2.5 px-3 text-right">Gross Sales</th>
                        <th className="py-2.5 px-3 text-right">Collections</th>
                        <th className="py-2.5 px-3 text-right">Recognized Revenue</th>
                        <th className="py-2.5 px-3 text-right">Medicine COGS</th>
                        <th className="py-2.5 px-3 text-right">Gross Profit</th>
                        <th className="py-2.5 px-3 text-right">Operating Expenses</th>
                        <th className="py-2.5 px-3 text-right">Operating Profit / Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {data.trend.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                            No daily trend activity recorded for this period.
                          </td>
                        </tr>
                      ) : (
                        data.trend.map((t) => (
                          <tr key={t.date} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{t.date}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600 font-sans">{t.invoiceCount}</td>
                            <td className="py-2.5 px-3 text-right text-slate-700">{formatPKR2(t.grossSales)}</td>
                            <td className="py-2.5 px-3 text-right text-sky-700">{formatPKR2(t.collections)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-800">{formatPKR2(t.recognizedRevenue)}</td>
                            <td className="py-2.5 px-3 text-right text-slate-700">{formatPKR2(t.medicineCogs)}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-amber-800">{formatPKR2(t.grossProfit)}</td>
                            <td className="py-2.5 px-3 text-right text-rose-700">{formatPKR2(t.operatingExpenses)}</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              Number(t.operatingProfit) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}>
                              {formatPKR2(t.operatingProfit)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

