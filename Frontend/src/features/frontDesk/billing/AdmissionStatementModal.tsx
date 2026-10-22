import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Wallet, Pill, Eye, X, CheckCircle2, Clock, Percent, RefreshCw } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { NumberInput, Select, TextInput, Toggle } from '../../../components/forms/FormControls';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import {
  fetchAdmissionStatement,
  collectAdmissionPayment,
  applyAdmissionDiscount,
  resyncPharmacyCollection,
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
  const [isResyncingPharmacy, setIsResyncingPharmacy] = useState(false);

  const [activeTab, setActiveTab] = useState<'payment' | 'discount'>('payment');
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualAmounts, setManualAmounts] = useState<Record<string, number | ''>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [discLineId, setDiscLineId] = useState(''); // '' = whole eligible Hospital Services total
  const [discPercent, setDiscPercent] = useState<number | ''>('');
  const [discAmount, setDiscAmount] = useState<number | ''>('');
  const [discReason, setDiscReason] = useState('');
  const [discError, setDiscError] = useState<string | null>(null);
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAdmissionStatement(admissionId);
      setStatement(data);
      if (data?.consolidated) {
        const out = data.consolidated.outstanding ?? 0;
        setAmount(out > 0 ? out : '');
        const initialManual: Record<string, number | ''> = {};
        for (const inv of (data.departmentInvoices || [])) {
          if (inv.outstanding > 0) {
            initialManual[inv.id] = inv.outstanding;
          }
        }
        setManualAmounts(initialManual);
      }
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

  // Discounts are strictly Hospital Services only — Pharmacy / Outsourced
  // Lab & Radiology lines are never eligible (server-computed per line, see
  // `applyAdmissionDiscount`'s `isDiscountEligible` on each invoice line).
  const discountEligibleInvoice = useMemo(
    () => (statement?.departmentInvoices || []).find((inv) => inv.isDiscountEligibleInvoice),
    [statement],
  );
  const eligibleDiscountLines = useMemo(
    () => discountEligibleInvoice?.lines.filter((l) => l.isDiscountEligible) ?? [],
    [discountEligibleInvoice],
  );
  const eligibleDiscountGross = useMemo(
    () => eligibleDiscountLines.reduce((s, l) => s + l.lineGross, 0),
    [eligibleDiscountLines],
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
      setReference('');
      load();
      onChanged?.();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to collect payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDiscError(null);

    if (!discReason.trim()) {
      setDiscError('Enter a reason for the discount.');
      return;
    }
    if (!discPercent && !discAmount) {
      setDiscError('Enter a discount percent or amount.');
      return;
    }
    if (!discountEligibleInvoice) {
      setDiscError('This admission has no eligible Hospital Services charges (only Outsourced Lab / Pharmacy) to discount.');
      return;
    }

    setIsSavingDiscount(true);
    try {
      await applyAdmissionDiscount(admissionId, {
        lineItemId: discLineId || undefined,
        discountPercent: discPercent === '' ? undefined : discPercent,
        discountAmount: discAmount === '' ? undefined : discAmount,
        discountReason: discReason.trim(),
      });
      toast.success('Discount applied to Hospital Services charges.');
      setDiscLineId('');
      setDiscPercent('');
      setDiscAmount('');
      setDiscReason('');
      setActiveTab('payment'); // Auto switch back to payment tab to view updated balance
      load();
      onChanged?.();
    } catch (err: any) {
      setDiscError(err?.message || 'Failed to apply discount.');
    } finally {
      setIsSavingDiscount(false);
    }
  };

  const handleResyncPharmacy = async () => {
    setIsResyncingPharmacy(true);
    try {
      await resyncPharmacyCollection(admissionId);
      toast.success('Resynced — Pharmacy\'s Receivable should now reflect the collected amount.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to resync with Pharmacy.');
    } finally {
      setIsResyncingPharmacy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Running Bill / Interim Statement" subtitle="Admission Invoices & Payment Clearance" maxWidth="4xl">
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
        <div className="space-y-3">
          {/* Top 4 Financial Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 bg-slate-50/80 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Consolidated Total</span>
              <span className="font-bold text-slate-800 text-sm">{formatPKR(statement.consolidated.total)}</span>
            </div>
            <div className="p-2 bg-emerald-50/60 rounded-lg border border-emerald-200">
              <span className="text-[10px] text-emerald-700 uppercase block font-semibold">Paid Total</span>
              <span className="font-bold text-emerald-800 text-sm">{formatPKR(statement.consolidated.paidTotal)}</span>
            </div>
            <div className="p-2 bg-purple-50/60 rounded-lg border border-purple-200">
              <span className="text-[10px] text-purple-700 uppercase block font-semibold">Panel Receivable</span>
              <span className="font-bold text-purple-800 text-sm">{formatPKR(statement.consolidated.panelReceivable)}</span>
            </div>
            <div className={`p-2 rounded-lg border ${statement.consolidated.outstanding > 0 ? 'bg-amber-50/80 border-amber-300' : 'bg-emerald-50/80 border-emerald-300'}`}>
              <span className={`text-[10px] uppercase block font-semibold ${statement.consolidated.outstanding > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>Outstanding</span>
              <span className={`font-bold text-sm ${statement.consolidated.outstanding > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>{formatPKR(statement.consolidated.outstanding)}</span>
            </div>
          </div>

          {(statement.unallocatedCreditTotal > 0 || statement.availableCredit > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#effaf5] rounded-lg border border-[#c2e7db] text-[11px]">
              <span className="text-[#08775A] font-medium">
                Advance / deposit collected: <strong>{formatPKR(statement.unallocatedCreditTotal)}</strong> (applied to Outstanding)
              </span>
              {statement.availableCredit > 0 && (
                <span className="text-[#08775A] font-medium">
                  Unused available credit: <strong>{formatPKR(statement.availableCredit)}</strong>
                </span>
              )}
            </div>
          )}

          {/* Department Invoices Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Department', 'Gross', 'Discount', 'Net', 'Patient Share', 'Panel Recv.', 'Paid', 'Outstanding'].map((h) => (
                    <th key={h} className="text-left px-3 py-1.5 font-semibold text-slate-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statement.departmentInvoices.map((inv) => {
                  const isPharm = !!inv.pharmacyDetails || inv.departmentName === 'Pharmacy Department';
                  const pharmInvoiceNum = inv.pharmacyDetails?.pharmacyInvoiceNumber || statement.pharmacyCharge?.pharmacyInvoiceNumber || inv.invoiceNumber;

                  return (
                    <tr key={inv.id} className={isPharm ? 'bg-emerald-50/20' : 'hover:bg-slate-50/40'}>
                      <td className="px-3 py-1.5 whitespace-nowrap font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{inv.departmentName}</span>
                          {isPharm && (
                            <span className="font-mono text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">
                              {pharmInvoiceNum}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{formatPKR(inv.subtotal)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-rose-600">{formatPKR(inv.discountTotal)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-slate-800">{formatPKR(inv.total)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{formatPKR(inv.patientShare)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-purple-700">{formatPKR(inv.panelReceivable)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-emerald-700">{formatPKR(inv.paidTotal)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap font-bold text-amber-700">{formatPKR(inv.outstanding)}</td>
                    </tr>
                  );
                })}
                {statement.departmentInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-slate-400">
                      No department invoices posted yet for this admission.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pharmacy Component Compact Bar */}
          {statement.pharmacyCharge && (
            <div className="px-3 py-2 bg-gradient-to-r from-emerald-50/60 to-teal-50/30 rounded-lg border border-emerald-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-[#08775A] text-white flex items-center justify-center font-bold">
                  <Pill className="h-3 w-3" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-800">Pharmacy:</span>
                  <span className="font-mono text-[10px] font-bold text-[#08775A] bg-emerald-100 px-1.5 py-0.2 rounded">
                    {statement.pharmacyCharge.pharmacyInvoiceNumber}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border uppercase ${
                    statement.pharmacyCharge.patientOutstanding === 0
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {statement.pharmacyCharge.patientOutstanding === 0 ? 'CLEARED' : 'PENDING'}
                  </span>
                </div>
                <span className="text-slate-300 hidden sm:inline">|</span>
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-600">
                  <span>Total: <strong className="text-slate-800">{formatPKR(statement.pharmacyCharge.totalAmount)}</strong></span>
                  <span>Paid: <strong className="text-emerald-700">{formatPKR(statement.pharmacyCharge.patientPaid)}</strong></span>
                  <span>Due: <strong className="text-amber-700">{formatPKR(statement.pharmacyCharge.patientOutstanding)}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {statement.pharmacyCharge.patientPaid > 0 && (
                  <button
                    type="button"
                    onClick={handleResyncPharmacy}
                    disabled={isResyncingPharmacy}
                    title="Resync payment with Central Pharmacy"
                    className="px-2 py-0.5 text-[11px] font-medium text-[#08775A] bg-white border border-[#08775A]/40 hover:bg-emerald-50 rounded shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-60"
                  >
                    {isResyncingPharmacy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Resync
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPharmacyModal(true)}
                  className="px-2.5 py-0.5 text-[11px] font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Eye className="h-3 w-3" />
                  Details
                </button>
              </div>
            </div>
          )}

          {/* Action Tabs & Forms (Payment vs Discount) */}
          <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('payment')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'payment'
                      ? 'bg-[#08775A] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Collect Payment
                  {statement.consolidated.outstanding > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeTab === 'payment' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {formatPKR(statement.consolidated.outstanding)}
                    </span>
                  )}
                </button>

                {discountEligibleInvoice && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('discount')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                      activeTab === 'discount'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Percent className="h-3.5 w-3.5" />
                    Apply Discount
                    {eligibleDiscountGross > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                        activeTab === 'discount' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        Max {formatPKR(eligibleDiscountGross)}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {activeTab === 'payment' && outstandingInvoices.length > 0 && (
                <Toggle label="Manual allocation" checked={manualMode} onChange={setManualMode} />
              )}
            </div>

            {/* TAB: PAYMENT */}
            {activeTab === 'payment' && (
              <>
                {statement.consolidated.outstanding === 0 ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">All department invoices are cleared. No outstanding balance remaining.</span>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full uppercase">Ready for Discharge</span>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-3">
                    {formError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {manualMode ? (
                      <div className="space-y-2">
                        {outstandingInvoices.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                            <span className="font-medium text-slate-700 flex-1">{inv.departmentName}</span>
                            <span className="text-slate-500 text-[11px]">Due: <strong className="text-slate-800">{formatPKR(inv.outstanding)}</strong></span>
                            <NumberInput
                              min={0}
                              max={inv.outstanding}
                              value={manualAmounts[inv.id] ?? ''}
                              onChange={(e) => setManualAmounts({ ...manualAmounts, [inv.id]: e.target.value === '' ? '' : Number(e.target.value) })}
                              className="w-32"
                            />
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-xs pt-1 px-1">
                          <span className="text-slate-500">Total to collect: <strong className="text-slate-900 font-bold">{formatPKR(manualSum)}</strong></span>
                          <button
                            type="button"
                            onClick={() => {
                              const full: Record<string, number | ''> = {};
                              for (const inv of outstandingInvoices) full[inv.id] = inv.outstanding;
                              setManualAmounts(full);
                            }}
                            className="text-[11px] font-semibold text-[#08775A] hover:underline cursor-pointer"
                          >
                            Fill All Outstandings
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700">Amount *</label>
                          {amount !== statement.consolidated.outstanding && (
                            <button
                              type="button"
                              onClick={() => setAmount(statement.consolidated.outstanding)}
                              className="text-[11px] font-semibold text-[#08775A] hover:underline cursor-pointer inline-flex items-center gap-1"
                            >
                              Auto-fill Full Balance: <strong>{formatPKR(statement.consolidated.outstanding)}</strong>
                            </button>
                          )}
                        </div>
                        <NumberInput
                          required
                          min={1}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          hint="Auto-allocated proportionally to each department's outstanding balance."
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Select label="Payment Method" required options={PAYMENT_METHODS} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} />
                      <TextInput label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Card receipt / Cheque / Bank ref" />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-5 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-sm disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Collect & Allocate {amount ? `(${formatPKR(Number(amount))})` : ''}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* TAB: DISCOUNT */}
            {activeTab === 'discount' && discountEligibleInvoice && (
              <form onSubmit={handleApplyDiscount} className="space-y-3">
                <p className="text-[11px] text-slate-500 bg-amber-50/50 border border-amber-200/70 rounded-lg p-2">
                  Discounts apply to <strong>Hospital Services only</strong> (Max {formatPKR(eligibleDiscountGross)}). Outsourced Lab, Radiology, and Pharmacy charges cannot be discounted.
                </p>

                {discError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{discError}</span>
                  </div>
                )}

                <Select
                  label="Apply To"
                  options={[
                    { label: `Whole eligible total (${formatPKR(eligibleDiscountGross)})`, value: '' },
                    ...eligibleDiscountLines.map((l) => ({ label: `${l.serviceName} (${formatPKR(l.lineGross)})`, value: l.id })),
                  ]}
                  value={discLineId}
                  onChange={(e) => setDiscLineId(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <NumberInput label="Discount %" min={0} max={100} value={discPercent} onChange={(e) => setDiscPercent(e.target.value === '' ? '' : Number(e.target.value))} />
                  <NumberInput label="OR Discount Amount (PKR)" min={0} value={discAmount} onChange={(e) => setDiscAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <TextInput label="Reason *" required placeholder="e.g. Administrative / Patient Relief Discount" value={discReason} onChange={(e) => setDiscReason(e.target.value)} />

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('payment')}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDiscount}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isSavingDiscount && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Apply Discount
                  </button>
                </div>
              </form>
            )}
          </div>
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
