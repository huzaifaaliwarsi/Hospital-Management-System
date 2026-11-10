import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import apiClient from '../../../services/apiClient';
import { formatPKR } from '../../../utils/formatters';

export interface StaffPaymentRecord {
  id: string; amount: string | number; method: string; paidAt: string;
  reversalOfId?: string | null; reversalReason?: string | null; cashEntryId?: string | null;
}

export function StaffPaymentHistory({ payments, kind, onChanged }: {
  payments: StaffPaymentRecord[]; kind: 'salary' | 'commission'; onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!payments.length) return null;
  const reversed = new Set(payments.map(p => p.reversalOfId).filter(Boolean));
  async function reverse() {
    if (busy || !selected || reason.trim().length < 3) return;
    setBusy(true); setError('');
    try {
      await apiClient.post(kind === 'salary' ? `/payroll/payments/${selected}/reverse` : `/commission/payouts/${selected}/reverse`, { reason });
      await onChanged(); setSelected(''); setReason('');
    } catch (err: any) { setError(err?.response?.data?.error?.message ?? 'Could not reverse payment.'); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="ml-2 text-xs text-emerald-800 underline" onClick={() => setOpen(true)}>Payments</button>
    {open && createPortal(<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <section role="dialog" aria-modal="true" aria-label="Payment history" className="bg-white rounded-xl p-5 max-w-2xl w-full max-h-[85vh] overflow-auto text-sm text-slate-900">
        <div className="flex justify-between mb-4"><h2 className="font-bold">Payment history</h2><button type="button" disabled={busy} onClick={() => setOpen(false)}>Close</button></div>
        {payments.map(p => <div key={p.id} className="border-b py-3 flex justify-between gap-4">
          <div>{formatPKR(Number(p.amount))} · {p.method}<div className="text-xs text-slate-500">{new Date(p.paidAt).toLocaleString()}</div>
            {p.reversalReason && <div>{p.reversalReason}</div>}
            {p.method === 'CASH' && !p.cashEntryId && <div className="text-xs">Historical payment — no linked cash entry</div>}
          </div>
          {Number(p.amount) > 0 && !reversed.has(p.id) && <button type="button" disabled={busy} className="text-red-700" onClick={() => { setSelected(p.id); setReason(''); }}>Reverse payment</button>}
          {reversed.has(p.id) && <span>Reversed</span>}
        </div>)}
        {selected && <div className="mt-4 space-y-2">
          <p>Reverse only a payment that was cancelled or returned. This restores the unpaid balance and reverses its linked cash entry.</p>
          <label className="block">Reason<textarea className="block w-full border rounded p-2" value={reason} onChange={e => setReason(e.target.value)} /></label>
          <button type="button" disabled={busy || reason.trim().length < 3} className="bg-red-700 text-white rounded px-3 py-2 disabled:opacity-50" onClick={reverse}>{busy ? 'Saving…' : 'Confirm reversal'}</button>
        </div>}
        {error && <p role="alert" className="text-red-700 mt-3">{error}</p>}
      </section>
    </div>, document.body)}
  </>;
}
