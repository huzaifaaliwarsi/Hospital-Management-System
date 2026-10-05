import React, { useEffect, useMemo, useState } from 'react';
import { Landmark, Loader2, AlertTriangle, CheckCircle2, Send, RefreshCw } from 'lucide-react';
import { formatPKR } from '../../../utils/formatters';
import {
  PharmacySettlement,
  SettlementPaymentMethod,
  SETTLEMENT_PAYMENT_METHOD_LABELS,
  fetchPharmacySettlements,
  releasePharmacySettlement,
} from '../../../services/pharmacySettlementService';
import { Modal } from '../../../components/common/Modal';
import { NumberInput, Select, TextInput } from '../../../components/forms/FormControls';
import { useToast } from '../../../context/ToastContext';

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: 'bg-blue-50 text-blue-700',
  PARTIALLY_RELEASED: 'bg-indigo-50 text-indigo-700',
  SETTLED: 'bg-emerald-50 text-emerald-800',
  REJECTED: 'bg-rose-50 text-rose-700',
};

/**
 * Pharmacy Integration — Settlement Release (HMS_V7.2_NEW_REQUIREMENTS.md
 * Pharmacy Bridge §Inter-Entity Settlement). Pharmacy requests money back
 * for admission-linked dispenses HMS Front Desk already collected from the
 * patient; releasing that money is the one place this amount actually
 * moves, so it's restricted to Super Admin / Admin both here (this view is
 * only reachable from their shared module nav) and server-side
 * (`pharmacy-bridge.service.ts`'s `releaseSettlement`).
 */
export const PharmacySettlementsView: React.FC = () => {
  const toast = useToast();
  const [settlements, setSettlements] = useState<PharmacySettlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'PENDING' | 'SETTLED'>('PENDING');

  const [activeRow, setActiveRow] = useState<PharmacySettlement | null>(null);
  const [releaseAmount, setReleaseAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<SettlementPaymentMethod>('BANK' as SettlementPaymentMethod);
  const [paymentReference, setPaymentReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setSettlements(await fetchPharmacySettlements());
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load pharmacy settlements.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      fetchPharmacySettlements()
        .then((data) => setSettlements(data))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === 'All') return settlements;
    if (statusFilter === 'PENDING') return settlements.filter((s) => s.status === 'REQUESTED' || s.status === 'PARTIALLY_RELEASED');
    return settlements.filter((s) => s.status === 'SETTLED');
  }, [settlements, statusFilter]);

  const totalPendingAmount = useMemo(
    () => settlements.filter((s) => s.status === 'REQUESTED' || s.status === 'PARTIALLY_RELEASED').reduce((sum, s) => sum + s.remainingAmount, 0),
    [settlements],
  );

  const openRelease = (row: PharmacySettlement) => {
    setActiveRow(row);
    setReleaseAmount(row.remainingAmount);
    setPaymentMethod('BANK');
    setPaymentReference('');
    setRemarks('');
    setFormError(null);
  };

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRow) return;
    if (!releaseAmount || releaseAmount <= 0) {
      setFormError('Enter a valid amount to release.');
      return;
    }
    if (releaseAmount > activeRow.remainingAmount) {
      setFormError(`Cannot release more than the remaining amount (${formatPKR(activeRow.remainingAmount)}).`);
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await releasePharmacySettlement(activeRow.id, {
        releasedAmount: releaseAmount,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      toast.success(`Released ${formatPKR(releaseAmount)} to Pharmacy for ${activeRow.pharmacyInvoiceNumber}.`);
      setActiveRow(null);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to release settlement.';
      setFormError(msg);
      toast.error(msg, 'Release Failed');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading pharmacy settlements…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-rose-700 font-medium">{loadError}</p>
        <button type="button" onClick={load} className="px-4 py-2 bg-[#08775A] hover:bg-[#0e7d5a] text-white text-xs font-semibold rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">Pharmacy Settlement Release</h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
              Super Admin / Admin only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Money the Front Desk collected from admitted patients for admission-linked (HMS_LINKED) Pharmacy dispenses. Pharmacy requests it
            back here; releasing a payment actually moves money and notifies Pharmacy's own system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#08775A]' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>
          <div className="shrink-0 text-right">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Pending Release</div>
            <div className="text-lg font-bold text-amber-800">{formatPKR(totalPendingAmount)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500">Show:</span>
        {(['PENDING', 'SETTLED', 'All'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              statusFilter === f ? 'bg-[#08775A] text-white border-[#08775A]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'PENDING' ? 'Pending' : f === 'SETTLED' ? 'Settled' : 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4">Settlement / Invoice</th>
                <th className="py-2.5 px-4">Patient / Admission</th>
                <th className="py-2.5 px-4 text-right">Requested</th>
                <th className="py-2.5 px-4 text-right">Released</th>
                <th className="py-2.5 px-4 text-right">Remaining</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Requested At</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-4">
                    <div className="font-bold text-slate-900">{s.settlementNumber}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{s.pharmacyInvoiceNumber}</div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-semibold text-slate-800">{s.patientName}</div>
                    <div className="text-[11px] text-slate-400">{s.admissionNumber || '—'}</div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">{formatPKR(s.requestedAmount)}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-emerald-700">{formatPKR(s.releasedAmount)}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-800">{formatPKR(s.remainingAmount)}</td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_STYLE[s.status] || ''}`}>
                      {s.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-[11px] text-slate-500">{s.requestedAt}</td>
                  <td className="py-2.5 px-4 text-center">
                    {s.remainingAmount > 0 ? (
                      <button
                        type="button"
                        onClick={() => openRelease(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-md transition-colors cursor-pointer"
                      >
                        <Send className="h-3 w-3" /> Release
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                        <CheckCircle2 className="h-3 w-3" /> Settled
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Landmark className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <span className="font-semibold text-xs text-slate-700 block">No settlement requests in this view.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!activeRow} onClose={() => setActiveRow(null)} title={`Release Payment — ${activeRow?.pharmacyInvoiceNumber ?? ''}`} maxWidth="lg">
        {activeRow && (
          <form onSubmit={handleRelease} className="space-y-4">
            {formError && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">{formError}</div>}
            <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              {activeRow.patientName} ({activeRow.admissionNumber || '—'}) · Remaining: <strong className="text-slate-800">{formatPKR(activeRow.remainingAmount)}</strong>
              {activeRow.remarks && <div className="mt-1">Pharmacy's note: "{activeRow.remarks}"</div>}
            </div>
            <NumberInput
              label="Amount to Release (PKR)"
              required
              min={0}
              max={activeRow.remainingAmount}
              value={releaseAmount}
              onChange={(e) => setReleaseAmount(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Payment Method"
                options={(Object.keys(SETTLEMENT_PAYMENT_METHOD_LABELS) as SettlementPaymentMethod[]).map((v) => ({
                  label: SETTLEMENT_PAYMENT_METHOD_LABELS[v],
                  value: v,
                }))}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as SettlementPaymentMethod)}
              />
              <TextInput label="Payment Reference" placeholder="Bank/cheque reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
            </div>
            <TextInput label="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setActiveRow(null)} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Release Payment
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
