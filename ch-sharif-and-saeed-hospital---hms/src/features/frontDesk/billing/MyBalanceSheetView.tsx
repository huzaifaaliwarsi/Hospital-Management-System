import React, { useState, useEffect, useMemo } from 'react';
import {
  Coins,
  Loader2,
  AlertTriangle,
  Banknote,
  CreditCard,
  RotateCcw,
  RefreshCw,
  ArrowRight,
  Wallet,
  ArrowUpRight,
  TrendingDown,
  Clock,
  CheckCircle2,
  Receipt,
  Printer,
} from 'lucide-react';
import { formatPKR, formatDateTimeDDMMYYYY } from '../../../utils/formatters';
import { frontdeskApiService } from '../../../services/frontdeskApiService';
import { useRouter } from '../../../context/RouterContext';
import { useAuth } from '../../../context/AuthContext';
import { printTable, downloadTablePDF, downloadTableExcel, downloadTableCSV, ExportColumn } from '../../../services/tableExportService';
import { ExportButtonGroup } from '../../superAdmin/financeControl/ExportButtonGroup';

interface BalanceSheetTransaction {
  id: string;
  direction: 'IN' | 'OUT';
  amount: number;
  category: string;
  isPhysicalCash: boolean;
  occurredAt: string;
  receiptNumber: string | null;
  invoiceNumber: string | null;
  paymentMethod: string;
}

interface BalanceSheetData {
  summary: {
    expectedPhysicalCash: number;
    /** Guide §5.1 — shortfall carried from the last settlement, already folded into `expectedPhysicalCash`. */
    carriedForwardAmount: number;
    physicalCashIn: number;
    physicalCashOut: number;
    nonPhysicalTotal: number;
    totalCollections: number;
    totalRefunds: number;
    unsettledCount: number;
  };
  transactions: BalanceSheetTransaction[];
}

const CATEGORY_LABEL: Record<string, string> = {
  COLLECTION: 'Collection',
  REFUND: 'Refund',
  EXPENSE: 'Expense',
  PURCHASE: 'Purchase',
  PETTY_CASH_ISSUE: 'Petty Cash',
  RECOVERY: 'Recovery',
};

const PRINT_COLUMNS: ExportColumn<BalanceSheetTransaction>[] = [
  { header: 'Receipt #', cell: (t) => t.receiptNumber || '—' },
  { header: 'Invoice Ref', cell: (t) => t.invoiceNumber || '—' },
  { header: 'Category', cell: (t) => CATEGORY_LABEL[t.category] || t.category },
  { header: 'Payment Method', cell: (t) => t.paymentMethod },
  { header: 'Amount', align: 'right', cell: (t) => `${t.direction === 'IN' ? '+' : '-'}${formatPKR(t.amount)}` },
  { header: 'Occurred At', align: 'right', cell: (t) => formatDateTimeDDMMYYYY(t.occurredAt) },
];

/**
 * "My Balance Sheet" (Guide §3) — the logged-in cashier's live, unsettled
 * custody position, backed by `GET /cash/balance-sheet`.
 */
