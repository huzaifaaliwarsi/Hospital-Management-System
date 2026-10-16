import React, { useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { TextInput, NumberInput } from '../../../components/forms/FormControls';

export const FinancialAdjustmentModal: React.FC<{ title: string; onClose: () => void; onSave: (amount: number, reason: string) => Promise<void> }> = ({ title, onClose, onSave }) => {
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Modal isOpen onClose={onClose} title={title} maxWidth="lg">
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setError('');
      if (!amount || reason.trim().length < 3) { setError('Enter a nonzero amount and a reason.'); return; }
      setBusy(true);
      try { await onSave(amount, reason.trim()); onClose(); }
      catch (e: any) { setError(e?.response?.data?.error?.message || 'Unable to post adjustment.'); }
      finally { setBusy(false); }
    }}>
      <p className="text-xs text-slate-500">Positive adds to net payable; negative reverses it. This creates a separate correction record and preserves the original calculation.</p>
      <NumberInput label="Net Adjustment (PKR)" step={0.01} required value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} />
      <TextInput label="Reason" required value={reason} onChange={e => setReason(e.target.value)} />
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button disabled={busy} className="px-4 py-2 rounded-lg bg-[#08775A] text-white disabled:opacity-50">{busy ? 'Saving…' : 'Post Adjustment'}</button>
    </form>
  </Modal>;
};
