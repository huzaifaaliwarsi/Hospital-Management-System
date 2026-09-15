import React from 'react';
import { formatPKR } from '../../../utils/formatters';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/StateViews';
import { PanelStatement } from '../../../services/panelBillingService';

interface PanelInterimStatementSectionProps {
  statement: PanelStatement | null;
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
}

/**
 * Panel Interim Statement (HMS_V7.2_NEW_REQUIREMENTS.md §2.5) — every
 * invoice with a panel receivable, with Patient Share and Panel Receivable
 * always shown in separate column groups, never blended into one "due"
 * figure.
 */
export const PanelInterimStatementSection: React.FC<PanelInterimStatementSectionProps> = ({
  statement,
  isLoading,
  loadError,
  onRetry,
}) => {
  if (isLoading) return <LoadingState message="Loading panel statement…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={onRetry} />;
  if (!statement || statement.invoices.length === 0) {
    return <EmptyState title="No panel-receivable invoices" description="This panel has no invoices with a panel-covered portion yet." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
          <span className="text-[10px] text-amber-700 uppercase block">Patient Share Outstanding</span>
          <span className="font-bold text-amber-800">{formatPKR(statement.consolidated.patientShareOutstanding)}</span>
        </div>
        <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
          <span className="text-[10px] text-purple-700 uppercase block">Panel Receivable (Total)</span>
          <span className="font-bold text-purple-800">{formatPKR(statement.consolidated.panelReceivable)}</span>
        </div>
        <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
          <span className="text-[10px] text-emerald-700 uppercase block">Panel Receivable Outstanding</span>
          <span className="font-bold text-emerald-800">{formatPKR(statement.consolidated.panelReceivableOutstanding)}</span>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Patient</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Department</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Invoice</th>
              <th className="text-right px-3 py-2 font-semibold text-amber-700 whitespace-nowrap">Patient Share</th>
              <th className="text-right px-3 py-2 font-semibold text-amber-700 whitespace-nowrap">Collected</th>
              <th className="text-right px-3 py-2 font-semibold text-amber-700 whitespace-nowrap">Outstanding</th>
              <th className="text-right px-3 py-2 font-semibold text-purple-700 whitespace-nowrap">Panel Receivable</th>
              <th className="text-right px-3 py-2 font-semibold text-purple-700 whitespace-nowrap">Realized</th>
              <th className="text-right px-3 py-2 font-semibold text-purple-700 whitespace-nowrap">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {statement.invoices.map((inv) => (
              <tr key={inv.hospitalInvoiceId} className="hover:bg-slate-50/60">
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="font-semibold text-slate-900">{inv.patientName}</div>
                  <div className="text-[10px] text-slate-400">{inv.patientMrNumber}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{inv.departmentName}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-slate-600">{inv.invoiceNumber}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right">{formatPKR(inv.patientShare)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right text-emerald-700">{formatPKR(inv.patientShareCollected)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-amber-700">
                  {formatPKR(inv.patientShareOutstanding)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-right">{formatPKR(inv.panelReceivable)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right text-emerald-700">{formatPKR(inv.panelReceivableRealized)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-purple-700">
                  {formatPKR(inv.panelReceivableOutstanding)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
