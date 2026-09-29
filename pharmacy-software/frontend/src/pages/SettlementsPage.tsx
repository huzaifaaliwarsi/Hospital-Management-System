import React, { useEffect, useState } from 'react';
import { Loader2, Check, X as XIcon } from 'lucide-react';
import apiClient from '../services/apiClient';
import { formatPKR } from '../utils/format';
import { useToast } from '../context/ToastContext';

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
  ACCEPTED: 'bg-[#effaf5] text-[#0e7d5a] border-[#c2e7db]',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const SettlementsPage: React.FC<{ canReview: boolean }> = ({ canReview }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expected, setExpected] = useState<number | null>(null);
  const [physicalCash, setPhysicalCash] = useState('');
  const [periodFrom, setPeriodFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [periodTo, setPeriodTo] = useState(new Date().toISOString().slice(0, 10));
  const [varianceReason, setVarianceReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    apiClient.get('/cash/settlements').then((r) => setRows(r.data.data)).catch(() => toast.error('Failed to load settlements.')).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    apiClient.get('/cash/balance-sheet').then((r) => setExpected(Number(r.data.data.expectedCash)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (physicalCash === '') return toast.error('Enter your counted physical cash.');
    setSubmitting(true);
    try {
      await apiClient.post('/cash/settlements', { periodFrom, periodTo, physicalCash: Number(physicalCash), varianceReason: varianceReason || undefined });
      toast.success('Settlement submitted for review.');
      setPhysicalCash('');
      setVarianceReason('');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to submit settlement.');
    } finally {
      setSubmitting(false);
    }
  };

  const review = async (id: string, decision: 'ACCEPTED' | 'REJECTED') => {
    try {
      await apiClient.post(`/cash/settlements/${id}/review`, { decision });
      toast.success(`Settlement ${decision.toLowerCase()}.`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to review settlement.');
    }
  };

  const variance = expected !== null && physicalCash !== '' ? Number(physicalCash) - expected : null;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#111827]">Account Settlement</h2>
        <p className="text-xs text-[#52665e]">pharmacy.md §11.2 — cash handed to Admin; a non-zero variance requires a reason.</p>
      </div>

      {!canReview && (
        <div className="bg-white rounded-xl border border-[#e2eae5] p-4 space-y-3 max-w-lg">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Period From"><input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="input" /></Field>
            <Field label="Period To"><input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="input" /></Field>
          </div>
          <Field label="Expected Cash (system-calculated)"><div className="input flex items-center font-bold bg-[#f6faf8]">{expected !== null ? formatPKR(expected) : '—'}</div></Field>
          <Field label="Physical Cash (counted) *"><input type="number" value={physicalCash} onChange={(e) => setPhysicalCash(e.target.value)} className="input" /></Field>
          {variance !== null && variance !== 0 && (
            <>
              <div className={`text-xs font-semibold ${variance > 0 ? 'text-[#0e7d5a]' : 'text-rose-600'}`}>Variance: {formatPKR(variance)}</div>
              <Field label="Variance Reason *"><input value={varianceReason} onChange={(e) => setVarianceReason(e.target.value)} className="input" /></Field>
            </>
          )}
          <button onClick={handleSubmit} disabled={submitting} className="w-full h-9 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg disabled:opacity-60">{submitting ? 'Submitting…' : 'Submit Settlement'}</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e2eae5] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f6faf8]">
            <tr className="text-[11px] font-bold uppercase tracking-wide text-[#52665e]">
              <th className="py-2.5 px-3 text-left">Submitted By</th>
              <th className="py-2.5 px-3 text-left">Period</th>
              <th className="py-2.5 px-3 text-right">Expected</th>
              <th className="py-2.5 px-3 text-right">Physical</th>
              <th className="py-2.5 px-3 text-right">Variance</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              {canReview && <th className="py-2.5 px-3 text-center">Review</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#52665e]"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#94a3b8]">No settlements yet.</td></tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-t border-[#f0f4f2]">
                  <td className="py-2 px-3 text-[#52665e]">{s.submittedByUser?.fullName}</td>
                  <td className="py-2 px-3 text-xs">{new Date(s.periodFrom).toLocaleDateString('en-GB')} – {new Date(s.periodTo).toLocaleDateString('en-GB')}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{formatPKR(s.expectedCash)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{formatPKR(s.physicalCash)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{formatPKR(s.variance)}</td>
                  <td className="py-2 px-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[s.status]}`}>{s.status}</span></td>
                  {canReview && (
                    <td className="py-2 px-3 text-center">
                      {s.status === 'SUBMITTED' ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => review(s.id, 'ACCEPTED')} className="text-[#129b70] hover:text-[#0e7d5a]"><Check className="h-4 w-4" /></button>
                          <button onClick={() => review(s.id, 'REJECTED')} className="text-rose-500 hover:text-rose-700"><XIcon className="h-4 w-4" /></button>
                        </div>
                      ) : '—'}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <style>{`.input { width: 100%; height: 2.25rem; padding: 0 0.75rem; font-size: 0.875rem; background: white; border: 1px solid #e2eae5; border-radius: 0.5rem; } .input:focus { outline: none; box-shadow: 0 0 0 2px rgba(18,155,112,0.2); border-color: #129b70; }`}</style>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-semibold text-[#52665e] mb-1">{label}</label>
    {children}
  </div>
);
