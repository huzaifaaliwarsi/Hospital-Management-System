import React, { useEffect, useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import apiClient from '../services/apiClient';
import { formatPKR } from '../utils/format';
import { useToast } from '../context/ToastContext';

const CATEGORY_LABEL: Record<string, string> = {
  PETTY_CASH_ISSUED: 'Petty Cash Issued',
  PETTY_CASH_RECEIVED: 'Petty Cash Received',
  POS_COLLECTION: 'POS Collection',
  HMS_COLLECTION: 'HMS Collection',
  REFUND: 'Refund',
  VENDOR_PAYMENT: 'Vendor Payment',
  EXPENSE_PAYMENT: 'Expense Payment',
  SETTLEMENT_HANDOVER: 'Settlement Handover',
  ADJUSTMENT: 'Adjustment',
};

export const BalanceSheetPage: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    apiClient.get('/cash/balance-sheet').then((r) => setData(r.data.data)).catch(() => toast.error('Failed to load balance sheet.')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="p-10 flex items-center justify-center gap-2 text-[#52665e] text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!data) return null;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#111827]">My Balance Sheet</h2>
        <p className="text-xs text-[#52665e]">pharmacy.md §11.2 — Expected Cash is always system-calculated, never entered manually.</p>
      </div>

      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 flex items-center gap-4 max-w-sm">
        <div className="h-12 w-12 rounded-lg bg-[#effaf5] border border-[#c2e7db] flex items-center justify-center"><Wallet className="h-6 w-6 text-[#129b70]" /></div>
        <div>
          <div className="text-[11px] font-semibold text-[#52665e] uppercase">Expected Cash</div>
          <div className="text-2xl font-bold text-[#111827]">{formatPKR(data.expectedCash)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(data.breakdown).map(([cat, amount]) => (
          <div key={cat} className="bg-white rounded-lg border border-[#e2eae5] p-3">
            <div className="text-[10px] font-semibold text-[#52665e] uppercase truncate">{CATEGORY_LABEL[cat] ?? cat}</div>
            <div className="text-sm font-bold text-[#111827] tabular-nums">{formatPKR(amount as number)}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#e2eae5] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f6faf8]">
            <tr className="text-[11px] font-bold uppercase tracking-wide text-[#52665e]">
              <th className="py-2.5 px-3 text-left">Date</th>
              <th className="py-2.5 px-3 text-left">Category</th>
              <th className="py-2.5 px-3 text-center">Direction</th>
              <th className="py-2.5 px-3 text-right">Amount</th>
              <th className="py-2.5 px-3 text-center">Settled</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-[#94a3b8]">No cash activity yet.</td></tr>
            ) : (
              data.entries.map((e: any) => (
                <tr key={e.id} className="border-t border-[#f0f4f2]">
                  <td className="py-2 px-3 text-xs">{new Date(e.occurredAt).toLocaleString('en-GB')}</td>
                  <td className="py-2 px-3 text-xs">{CATEGORY_LABEL[e.category] ?? e.category}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${e.direction === 'IN' ? 'bg-[#effaf5] text-[#0e7d5a] border-[#c2e7db]' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{e.direction}</span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">{formatPKR(e.amount)}</td>
                  <td className="py-2 px-3 text-center text-xs text-[#94a3b8]">{e.isSettled ? 'Yes' : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
