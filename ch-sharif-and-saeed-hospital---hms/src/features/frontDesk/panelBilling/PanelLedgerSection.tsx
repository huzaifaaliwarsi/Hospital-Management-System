import React from 'react';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { formatPKR, formatDateDDMMYYYY } from '../../../utils/formatters';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/StateViews';
import { PanelLedger } from '../../../services/panelBillingService';

interface PanelLedgerSectionProps {
  ledger: PanelLedger | null;
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
}

/**
 * Company Ledger — one running-balance statement of the panel company's
 * payable: every panel-covered charge is a debit, every remittance a
 * credit. Patient co-pay is a separate total, never folded into this
 * balance (v7.2 hard rule: patient share and panel receivable stay apart).
 */
export const PanelLedgerSection: React.FC<PanelLedgerSectionProps> = ({ ledger, isLoading, loadError, onRetry }) => {
  if (isLoading) return <LoadingState message="Loading company ledger…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={onRetry} />;
  if (!ledger || ledger.entries.length === 0) {
    return <EmptyState title="No ledger activity yet" description="Panel-covered charges and remittances for this company will appear here as a running balance." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
          <span className="text-[10px] text-purple-700 uppercase block">Total Charged</span>
          <span className="font-bold text-purple-800">{formatPKR(ledger.totals.totalDebit)}</span>
        </div>
        <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
          <span className="text-[10px] text-emerald-700 uppercase block">Total Remitted</span>
          <span className="font-bold text-emerald-800">{formatPKR(ledger.totals.totalCredit)}</span>
        </div>
        <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200">
          <span className="text-[10px] text-rose-700 uppercase block">Closing Balance (Company Owes)</span>
          <span className="font-bold text-rose-800">{formatPKR(ledger.totals.closingBalance)}</span>
        </div>
        <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
          <span className="text-[10px] text-amber-700 uppercase block">Patient Co-Pay (Separate, Not In Balance)</span>
          <span className="font-bold text-amber-800">{formatPKR(ledger.patientCoPay.total)}</span>
          <span className="block text-[10px] text-amber-600 mt-0.5">
            Collected {formatPKR(ledger.patientCoPay.collected)} · Outstanding {formatPKR(ledger.patientCoPay.outstanding)}
          </span>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Date</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Reference</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Description</th>
              <th className="text-right px-3 py-2 font-semibold text-purple-700 whitespace-nowrap">Debit (Charge)</th>
              <th className="text-right px-3 py-2 font-semibold text-emerald-700 whitespace-nowrap">Credit (Received)</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">Running Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ledger.entries.map((e, idx) => (
              <tr key={`${e.type}-${e.reference}-${idx}`} className="hover:bg-slate-50/60">
                <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatDateDDMMYYYY(e.date)}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono font-semibold text-slate-800">
                  <span className="inline-flex items-center gap-1">
                    {e.type === 'CHARGE' ? (
                      <ArrowUpCircle className="h-3 w-3 text-purple-500" />
                    ) : (
                      <ArrowDownCircle className="h-3 w-3 text-emerald-500" />
                    )}
                    {e.reference}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                  {e.description}
                  {e.patientName && <span className="text-slate-400"> — {e.patientName}</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-purple-700">
                  {e.debit > 0 ? formatPKR(e.debit) : '—'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-emerald-700">
                  {e.credit > 0 ? formatPKR(e.credit) : '—'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-right font-bold text-slate-900">
                  {formatPKR(e.runningBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
