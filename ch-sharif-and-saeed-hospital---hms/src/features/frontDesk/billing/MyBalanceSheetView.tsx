import React, { useState, useEffect } from 'react';
import { Coins, Loader2, AlertTriangle, Banknote, CreditCard, RotateCcw } from 'lucide-react';
import { formatPKR, formatDateTimeDDMMYYYY } from '../../../utils/formatters';
import { frontdeskApiService } from '../../../services/frontdeskApiService';

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
    physicalCashIn: number;
    physicalCashOut: number;
    nonPhysicalTotal: number;
    totalCollections: number;
    totalRefunds: number;
    unsettledCount: number;
  };
  transactions: BalanceSheetTransaction[];
}

/**
 * Real "My Balance Sheet" (§4.9) — the logged-in cashier's own unsettled
 * collections, backed by `GET /cash/balance-sheet`. Account Settlement
 * (closing out this list into a settled batch) is a separate action not
 * built today — this page is read-only.
 */
export const MyBalanceSheetView: React.FC = () => {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const raw = await frontdeskApiService.getCashBalance();
      setData({
        summary: {
          expectedPhysicalCash: Number(raw.summary?.expectedPhysicalCash ?? 0),
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
    }
  };

  useEffect(() => {
    load();
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
        <button onClick={load} className="px-4 py-2 bg-[#08775A] hover:bg-[#0e7d5a] text-white text-xs font-semibold rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150 max-w-4xl">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Balance Sheet</h1>
            <p className="text-xs text-slate-500 mt-0.5">Your own unsettled collections, live from the database.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-[#effaf5] rounded-xl border border-[#c2e7db]">
          <span className="text-[11px] text-[#0e7d5a] font-medium block">Expected Physical Cash</span>
          <span className="text-lg font-bold text-[#0e7d5a] font-mono block mt-1">{formatPKR(data.summary.expectedPhysicalCash)}</span>
        </div>
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <span className="text-[11px] text-slate-500 font-medium block">Non-Physical (Card/Bank/Online)</span>
          <span className="text-lg font-bold text-slate-900 font-mono block mt-1">{formatPKR(data.summary.nonPhysicalTotal)}</span>
        </div>
        <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
          <span className="text-[11px] text-emerald-800 font-medium block">Total Collections</span>
          <span className="text-lg font-bold text-emerald-900 font-mono block mt-1">{formatPKR(data.summary.totalCollections)}</span>
        </div>
        <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200">
          <span className="text-[11px] text-rose-800 font-medium block">Total Refunds</span>
          <span className="text-lg font-bold text-rose-900 font-mono block mt-1">{formatPKR(data.summary.totalRefunds)}</span>
        </div>
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <span className="text-[11px] text-slate-500 font-medium block">Physical Cash In / Out</span>
          <span className="text-sm font-bold text-slate-900 font-mono block mt-1">
            {formatPKR(data.summary.physicalCashIn)} / {formatPKR(data.summary.physicalCashOut)}
          </span>
        </div>
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
          <span className="text-[11px] text-amber-800 font-medium block">Unsettled Transactions</span>
          <span className="text-lg font-bold text-amber-900 font-mono block mt-1">{data.summary.unsettledCount}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Unsettled Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-2 px-3 font-semibold">Receipt</th>
                <th className="py-2 px-3 font-semibold">Invoice</th>
                <th className="py-2 px-3 font-semibold">Category</th>
                <th className="py-2 px-3 font-semibold">Method</th>
                <th className="py-2 px-3 font-semibold text-right">Amount</th>
                <th className="py-2 px-3 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.transactions.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">No unsettled transactions — all clear.</td></tr>
              ) : (
                data.transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono text-[11px] font-bold text-emerald-800">{t.receiptNumber || '—'}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{t.invoiceNumber || '—'}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {t.direction === 'IN' ? <Banknote className="h-2.5 w-2.5" /> : <RotateCcw className="h-2.5 w-2.5" />}
                        {t.category}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                        {t.isPhysicalCash ? <Banknote className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                        {t.paymentMethod}
                      </span>
                    </td>
                    <td className={`py-2 px-3 text-right font-bold font-mono ${t.direction === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {t.direction === 'IN' ? '+' : '-'}{formatPKR(t.amount)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500 font-mono text-[11px]">
                      {formatDateTimeDDMMYYYY(t.occurredAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
