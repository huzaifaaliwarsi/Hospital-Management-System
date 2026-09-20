import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Wallet } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { NumberInput, Select, TextInput, Toggle } from '../../../components/forms/FormControls';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import {
  fetchAdmissionStatement,
  collectAdmissionPayment,
  AdmissionStatement,
  PaymentMethod,
} from '../../../services/admissionBillingService';

const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'Bank Transfer', value: 'BANK' },
  { label: 'Online', value: 'ONLINE' },
];

interface AdmissionStatementModalProps {
  admissionId: string;
  onClose: () => void;
  onChanged?: () => void;
}

/**
 * Running Bill / Interim Statement + Payment Allocation
 * (HMS_V7.2_NEW_REQUIREMENTS.md §2.2/§2.10/§2.11) — every department
 * invoice for this admission, shown separately (never merged), plus one
 * form to collect a payment and allocate it across them.
 */
export const AdmissionStatementModal: React.FC<AdmissionStatementModalProps> = ({ admissionId, onClose, onChanged }) => {
  const toast = useToast();
  const [statement, setStatement] = useState<AdmissionStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualAmounts, setManualAmounts] = useState<Record<string, number | ''>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setStatement(await fetchAdmissionStatement(admissionId));
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load statement.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId]);

  const outstandingInvoices = useMemo(
    () => (statement?.departmentInvoices || []).filter((inv) => inv.outstanding > 0),
    [statement],
  );

  const manualSum = useMemo(
    () => Object.values(manualAmounts).reduce((s: number, v) => s + (v === '' || v == null ? 0 : Number(v)), 0),
    [manualAmounts],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (manualMode) {
      const allocations = Object.entries(manualAmounts)
        .filter(([, v]) => v !== '' && Number(v) > 0)
        .map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) }));
      if (allocations.length === 0) {
        setFormError('Enter at least one department allocation amount.');
        return;
      }
      setIsSaving(true);
      try {
        await collectAdmissionPayment(admissionId, {
          amount: manualSum,
          paymentMethod: method,
          reference: reference.trim() || undefined,
          allocations,
        });
        toast.success(`Collected ${formatPKR(manualSum)}, allocated across ${allocations.length} department invoice(s).`);
        setManualAmounts({});
        setReference('');
        load();
        onChanged?.();
      } catch (err: any) {
        setFormError(err?.message || 'Failed to collect payment.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setFormError('Enter a valid amount.');
      return;
    }
    setIsSaving(true);
    try {
      await collectAdmissionPayment(admissionId, {
        amount: Number(amount),
        paymentMethod: method,
        reference: reference.trim() || undefined,
      });
      toast.success(`Collected ${formatPKR(Number(amount))}, auto-allocated proportionally across outstanding department invoices.`);
      setAmount('');
      setReference('');
      load();
      onChanged?.();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to collect payment.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Running Bill / Interim Statement" subtitle="Not the final discharge invoice — department invoices shown separately." maxWidth="4xl">
      {isLoading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Loading…</span>
        </div>
      ) : loadError ? (
        <div className="p-6 flex flex-col items-center gap-2 text-center">
          <AlertCircle className="h-5 w-5 text-rose-500" />
          <p className="text-xs text-rose-700 font-medium">{loadError}</p>
        </div>
      ) : statement ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block">Consolidated Total</span>
              <span className="font-bold text-slate-800">{formatPKR(statement.consolidated.total)}</span>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-[10px] text-emerald-700 uppercase block">Paid (incl. advance)</span>
              <span className="font-bold text-emerald-800">{formatPKR(statement.consolidated.paidTotal)}</span>
            </div>
            <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
              <span className="text-[10px] text-purple-700 uppercase block">Panel Receivable</span>
              <span className="font-bold text-purple-800">{formatPKR(statement.consolidated.panelReceivable)}</span>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-[10px] text-amber-700 uppercase block">Outstanding</span>
              <span className="font-bold text-amber-800">{formatPKR(statement.consolidated.outstanding)}</span>
            </div>
          </div>

          {(statement.unallocatedCreditTotal > 0 || statement.availableCredit > 0) && (
            <div className="flex flex-wrap items-center gap-4 p-2.5 bg-[#effaf5] rounded-lg border border-[#c2e7db] text-xs">
              <span className="text-[#08775A] font-semibold">
                Advance / deposit collected: <strong>{formatPKR(statement.unallocatedCreditTotal)}</strong> (already applied to Outstanding above)
              </span>
              {statement.availableCredit > 0 && (
                <span className="text-[#08775A] font-semibold">
                  Unused available credit: <strong>{formatPKR(statement.availableCredit)}</strong>
                </span>
              )}
            </div>
          )}

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Department', 'Gross', 'Discount', 'Net', 'Patient Share', 'Panel Receivable', 'Paid', 'Outstanding'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statement.departmentInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-800">{inv.departmentName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatPKR(inv.subtotal)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-rose-600">{formatPKR(inv.discountTotal)}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold">{formatPKR(inv.total)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatPKR(inv.patientShare)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-purple-700">{formatPKR(inv.panelReceivable)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-emerald-700">{formatPKR(inv.paidTotal)}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-amber-700">{formatPKR(inv.outstanding)}</td>
                  </tr>
                ))}
                {statement.departmentInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                      No department invoices posted yet for this admission.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {outstandingInvoices.length > 0 && (
            <form onSubmit={handleSubmit} className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#08775A] flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" /> Collect Payment
                </h4>
                <Toggle label="Manual per-department allocation" checked={manualMode} onChange={setManualMode} />
              </div>

              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {manualMode ? (
                <div className="space-y-2">
                  {outstandingInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-40 shrink-0">{inv.departmentName}</span>
                      <span className="text-[10px] text-slate-400 w-28 shrink-0">Outstanding: {formatPKR(inv.outstanding)}</span>
                      <NumberInput
                        min={0}
                        max={inv.outstanding}
                        value={manualAmounts[inv.id] ?? ''}
                        onChange={(e) => setManualAmounts({ ...manualAmounts, [inv.id]: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="max-w-[140px]"
                      />
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-500">Total to collect: <strong>{formatPKR(manualSum)}</strong></p>
                </div>
              ) : (
                <NumberInput label="Amount" required min={1} value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} hint="Auto-allocated proportionally to each department's outstanding balance." />
              )}

              <div className="grid grid-cols-2 gap-3">
                <Select label="Payment Method" required options={PAYMENT_METHODS} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} />
                <TextInput label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Collect & Allocate
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </Modal>
  );
};
