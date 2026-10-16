import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { NumberInput, Select, TextInput } from '../../../components/forms/FormControls';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import {
  appointmentsApiService,
  AppointmentPaymentMethod,
  AppointmentReceiptRow,
  AppointmentRecord,
} from '../../../services/frontdeskApiService';

const PAYMENT_METHODS: { label: string; value: AppointmentPaymentMethod }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'Bank Transfer', value: 'BANK' },
  { label: 'Online', value: 'ONLINE' },
];

interface CollectAdvanceModalProps {
  appointment: AppointmentRecord;
  onClose: () => void;
  onCollected: () => void;
}

/** §14 — Collect Advance modal, reusable on any CONFIRMED/RESCHEDULED appointment. */
export const CollectAdvanceModal: React.FC<CollectAdvanceModalProps> = ({ appointment, onClose, onCollected }) => {
  const toast = useToast();
  const payable = appointment.invoiceId
    ? appointment.payerType === 'Corporate / Panel'
      ? appointment.patientShare
      : appointment.invoiceTotal
    : appointment.estimatedAmount;
  const remaining = Math.max(0, payable - appointment.advancePaid);

  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<AppointmentPaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [receipt, setReceipt] = useState<AppointmentReceiptRow | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid advance amount.');
      return;
    }
    if (Number(amount) > remaining) {
      setError(`Amount cannot exceed the remaining advance-eligible amount (${formatPKR(remaining)}).`);
      return;
    }

    setIsSaving(true);
    try {
      const r = await appointmentsApiService.collectAdvance(appointment.id, {
        amount: Number(amount),
        paymentMethod: method,
        reference: reference.trim() || undefined,
      });
      setReceipt(r);
      toast.success(`Advance of ${formatPKR(Number(amount))} collected.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to collect advance.');
    } finally {
      setIsSaving(false);
    }
  };

  if (receipt) {
    return (
      <Modal isOpen onClose={onCollected} title="Advance Collected" maxWidth="md">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold text-sm">Receipt generated</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block">Receipt #</span>
              <span className="font-mono font-bold">{receipt.receiptNumber}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block">Amount</span>
              <span className="font-bold">{formatPKR(receipt.amount)}</span>
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onCollected}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Collect Advance"
      subtitle={`${appointment.patientName} — ${appointment.serviceName}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            form="collect-advance-form"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Collect Advance
          </button>
        </>
      }
    >
      <form id="collect-advance-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase block">Patient Payable</span>
            <span className="font-bold text-slate-800">{formatPKR(payable)}</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase block">Advance Already Paid</span>
            <span className="font-bold text-emerald-700">{formatPKR(appointment.advancePaid)}</span>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 col-span-2">
            <span className="text-[10px] text-amber-700 uppercase block">Remaining Advance-Eligible Amount</span>
            <span className="font-bold text-amber-800">{formatPKR(remaining)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberInput label="Amount" required min={1} max={remaining} value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} />
          <Select label="Payment Method" required options={PAYMENT_METHODS} value={method} onChange={(e) => setMethod(e.target.value as AppointmentPaymentMethod)} />
        </div>
        <TextInput label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
      </form>
    </Modal>
  );
};