export const MyBalanceSheetView: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError(null);
    try {
      const raw = await frontdeskApiService.getCashBalance();
      setData({
        summary: {
          expectedPhysicalCash: Number(raw.summary?.expectedPhysicalCash ?? 0),
          carriedForwardAmount: Number(raw.summary?.carriedForwardAmount ?? 0),
          physicalCashIn: Number(raw.summary?.physicalCashIn ?? 0),
          physicalCashOut: Number(raw.summary?.physicalCashOut ?? 0),
          nonPhysicalTotal: Number(raw.summary?.nonPhysicalTotal ?? 0),
          totalCollections: Number(raw.summary?.totalCollections ?? 0),
          totalRefunds: Number(raw.summary?.totalRefunds ?? 0),
          unsettledCount: Number(raw.summary?.unsettledCount ?? 0),
        },
        transactions: (raw.transactions || []).map((t: any) => ({
          id: t.id,
          direction: t.direction,
          amount: Number(t.amount ?? 0),
          category: t.category,
          isPhysicalCash: !!t.isPhysicalCash,
          occurredAt: t.occurredAt,
          receiptNumber: t.receiptNumber,
          invoiceNumber: t.invoiceNumber,
          paymentMethod: t.paymentMethod,
        })),
      });
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load your balance sheet.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" /> <span>Loading your balance sheet…</span>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-rose-700 font-medium">{loadError}</p>
        <button
          onClick={() => load()}
          className="px-4 py-2 bg-[#08775A] hover:bg-[#0e7d5a] text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, transactions } = data;
  const hasUnsettled = summary.unsettledCount > 0;

  const inTransactions = transactions.filter((t) => t.direction === 'IN');
  const outTransactions = transactions.filter((t) => t.direction === 'OUT');

  const exportContext = {
    documentTitle: 'My Balance Sheet & Cash Custody',
    documentSubtitle: `Cash Custody — ${currentUser?.name || ''} (${currentUser?.role || ''})`,
    filenamePrefix: 'My_Balance_Sheet',
    columns: PRINT_COLUMNS,
    rows: transactions,
    currentUser,
    periodLabel: 'Live Shift Custody',
    filters: [
      `Expected Physical Cash: ${formatPKR(summary.expectedPhysicalCash)}`,
      `Total Collections: ${formatPKR(summary.totalCollections)}`,
      `Total Refunds: ${formatPKR(summary.totalRefunds)}`,
    ],
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header & Export Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Balance Sheet</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cashier shift balance sheet, live collections, refunds, and physical handover audit.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ExportButtonGroup
            disabled={transactions.length === 0}
            onExcel={() => downloadTableExcel(exportContext)}
            onCsv={() => downloadTableCSV(exportContext)}
            onPdf={() => downloadTablePDF(exportContext)}
            onPrint={() => printTable(exportContext)}
          />
          <button
            type="button"
            onClick={() => load(true)}
            disabled={isRefreshing}
            className="h-7.5 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
            title="Refresh balance sheet"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          {hasUnsettled ? (
            <button
              type="button"
              onClick={() => navigate('/front-desk/my_account_settlement')}
              className="h-7.5 px-3.5 rounded-md bg-[#08775A] hover:bg-[#065f46] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>Settle Account</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="h-7.5 px-3 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Settled</span>
            </span>
          )}
        </div>
      </div>

      {/* Dark Theme Header Banner (matching reference UI) */}
      <div className="bg-gradient-to-r from-[#0a4636] to-[#08775A] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide text-white">
          <div className="h-6 w-6 rounded bg-white/15 text-white flex items-center justify-center">
            <Coins className="h-3.5 w-3.5" />
          </div>
          <span>Balance Sheet — Cash Custody Position</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-100 font-medium bg-white/10 px-2.5 py-0.5 rounded-md">
            Cashier: {currentUser?.name || 'Front Desk'}
          </span>
        </div>
      </div>

      {/* Dual Side-by-Side Tables (Payments vs Expenses / Refunds) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Table: Payments / Collections */}
        <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#16a34a] text-white px-3.5 py-2 font-bold text-xs tracking-wide flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5" />
                Payments (Collections)
              </span>
              <span className="text-[11px] font-normal text-emerald-100">
                {inTransactions.length} item{inTransactions.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f1f5f9] border-b border-slate-300 sticky top-0 z-10 text-slate-800 text-[11px] font-bold uppercase">
                    <th className="w-10 py-2.5 px-2.5 text-center border-r border-slate-300">#</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Receipt / Ref</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Category</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Method</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {inTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        No payment records in current custody
                      </td>
                    </tr>
                  ) : (
                    inTransactions.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-2.5 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/50">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px] font-semibold text-[#08775A] whitespace-nowrap">
                          {t.receiptNumber || t.invoiceNumber || '—'}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap text-slate-700">
                          {CATEGORY_LABEL[t.category] || t.category}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-medium ${t.isPhysicalCash ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'}`}>
                            {t.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {formatPKR(t.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Footer Total */}
          <div className="border-t border-slate-300 flex items-center justify-between bg-slate-50 text-xs font-bold">
            <span className="py-2.5 px-3.5 text-slate-700 uppercase tracking-wide">Total</span>
            <span className="py-2.5 px-4 bg-[#dcfce7] text-emerald-900 font-mono text-sm border-l border-slate-300">
              {formatPKR(summary.totalCollections)}
            </span>
          </div>
        </div>

        {/* Right Table: Expenses / Refunds */}
        <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-[#ef4444] text-white px-3.5 py-2 font-bold text-xs tracking-wide flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Expenses &amp; Refunds
              </span>
              <span className="text-[11px] font-normal text-rose-100">
                {outTransactions.length} item{outTransactions.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f1f5f9] border-b border-slate-300 sticky top-0 z-10 text-slate-800 text-[11px] font-bold uppercase">
                    <th className="w-10 py-2.5 px-2.5 text-center border-r border-slate-300">#</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Ref / Receipt</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Expense / Reason</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Method</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {outTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        No expense / refund records in current custody
                      </td>
                    </tr>
                  ) : (
                    outTransactions.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-2.5 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/50">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px] font-semibold text-rose-600 whitespace-nowrap">
                          {t.receiptNumber || t.invoiceNumber || '—'}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap text-slate-700">
                          {CATEGORY_LABEL[t.category] || t.category}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-medium ${t.isPhysicalCash ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'}`}>
                            {t.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                          {formatPKR(t.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Footer Total */}
          <div className="border-t border-slate-300 flex items-center justify-between bg-slate-50 text-xs font-bold">
            <span className="py-2.5 px-3.5 text-slate-700 uppercase tracking-wide">Total</span>
            <span className="py-2.5 px-4 bg-[#fee2e2] text-rose-900 font-mono text-sm border-l border-slate-300">
              {formatPKR(summary.totalRefunds)}
            </span>
          </div>
        </div>
      </div>

      {/* Settlement Status Banner */}
      {hasUnsettled ? (
        <div className="bg-[#fef3c7] border border-amber-300 text-amber-900 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              Active shift custody: <strong>{formatPKR(summary.expectedPhysicalCash)}</strong> in physical cash to hand over ({summary.unsettledCount} pending transaction{summary.unsettledCount === 1 ? '' : 's'}).
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/front-desk/my_account_settlement')}
            className="px-3 py-1 bg-[#08775A] hover:bg-[#065f46] text-white text-xs font-bold rounded shadow-xs cursor-pointer shrink-0"
          >
            Submit Settlement Now
          </button>
        </div>
      ) : (
        <div className="bg-[#dcfce7] border border-emerald-300 text-emerald-800 rounded-lg p-3 text-xs flex items-center gap-2 shadow-2xs font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
          <span>This balance sheet scope is already settled for the selected shift. No pending physical cash in custody.</span>
        </div>
      )}

      {/* Balance Summary Section (Clean bordered grid matching reference UI) */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wider">
          Balance Summary
        </div>
        <div className="divide-y divide-slate-200 text-xs">
          <div className="flex items-center justify-between">
            <span className="py-2.5 px-4 text-slate-600 font-medium">Total Collections / Payments:</span>
            <span className="py-2.5 px-4 bg-[#dcfce7] text-emerald-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
              {formatPKR(summary.totalCollections)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="py-2.5 px-4 text-slate-600 font-medium">Total Refunds / Expenses:</span>
            <span className="py-2.5 px-4 bg-[#fee2e2] text-rose-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
              {formatPKR(summary.totalRefunds)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="py-2.5 px-4 text-slate-600 font-medium">Non-Cash (Card / Online / Bank):</span>
            <span className="py-2.5 px-4 bg-blue-50 text-blue-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
              {formatPKR(summary.nonPhysicalTotal)}
            </span>
          </div>
          {summary.carriedForwardAmount > 0 && (
            <div className="flex items-center justify-between">
              <span className="py-2.5 px-4 text-slate-600 font-medium">Previous Unsettled / Carried Forward Shortfall:</span>
              <span className="py-2.5 px-4 bg-amber-50 text-amber-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                {formatPKR(summary.carriedForwardAmount)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between bg-slate-50/50">
            <span className="py-3 px-4 text-slate-900 font-bold">Cash In Hand (Expected Physical Cash Handover):</span>
            <span className="py-3 px-4 bg-[#bbf7d0] text-emerald-950 font-black font-mono text-sm min-w-44 text-right border-l border-slate-200">
              {formatPKR(summary.expectedPhysicalCash)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

