import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, Wallet, ArrowDownRight, ArrowUpRight, Scale, CheckCircle2 } from 'lucide-react';
import apiClient from '../services/apiClient';
import { formatPKR } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';
import { PharmacyDataTable, Column } from '../components/PharmacyDataTable';

const CATEGORY_LABEL: Record<string, string> = {
  PETTY_CASH_ISSUED: 'Petty Cash Issued',
  PETTY_CASH_RECEIVED: 'Petty Cash Received',
  POS_COLLECTION: 'POS Sales Collection',
  HMS_COLLECTION: 'HMS Ward Collection',
  REFUND: 'Customer Refund',
  VENDOR_PAYMENT: 'Vendor Payment Out',
  EXPENSE_PAYMENT: 'Expense Payment Out',
  SETTLEMENT_HANDOVER: 'Supervisor Settlement Handover',
  ADJUSTMENT: 'Cash Adjustment',
};

export const BalanceSheetPage: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    apiClient
      .get('/cash/balance-sheet')
      .then((r) => setData(r.data.data))
      .catch(() => toast.error('Failed to load balance sheet.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const kpis: KpiItem[] = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'System Calculated Cash',
        value: formatPKR(data.expectedCash),
        icon: Wallet,
        subtitle: 'Theoretical cash in drawer',
        tone: 'default',
      },
      {
        label: 'Total Inflow Entries',
        value: (data.entries || []).filter((e: any) => e.direction === 'IN').length,
        icon: ArrowDownRight,
        subtitle: 'Collections & receipts',
        tone: 'success',
      },
      {
        label: 'Total Outflow Entries',
        value: (data.entries || []).filter((e: any) => e.direction === 'OUT').length,
        icon: ArrowUpRight,
        subtitle: 'Expenses & disbursements',
        tone: 'danger',
      },
      {
        label: 'Activity Records',
        value: (data.entries || []).length,
        icon: Scale,
        subtitle: 'Perpetual cash audit logs',
        tone: 'info',
      },
    ];
  }, [data]);

  const columns: Column<any>[] = [
    {
      key: 'occurredAt',
      header: 'Date & Time',
      width: '160px',
      render: (e) => (
        <span className="text-[11.5px] text-slate-700 whitespace-nowrap">
          {new Date(e.occurredAt).toLocaleString('en-GB')}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Cash Category',
      render: (e) => (
        <span className="font-semibold text-slate-900 text-xs whitespace-nowrap">
          {CATEGORY_LABEL[e.category] ?? e.category}
        </span>
      ),
    },
    {
      key: 'direction',
      header: 'Flow Direction',
      align: 'center',
      width: '140px',
      render: (e) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              e.direction === 'IN' ? 'bg-[#0e7d5a]' : 'bg-rose-500'
            }`}
          />
          <span className={e.direction === 'IN' ? 'text-[#0e7d5a]' : 'text-rose-700'}>
            {e.direction === 'IN' ? '↓ Cash IN' : '↑ Cash OUT'}
          </span>
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount (PKR)',
      align: 'right',
      width: '150px',
      render: (e) => (
        <span className="font-bold text-xs text-slate-900 whitespace-nowrap">
          {e.direction === 'IN' ? '+' : '-'} {formatPKR(e.amount)}
        </span>
      ),
    },
    {
      key: 'isSettled',
      header: 'Settlement Status',
      align: 'center',
      width: '140px',
      render: (e) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              e.isSettled ? 'bg-[#0e7d5a]' : 'bg-slate-400'
            }`}
          />
          <span className={e.isSettled ? 'text-[#0e7d5a]' : 'text-slate-700'}>
            {e.isSettled ? 'Handed Over' : 'In Till'}
          </span>
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center gap-2 text-slate-500 text-xs">
        <Loader2 className="h-5 w-5 animate-spin text-[#0e7d5a]" /> Loading cash balance sheet…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-[1700px] mx-auto">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Till Balance Sheet &amp; Cash Flow
          </h1>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            Perpetual Drawer
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Automated double-entry audit of all register inflows, sales collections, disbursements, and cash drawer handovers.
        </p>
      </div>

      {/* KPI Cards */}
      <PharmacyKpiHeader items={kpis} />

      {/* Category Breakdown Badges */}
      <div className="bg-white rounded-2xl border border-slate-300/80 p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Category Summary Breakdown
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(data.breakdown || {}).map(([cat, amount]) => (
            <div
              key={cat}
              className="bg-slate-50 rounded-xl border border-slate-200 p-2.5 flex flex-col justify-between"
            >
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                {CATEGORY_LABEL[cat] ?? cat}
              </div>
              <div className="text-sm font-bold font-mono text-slate-900 mt-1">
                {formatPKR(amount as number)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <PharmacyDataTable
        columns={columns}
        data={data.entries || []}
        loading={loading}
        title="Cash Activity Ledger"
        badge="Live Drawer Flow"
        exportFileName="cash_balance_sheet"
        searchPlaceholder="Search by category name…"
        searchFilter={(e, q) =>
          (CATEGORY_LABEL[e.category] ?? e.category).toLowerCase().includes(q)
        }
        onRefresh={load}
        emptyTitle="No Cash Transactions"
        emptyDescription="No register cash movements recorded for current period."
      />
    </div>
  );
};
