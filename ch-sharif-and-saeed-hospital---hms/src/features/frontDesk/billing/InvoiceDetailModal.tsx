import React, { useState, useEffect } from 'react';
import { X, Receipt, Plus, Tag, CreditCard, RotateCcw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatPKR } from '../../../utils/formatters';
import {
  InvoiceDetail,
  PaymentMethod,
  fetchInvoiceDetail,
  addServiceLine,
  applyDiscount,
  collectPayment,
  refundPayment,
} from '../../../services/invoiceService';
import { ServiceRatesService } from '../../../services/serviceRatesService';
import { StaffUserService } from '../../../services/staffUserService';
import { Modal } from '../../../components/common/Modal';
import { Select, NumberInput, TextInput } from '../../../components/forms/FormControls';

interface InvoiceDetailModalProps {
  invoiceId: string;
  onClose: () => void;
  onChanged: () => void;
}

type ActiveAction = null | 'addLine' | 'discount' | 'payment' | 'refund';

const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'Bank Transfer', value: 'BANK' },
  { label: 'Online', value: 'ONLINE' },
];

/**
 * Real invoice detail + billing actions (Add Service Line, Discount,
 * Collect Payment, Refund) — all real `POST /invoices/:id/*` calls, no
 * fabricated totals. Reused across Hospital Invoices / Outstanding
 * Balances / Payments-Receipts / Discounts / Refunds nav items (Front
 * Desk's real billing surface today is this one invoice model — see
 * `services/invoiceService.ts`'s header comment on the pending §2.2 split).
 */
