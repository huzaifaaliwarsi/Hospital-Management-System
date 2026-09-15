import React, { useEffect, useState } from 'react';
import { UserCheck, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { NumberInput, Textarea } from '../../../components/forms/FormControls';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import { frontdeskApiService } from '../../../services/frontdeskApiService';
import { fetchMySettlements, submitSettlement, SettlementRecord } from '../../../services/settlementService';

const STATUS_BADGE: Record<string, string> = {
  PREPARED: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  PARTIALLY_ACCEPTED: 'bg-amber-100 text-amber-700',
  RETURNED: 'bg-orange-100 text-orange-700',
  REJECTED: 'bg-rose-100 text-rose-700',
};

/**
 * My Account Settlement (HMS_V7.2_NEW_REQUIREMENTS.md §3.3) — a Front Desk
 * cashier closes out their shift here: count physical cash, submit against
 * the real expected-cash figure from `My Balance Sheet`'s same ledger, and
 * every included transaction flips to settled. Admin/Super Admin review of
 * a submitted settlement is a separate screen, not built yet.
 */
export const MyAccountSettlementView: React.FC = () => {
  const toast = useToast();
  const [expectedCash, setExpectedCash] = useState(0);
  const [unsettledCount, setUnsettledCount] = useState(0);
  const [history, setHistory] = useState<SettlementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [physicalCash, setPhysicalCash] = useState<number | ''>('');
  const [varianceReason, setVarianceReason] = useState('');
  const [handoverAmount, setHandoverAmount] = useState<number | ''>('');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [balance, settlements] = await Promise.all([frontdeskApiService.getCashBalance(), fetchMySettlements()]);
      setExpectedCash(Number(balance.summary?.expectedPhysicalCash ?? 0));
      setUnsettledCount(balance.summary?.unsettledCount ?? 0);
      setHistory(settlements);
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load settlement data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const variance = physicalCash === '' ? 0 : Number(physicalCash) - expectedCash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (physicalCash === '' || Number(physicalCash) < 0) {
      setFormError('Enter the physical cash you counted.');
      return;
    }
    if (variance !== 0 && !varianceReason.trim()) {
      setFormError(`Physical cash doesn't match expected cash (${formatPKR(expectedCash)}) — a variance reason is required.`);
      return;
    }
    setIsSaving(true);
    try {
      await submitSettlement({
        physicalCash: Number(physicalCash),
        varianceReason: varianceReason.trim() || undefined,
        handoverAmount: handoverAmount === '' ? undefined : Number(handoverAmount),
        remarks: remarks.trim() || undefined,
      });
      toast.success('Settlement submitted for review.');
      setPhysicalCash('');
      setVarianceReason('');
      setHandoverAmount('');
      setRemarks('');
      load();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit settlement.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
          <UserCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Account Settlement</h1>
          <p className="text-xs text-slate-500 mt-0.5">Close out your shift — count physical cash and submit against your unsettled collections.</p>
        </div>
      </div>

      {loadError ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center gap-2 text-center shadow-xs">
          <AlertCircle className="h-6 w-6 text-rose-500" />
          <p className="text-xs text-rose-700 font-medium">{loadError}</p>
          <button type="button" onClick={load} className="mt-1 text-xs font-semibold text-[#08775A] hover:underline">
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 flex items-center justify-center gap-2 text-slate-400 shadow-xs">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Loading…</span>
        </div>
      ) : (
        <>
          {unsettledCount === 0 ? (
            <div className="bg-white rounded-xl border border-emerald-200 p-6 shadow-xs flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <p className="text-xs text-slate-600">Nothing to settle right now — every collection is already settled.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">Expected Cash (unsettled)</span>
                  <span className="font-bold text-slate-800 text-sm">{formatPKR(expectedCash)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">Unsettled Transactions</span>
                  <span className="font-bold text-slate-800 text-sm">{unsettledCount}</span>
                </div>
              </div>

              <NumberInput
                label="Physical Cash Counted"
                required
                min={0}
                value={physicalCash}
                onChange={(e) => setPhysicalCash(e.target.value === '' ? '' : Number(e.target.value))}
                hint="Count your drawer and enter the actual amount."
              />

              {physicalCash !== '' && variance !== 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  Variance: <strong>{formatPKR(variance)}</strong> ({variance > 0 ? 'over' : 'short'}) — reason required below.
                </div>
              )}

              <Textarea
                label="Variance Reason"
                required={variance !== 0}
                rows={2}
                value={varianceReason}
                onChange={(e) => setVarianceReason(e.target.value)}
                placeholder="Required only if physical cash doesn't match expected cash"
              />
              <NumberInput
                label="Handover Amount (optional)"
                min={0}
                value={handoverAmount}
                onChange={(e) => setHandoverAmount(e.target.value === '' ? '' : Number(e.target.value))}
                hint="Cash physically handed over to the next shift / cash office."
              />
              <Textarea label="Remarks (optional)" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Submit Settlement
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Settlement History</h3>
            </div>
            {history.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No settlements submitted yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Submitted', 'Period', 'Expected', 'Physical', 'Variance', 'Status'].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((s) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{s.submittedAt}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                          {s.periodStart} → {s.periodEnd}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-800">{formatPKR(s.expectedCash)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-800">{formatPKR(s.physicalCash)}</td>
                        <td className={`px-3 py-2.5 whitespace-nowrap font-semibold ${s.variance === 0 ? 'text-slate-500' : s.variance > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatPKR(s.variance)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_BADGE[s.status] || 'bg-slate-100 text-slate-600'}`}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
