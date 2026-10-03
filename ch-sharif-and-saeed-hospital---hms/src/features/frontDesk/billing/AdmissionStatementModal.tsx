import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Wallet, Pill, Eye, X, CheckCircle2, Clock } from 'lucide-react';
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

  const [showPharmacyModal, setShowPharmacyModal] = useState(false);
  const [pharmacyViewTab, setPharmacyViewTab] = useState<'aggregated' | 'granular'>('aggregated');

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
    // Explicit <number> — TS's reduce() overload otherwise infers the
    // accumulator as `number | ''` from the array's own element type here,
    // not just the callback's actual (always-number) return type.
    () => Object.values(manualAmounts).reduce<number>((s, v) => s + (v === '' || v == null ? 0 : Number(v)), 0),
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
                {statement.departmentInvoices.map((inv) => {
                  const isPharm = inv.departmentName === 'Pharmacy Department' || inv.invoiceNumber.startsWith('INV-PHARM-');
                  const pharmInvoiceNum = inv.pharmacyDetails?.pharmacyInvoiceNumber || statement.pharmacyCharge?.pharmacyInvoiceNumber || inv.invoiceNumber.replace('INV-PHARM-', '');

                  return (
                    <tr key={inv.id} className={isPharm ? 'bg-emerald-50/20' : ''}>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>{inv.departmentName}</span>
                          {isPharm && (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                                {pharmInvoiceNum}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowPharmacyModal(true)}
                                className="px-2 py-0.5 text-[10px] font-semibold text-[#08775A] bg-[#effaf5] hover:bg-[#d8f3e9] border border-[#a3e2cf] rounded cursor-pointer transition-colors inline-flex items-center gap-1"
                              >
                                <Eye className="h-3 w-3" />
                                View Pharmacy Details
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatPKR(inv.subtotal)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-rose-600">{formatPKR(inv.discountTotal)}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold">{formatPKR(inv.total)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatPKR(inv.patientShare)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-purple-700">{formatPKR(inv.panelReceivable)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-emerald-700">{formatPKR(inv.paidTotal)}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold text-amber-700">{formatPKR(inv.outstanding)}</td>
                    </tr>
                  );
                })}
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

          {/* ── §8 Dedicated Pharmacy Component Card ─────────────────── */}
          {statement.pharmacyCharge && (
            <div className="p-3.5 bg-gradient-to-r from-emerald-50/50 to-teal-50/30 rounded-xl border border-emerald-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-[#08775A] text-white flex items-center justify-center font-bold text-xs">
                    <Pill className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800">Pharmacy Medication Component</span>
                    <span className="ml-2 font-mono text-[11px] font-extrabold text-[#08775A] bg-emerald-100 px-2 py-0.5 rounded">
                      Linked Invoice: {statement.pharmacyCharge.pharmacyInvoiceNumber}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                    statement.pharmacyCharge.patientOutstanding === 0
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {statement.pharmacyCharge.patientOutstanding === 0 ? 'CLEARED' : 'PENDING'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPharmacyModal(true)}
                    className="px-2.5 py-1 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Pharmacy Details
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 bg-white/80 rounded border border-slate-200">
                  <span className="text-[9px] text-slate-500 uppercase block">Pharmacy Total</span>
                  <span className="font-bold text-slate-900">{formatPKR(statement.pharmacyCharge.totalAmount)}</span>
                </div>
                <div className="p-2 bg-white/80 rounded border border-slate-200">
                  <span className="text-[9px] text-emerald-700 uppercase block">Patient Paid</span>
                  <span className="font-bold text-emerald-800">{formatPKR(statement.pharmacyCharge.patientPaid)}</span>
                </div>
                <div className="p-2 bg-white/80 rounded border border-slate-200">
                  <span className="text-[9px] text-amber-700 uppercase block">Outstanding</span>
                  <span className="font-bold text-amber-800">{formatPKR(statement.pharmacyCharge.patientOutstanding)}</span>
                </div>
                <div className="p-2 bg-white/80 rounded border border-slate-200">
                  <span className="text-[9px] text-slate-500 uppercase block">Total Dispenses</span>
                  <span className="font-bold text-slate-800">{statement.pharmacyCharge.items?.length || 0} line(s)</span>
                </div>
              </div>
            </div>
          )}

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
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Collect & Allocate
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {/* ── §8 & §15 View Pharmacy Details Modal ──────────────────────── */}
      {showPharmacyModal && statement?.pharmacyCharge && (
        <Modal
          isOpen
          onClose={() => setShowPharmacyModal(false)}
          title={`Pharmacy Medication Details — ${statement.pharmacyCharge.pharmacyInvoiceNumber}`}
          subtitle="Linked Central Pharmacy Inpatient Invoice (traceable batches & dispenses)"
          maxWidth="3xl"
        >
          <div className="space-y-4">
            {/* Header info bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Admission Reference</span>
                <span className="font-mono font-bold text-slate-800">{statement.admissionNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Linked Pharmacy Invoice</span>
                <span className="font-mono font-extrabold text-[#08775A] bg-emerald-100 px-2 py-0.5 rounded">
                  {statement.pharmacyCharge.pharmacyInvoiceNumber}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Payment Status</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  statement.pharmacyCharge.patientOutstanding === 0
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {statement.pharmacyCharge.patientOutstanding === 0 ? 'CLEARED' : 'PENDING'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Institutional Settlement</span>
                <span className="font-semibold text-slate-600">
                  {statement.pharmacyCharge.settlementStatus.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Subtotal</span>
                <span className="font-bold text-slate-800">{formatPKR(statement.pharmacyCharge.subtotal)}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Net Amount</span>
                <span className="font-bold text-slate-900">{formatPKR(statement.pharmacyCharge.totalAmount)}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-[10px] text-emerald-700 uppercase block">Paid at Front Desk</span>
                <span className="font-bold text-emerald-800">{formatPKR(statement.pharmacyCharge.patientPaid)}</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-[10px] text-amber-700 uppercase block">Outstanding Due</span>
                <span className="font-bold text-amber-800">{formatPKR(statement.pharmacyCharge.patientOutstanding)}</span>
              </div>
            </div>

            {/* View Tab Toggle */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPharmacyViewTab('aggregated')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    pharmacyViewTab === 'aggregated'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Aggregated Medicines Summary
                </button>
                <button
                  type="button"
                  onClick={() => setPharmacyViewTab('granular')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    pharmacyViewTab === 'granular'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Granular Dispense History ({statement.pharmacyCharge.items?.length || 0})
                </button>
              </div>
              <span className="text-[11px] text-slate-400">
                {pharmacyViewTab === 'aggregated' ? 'Combined quantities per medicine' : 'Every batch & dispense event traceable'}
              </span>
            </div>

            {/* Aggregated Table */}
            {pharmacyViewTab === 'aggregated' && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Medicine</th>
                      <th className="text-center px-3 py-2 font-semibold">Total Quantity</th>
                      <th className="text-right px-3 py-2 font-semibold">Rate</th>
                      <th className="text-right px-3 py-2 font-semibold">Total Amount</th>
                      <th className="text-center px-3 py-2 font-semibold">Dispenses</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const map = new Map<string, { name: string; unit: string; totalQty: number; rate: number; totalAmount: number; dispensesCount: number }>();
                      for (const item of (statement.pharmacyCharge.items || [])) {
                        const name = item.medicineName || 'Medicine Item';
                        const existing = map.get(name);
                        const qty = Number(item.quantity || 0);
                        const amount = Number(item.lineNet || (qty * Number(item.rate || 0)));
                        const rate = Number(item.rate || (qty > 0 ? amount / qty : 0));
                        const unit = item.unit || 'Units';
                        if (existing) {
                          existing.totalQty += qty;
                          existing.totalAmount += amount;
                          existing.dispensesCount += 1;
                        } else {
                          map.set(name, {
                            name,
                            unit,
                            totalQty: qty,
                            rate,
                            totalAmount: amount,
                            dispensesCount: 1,
                          });
                        }
                      }
                      const list = Array.from(map.values());
                      if (list.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-400">No medicines recorded yet.</td>
                          </tr>
                        );
                      }
                      return list.map((m) => (
                        <tr key={m.name} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 font-semibold text-slate-800">{m.name}</td>
                          <td className="px-3 py-2 text-center font-bold text-slate-900">{m.totalQty} {m.unit}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatPKR(m.rate)}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900">{formatPKR(m.totalAmount)}</td>
                          <td className="px-3 py-2 text-center text-[10px] text-slate-500">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-medium">
                              {m.dispensesCount} event(s)
                            </span>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {/* Granular Traceable Table */}
            {pharmacyViewTab === 'granular' && (
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Medicine</th>
                      <th className="text-left px-3 py-2 font-semibold">Batch No</th>
                      <th className="text-center px-3 py-2 font-semibold">Qty</th>
                      <th className="text-right px-3 py-2 font-semibold">Rate</th>
                      <th className="text-right px-3 py-2 font-semibold">Amount</th>
                      <th className="text-left px-3 py-2 font-semibold">Request / Event</th>
                      <th className="text-left px-3 py-2 font-semibold">Dispensed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(statement.pharmacyCharge.items || []).map((l: any, idx: number) => (
                      <tr key={l.id || idx} className="hover:bg-slate-50/50 text-[11px]">
                        <td className="px-3 py-2 font-semibold text-slate-800">{l.medicineName || 'Medicine'}</td>
                        <td className="px-3 py-2 font-mono text-[10px] text-slate-600">{l.batchNumber || '—'}</td>
                        <td className="px-3 py-2 text-center font-bold text-slate-900">{l.quantity} {l.unit || ''}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatPKR(Number(l.rate || 0))}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{formatPKR(Number(l.lineNet || 0))}</td>
                        <td className="px-3 py-2">
                          <div className="font-mono text-[10px] text-slate-700">{l.externalRequestRef || '—'}</div>
                          {l.dispenseEventId && (
                            <div className="font-mono text-[9px] text-slate-400">{l.dispenseEventId}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          <div>{l.dispensedAt ? new Date(l.dispensedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                          {l.dispensedBy && <div className="text-[10px] text-slate-400">{l.dispensedBy}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Financial Disclaimer Note (§9) */}
            <div className="p-3 bg-[#effaf5] rounded-xl border border-[#c2e7db] text-[11px] text-[#08775A] space-y-1">
              <span className="font-bold uppercase tracking-wider text-[10px] block">
                Financial Segregation Policy (§9)
              </span>
              <p>
                Pharmacy charges represent an inter-entity liability payable to Central Pharmacy, not hospital operating revenue.
                Payments collected at Front Desk are credited to the admission ledger and reconciled with Central Pharmacy via institutional settlement.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPharmacyModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};
