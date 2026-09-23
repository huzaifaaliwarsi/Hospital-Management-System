import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatPKR } from '../../../utils/formatters';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/StateViews';
import { PanelRemittanceRecord } from '../../../services/panelBillingService';

interface PanelRemittanceHistorySectionProps {
  remittances: PanelRemittanceRecord[];
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
}

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const dateStr = `${day}/${month}/${year}`;
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

/** Panel Remittance history — every recorded remittance with its per-invoice allocation breakdown. */
export const PanelRemittanceHistorySection: React.FC<PanelRemittanceHistorySectionProps> = ({
  remittances,
  isLoading,
  loadError,
  onRetry,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <LoadingState message="Loading remittance history…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={onRetry} />;
  if (remittances.length === 0) {
    return <EmptyState title="No remittances recorded" description="Once a payment is recorded from this panel, it will appear here." />;
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap"></th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Remittance #</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Received</th>
            <th className="text-right px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Amount</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Method</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Reference</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Received By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {remittances.map((r) => {
            const isExpanded = expandedId === r.id;
            return (
              <React.Fragment key={r.id}>
                <tr className="hover:bg-slate-50/60 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                  <td className="px-3 py-2 text-slate-400">
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-slate-700">{r.remittanceNumber}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatTimestamp(r.receivedAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-purple-700">{formatPKR(r.amount)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{r.method.replace('_', ' ')}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">{r.reference || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">{r.receivedByName}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td />
                    <td colSpan={6} className="px-3 py-2 bg-slate-50/60">
                      {r.remarks && <p className="text-[11px] text-slate-500 mb-1.5">Remarks: {r.remarks}</p>}
                      <div className="space-y-1">
                        {r.allocations.map((a) => (
                          <div key={a.id} className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-600 font-mono">{a.invoiceNumber}</span>
                            <span className="font-semibold text-slate-800">{formatPKR(a.allocatedAmount)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
