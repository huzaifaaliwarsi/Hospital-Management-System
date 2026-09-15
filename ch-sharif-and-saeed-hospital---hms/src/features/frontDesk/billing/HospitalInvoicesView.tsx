import React, { useState, useEffect, useMemo } from 'react';
import { Receipt, Loader2, AlertTriangle, Search } from 'lucide-react';
import { formatPKR } from '../../../utils/formatters';
import { fetchInvoices, InvoiceSummary, InvoiceStatus, EncounterType } from '../../../services/invoiceService';
import { InvoiceDetailModal } from './InvoiceDetailModal';

interface HospitalInvoicesViewProps {
  /** When true, only invoices with an outstanding balance are shown (Outstanding Balances nav item). */
  outstandingOnly?: boolean;
  /** When set, only invoices of this encounter type are fetched (OPD/Observation/Emergency queue nav items) — backend-filtered, not client-side. */
  encounterTypeFilter?: EncounterType;
  title?: string;
  subtitle?: string;
}

/**
 * Real Hospital Invoices list — backed by `GET /invoices`. Also serves as
 * the Outstanding Balances / Payments-Receipts / Discounts / Refunds /
 * OPD / Observation / Emergency queue nav items (`outstandingOnly` /
 * `encounterTypeFilter` props + the shared `InvoiceDetailModal`'s action
 * tabs cover all of them — a deliberate consolidation given today's scope;
 * see HMS_V7.2_NEW_REQUIREMENTS.md's progress log).
 */
export const HospitalInvoicesView: React.FC<HospitalInvoicesViewProps> = ({
  outstandingOnly = false,
  encounterTypeFilter,
  title = 'Hospital Invoices',
  subtitle = 'Every walk-in, appointment and admission invoice — service lines, discounts, payments and refunds in one place.',
}) => {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoiceStatus>('ALL');
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setInvoices(await fetchInvoices(encounterTypeFilter ? { encounterType: encounterTypeFilter } : undefined));
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load invoices.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterTypeFilter]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (outstandingOnly && inv.balanceDue <= 0) return false;
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (!inv.invoiceNumber.toLowerCase().includes(q) && !inv.patientName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [invoices, outstandingOnly, statusFilter, searchTerm]);

  const totalOutstanding = useMemo(() => filtered.reduce((sum, i) => sum + i.balanceDue, 0), [filtered]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" /> <span>Loading invoices…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-rose-700 font-medium">{loadError}</p>
        <button onClick={load} className="px-4 py-2 bg-[#08775A] hover:bg-[#0e7d5a] text-white text-xs font-semibold rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">{subtitle}</p>
        </div>
        {outstandingOnly && (
          <div className="text-right">
            <span className="text-[10px] text-slate-500 uppercase block">Total Outstanding</span>
            <span className="text-lg font-bold text-rose-700">{formatPKR(totalOutstanding)}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice # or patient name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8.5 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75] bg-slate-50/50"
          />
        </div>
        {!outstandingOnly && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#149E75]"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="VOID">Void</option>
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-4">Patient</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4 text-right">Net</th>
                <th className="py-2.5 px-4 text-right">Paid</th>
                <th className="py-2.5 px-4 text-right">Due</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80 cursor-pointer" onClick={() => setOpenInvoiceId(inv.id)}>
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                  <td className="py-2.5 px-4">
                    <span className="font-semibold text-slate-900">{inv.patientName}</span>
                    <span className="text-[10px] text-slate-400 block">{inv.patientMr}</span>
                  </td>
                  <td className="py-2.5 px-4">{inv.encounterType || inv.sourceType}</td>
                  <td className="py-2.5 px-4 text-right font-mono">{formatPKR(inv.total)}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-emerald-700">{formatPKR(inv.paidTotal)}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-700">{inv.balanceDue > 0 ? formatPKR(inv.balanceDue) : '—'}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-800' :
                      inv.status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-800' :
                      inv.status === 'VOID' ? 'bg-slate-200 text-slate-600' : 'bg-rose-50 text-rose-800'
                    }`}>{inv.status}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-[11px] text-slate-500">{inv.createdAt}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Receipt className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <span className="font-semibold text-xs text-slate-700 block">
                      {outstandingOnly ? 'No outstanding balances — all invoices settled.' : 'No invoices match your search.'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openInvoiceId && (
        <InvoiceDetailModal invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} onChanged={load} />
      )}
    </div>
  );
};