export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoiceId, onClose, onChanged }) => {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const services = ServiceRatesService.getServices().filter((s) => s.status === 'Active');
  const doctors = StaffUserService.getStaffUsers().filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE');

  // Add Service Line form state
  const [lineServiceId, setLineServiceId] = useState('');
  const [lineQty, setLineQty] = useState<number>(1);
  const [linePerformedBy, setLinePerformedBy] = useState('');

  // Discount form state
  const [discountPercent, setDiscountPercent] = useState<number | ''>('');
  const [discountAmount, setDiscountAmount] = useState<number | ''>('');
  const [discountReason, setDiscountReason] = useState('');

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');

  // Refund form state
  const [refundAmount, setRefundAmount] = useState<number | ''>('');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('CASH');
  const [refundReason, setRefundReason] = useState('');

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setInvoice(await fetchInvoiceDetail(invoiceId));
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load invoice.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const closeAction = () => {
    setActiveAction(null);
    setActionError(null);
    setLineServiceId('');
    setLineQty(1);
    setLinePerformedBy('');
    setDiscountPercent('');
    setDiscountAmount('');
    setDiscountReason('');
    setPaymentAmount('');
    setPaymentReference('');
    setRefundAmount('');
    setRefundReason('');
  };

  const afterMutate = async (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
    closeAction();
    await load();
    onChanged();
  };

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineServiceId) {
      setActionError('Select a service.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await addServiceLine(invoiceId, { serviceRateId: lineServiceId, quantity: lineQty, performedByStaffId: linePerformedBy || undefined });
      await afterMutate('Service line added.');
    } catch (err: any) {
      setActionError(err?.response?.data?.error?.message || err?.message || 'Failed to add service line.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountReason.trim()) {
      setActionError('Discount reason is required.');
      return;
    }
    if (!discountPercent && !discountAmount) {
      setActionError('Enter a discount percent or amount.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await applyDiscount(invoiceId, {
        discountPercent: discountPercent === '' ? undefined : discountPercent,
        discountAmount: discountAmount === '' ? undefined : discountAmount,
        discountReason: discountReason.trim(),
      });
      await afterMutate('Discount applied.');
    } catch (err: any) {
      setActionError(err?.response?.data?.error?.message || err?.message || 'Failed to apply discount.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || paymentAmount <= 0) {
      setActionError('Enter a payment amount greater than zero.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await collectPayment(invoiceId, { amount: Number(paymentAmount), paymentMethod, reference: paymentReference.trim() || undefined });
      await afterMutate('Payment collected and receipt generated.');
    } catch (err: any) {
      setActionError(err?.response?.data?.error?.message || err?.message || 'Failed to collect payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundAmount || refundAmount <= 0) {
      setActionError('Enter a refund amount greater than zero.');
      return;
    }
    if (!refundReason.trim()) {
      setActionError('Refund reason is mandatory.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await refundPayment(invoiceId, { amount: Number(refundAmount), refundMethod, reason: refundReason.trim() });
      await afterMutate('Refund posted.');
    } catch (err: any) {
      setActionError(err?.response?.data?.error?.message || err?.message || 'Failed to post refund.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={invoice ? `Invoice ${invoice.invoiceNumber}` : 'Invoice'} maxWidth="3xl">
      {toast && (
        <div className="mb-3 p-2.5 rounded-lg bg-[#effaf5] border border-[#c2e7db] text-[#08775A] text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {toast}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading invoice…
        </div>
      ) : loadError || !invoice ? (
        <div className="text-center py-10">
          <p className="text-rose-600 text-sm">{loadError}</p>
          <button onClick={load} className="mt-2 px-3 py-1.5 bg-[#08775A] text-white text-xs rounded-lg">Retry</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block">Patient</span>
              <span className="font-semibold text-slate-900 text-xs">{invoice.patientName}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block">Payer</span>
              <span className="font-semibold text-slate-900 text-xs">{invoice.payerType}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block">Status</span>
              <span className="font-bold text-xs text-slate-900">{invoice.status}</span>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-[10px] text-amber-700 uppercase block">Balance Due</span>
              <span className="font-bold text-xs text-amber-900">{formatPKR(invoice.balanceDue)}</span>
            </div>
          </div>

          {/* Lines */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2 px-3 font-semibold">Service</th>
                  <th className="py-2 px-3 font-semibold text-right">Qty</th>
                  <th className="py-2 px-3 font-semibold text-right">Rate</th>
                  <th className="py-2 px-3 font-semibold text-right">Discount</th>
                  <th className="py-2 px-3 font-semibold text-right">Net</th>
                  <th className="py-2 px-3 font-semibold">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lines.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">No service lines yet.</td></tr>
                ) : (
                  invoice.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2 px-3 font-medium text-slate-900">{l.serviceName} <span className="text-slate-400 font-mono">({l.serviceCode})</span></td>
                      <td className="py-2 px-3 text-right">{l.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatPKR(l.rate)}</td>
                      <td className="py-2 px-3 text-right font-mono text-amber-700">{l.discountAmount > 0 ? formatPKR(l.discountAmount) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{formatPKR(l.lineNet)}</td>
                      <td className="py-2 px-3 text-slate-500">{l.performedByName || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Receipts */}
          {invoice.receipts.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 uppercase">Payment Receipts</div>
              <table className="w-full text-left text-xs border-collapse">
                <tbody className="divide-y divide-slate-100">
                  {invoice.receipts.map((r) => (
                    <tr key={r.id} className={r.isReversed ? 'opacity-50 line-through' : ''}>
                      <td className="py-1.5 px-3 font-mono">{r.receiptNumber}</td>
                      <td className="py-1.5 px-3 font-semibold text-right">{formatPKR(r.amount)}</td>
                      <td className="py-1.5 px-3">{r.method}</td>
                      <td className="py-1.5 px-3 text-slate-500">{r.collectedByName}</td>
                      <td className="py-1.5 px-3 text-slate-400 text-right">{r.collectedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Action tabs */}
          {activeAction === null && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
              <button onClick={() => setActiveAction('addLine')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
                <Plus className="h-3.5 w-3.5" /> Add Service Line
              </button>
              <button onClick={() => setActiveAction('discount')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg">
                <Tag className="h-3.5 w-3.5" /> Apply Discount
              </button>
              <button onClick={() => setActiveAction('payment')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#effaf5] hover:bg-[#dff5ea] text-[#08775A] rounded-lg">
                <CreditCard className="h-3.5 w-3.5" /> Collect Payment
              </button>
              <button onClick={() => setActiveAction('refund')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg">
                <RotateCcw className="h-3.5 w-3.5" /> Refund
              </button>
            </div>
          )}

          {actionError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" /> {actionError}
            </div>
          )}

          {activeAction === 'addLine' && (
            <form onSubmit={handleAddLine} className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <Select label="Service" required options={services.map((s) => ({ label: `${s.name} — ${formatPKR(s.standardRate)}`, value: s.id }))} value={lineServiceId} onChange={(e) => setLineServiceId(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Quantity" min={1} value={lineQty} onChange={(e) => setLineQty(Number(e.target.value) || 1)} />
                <Select label="Performed By (optional)" options={doctors.map((d) => ({ label: d.fullName, value: d.id }))} value={linePerformedBy} onChange={(e) => setLinePerformedBy(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeAction} className="px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-1.5 text-xs font-semibold text-white bg-[#08775A] rounded-lg disabled:opacity-60">{isSaving ? 'Adding…' : 'Add Line'}</button>
              </div>
            </form>
          )}

          {activeAction === 'discount' && (
            <form onSubmit={handleApplyDiscount} className="space-y-3 p-3 bg-amber-50/60 rounded-lg border border-amber-200">
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Discount %" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value === '' ? '' : Number(e.target.value))} />
                <NumberInput label="OR Discount Amount (PKR)" min={0} value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <TextInput label="Reason" required value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeAction} className="px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-700 rounded-lg disabled:opacity-60">{isSaving ? 'Applying…' : 'Apply Discount'}</button>
              </div>
            </form>
          )}

          {activeAction === 'payment' && (
            <form onSubmit={handleCollectPayment} className="space-y-3 p-3 bg-[#effaf5] rounded-lg border border-[#c2e7db]">
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Amount (PKR)" required min={0} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                <Select label="Method" options={PAYMENT_METHODS} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} />
              </div>
              <TextInput label="Reference (optional)" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeAction} className="px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-1.5 text-xs font-semibold text-white bg-[#08775A] rounded-lg disabled:opacity-60">{isSaving ? 'Posting…' : 'Collect Payment'}</button>
              </div>
            </form>
          )}

          {activeAction === 'refund' && (
            <form onSubmit={handleRefund} className="space-y-3 p-3 bg-rose-50/60 rounded-lg border border-rose-200">
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Refund Amount (PKR)" required min={0} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                <Select label="Method" options={PAYMENT_METHODS} value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)} />
              </div>
              <TextInput label="Reason" required value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeAction} className="px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-lg disabled:opacity-60">{isSaving ? 'Posting…' : 'Post Refund'}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
};
