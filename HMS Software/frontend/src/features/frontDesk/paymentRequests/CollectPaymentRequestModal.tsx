import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { NumberInput, Select, TextInput } from '../../../components/forms/FormControls';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import { collectPaymentRequest, PaymentMethod, PaymentRequestRecord } from '../../../services/paymentRequestService';

const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'Bank Transfer', value: 'BANK' },
  { label: 'Online', value: 'ONLINE' },
];

interface CollectPaymentRequestModalProps {
  request: PaymentRequestRecord;
  onClose: () => void;
  onCollected: () => void;
}

export const CollectPaymentRequestModal: React.FC<CollectPaymentRequestModalProps> = ({ request, onClose, onCollected }) => {
  const toast = useToast();
  const [amount, setAmount] = useState<number | ''>(request.remainingAmount);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (Number(amount) > request.remainingAmount) {
      setError(`Amount cannot exceed the remaining requested balance (${formatPKR(request.remainingAmount)}).`);
      return;
    }
    setIsSaving(true);
    try {
      await collectPaymentRequest(request.id, { amount: Number(amount), paymentMethod: method, reference: reference.trim() || undefined });
      toast.success(`Collected ${formatPKR(Number(amount))} against admission ${request.admissionNumber}.`);
      onCollected();
    } catch (err: any) {
      setError(err?.message || 'Failed to collect payment.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Collect Payment Request"
      subtitle={`${request.patientName} — Admission ${request.admissionNumber}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            form="collect-payment-request-form"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Collect
          </button>
        </>
      }
    >
      <form id="collect-payment-request-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase block">Requested ({request.requestType})</span>
            <span className="font-bold text-slate-800">{formatPKR(request.requestedAmount)}</span>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
            <span className="text-[10px] text-amber-700 uppercase block">Remaining</span>
            <span className="font-bold text-amber-800">{formatPKR(request.remainingAmount)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberInput label="Amount" required min={1} max={request.remainingAmount} value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} />
          <Select label="Payment Method" required options={PAYMENT_METHODS} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} />
        </div>
        <TextInput label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
      </form>
    </Modal>
  );
};
