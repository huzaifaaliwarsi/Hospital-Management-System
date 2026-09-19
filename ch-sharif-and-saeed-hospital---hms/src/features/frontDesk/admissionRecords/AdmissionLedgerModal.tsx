import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Wallet, Printer, FileCheck2 } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { NumberInput, Select, TextInput } from '../../../components/forms/FormControls';
import { PanelBadge } from '../../../components/common/PanelBadge';
import { formatPKR } from '../../../utils/formatters';
import { formatDisplayDate } from '../../../utils/dateConstants';
import { useToast } from '../../../context/ToastContext';
import {
  fetchAdmissionLedger,
  collectAdmissionPayment,
  generateFinalBill,
  AdmissionLedger,
  PaymentMethod,
} from '../../../services/admissionBillingService';

const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'Bank Transfer', value: 'BANK' },
  { label: 'Online', value: 'ONLINE' },
];

interface AdmissionLedgerModalProps {
  admissionId: string;
  onClose: () => void;
  onChanged?: () => void;
}

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDisplayDate(d)}, ${d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`;
}

function openPrintWindow(title: string, bodyHtml: string) {
  const printWindow = window.open('', '_blank', 'width=850,height=750');
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: auto; margin: 12mm; }
          body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; color: #0f172a; font-size: 12px; font-weight: 500; }
          .header { text-align: center; border-bottom: 2px solid #08775A; padding-bottom: 12px; margin-bottom: 16px; }
          .header h1 { margin: 0; font-size: 20px; color: #08775A; font-weight: 700; }
          .header p { margin: 2px 0; color: #475569; font-size: 11px; font-weight: 600; }
          .banner { text-align: center; background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; font-weight: 800; font-size: 12px; padding: 6px; border-radius: 6px; margin-bottom: 14px; letter-spacing: 0.4px; }
          .meta-grid { display: flex; justify-content: space-between; margin-bottom: 14px; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .meta-col { flex: 1; font-size: 11.5px; }
          .meta-row { margin-bottom: 4px; }
          .meta-label { font-weight: 700; color: #475569; width: 110px; display: inline-block; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
          th { background: #f1f5f9; text-align: left; padding: 6px 8px; border-bottom: 2px solid #cbd5e1; font-size: 10px; text-transform: uppercase; color: #334155; font-weight: 700; }
          td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 600; }
          .text-right { text-align: right; }
          .summary-box { width: 340px; margin-left: auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; font-weight: 600; color: #475569; }
          .summary-row span.val { font-weight: 700; color: #0f172a; }
          .footer { text-align: center; font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 20px; }
        </style>
      </head>
      <body>${bodyHtml}
        <div class="footer"><p>CH Sharif and Saeed Hospital — System-generated document.</p></div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 350);
}

function ledgerHeaderHtml(ledger: AdmissionLedger, bannerText: string, docLabel: string, docNumber?: string | null) {
  return `
    <div class="header">
      <h1>CH Sharif and Saeed Hospital</h1>
      <p>${docLabel}${docNumber ? ` — ${docNumber}` : ''}</p>
    </div>
    <div class="banner">${bannerText}</div>
    <div class="meta-grid">
      <div class="meta-col">
        <div class="meta-row"><span class="meta-label">Admission #:</span> <strong>${ledger.admissionNumber}</strong></div>
        <div class="meta-row"><span class="meta-label">Admitted:</span> ${formatTimestamp(ledger.admittedAt)}</div>
        <div class="meta-row"><span class="meta-label">Ward/Room/Bed:</span> ${[ledger.ward, ledger.room, ledger.bed].filter(Boolean).join(' / ') || '—'}</div>
      </div>
      <div class="meta-col">
        <div class="meta-row"><span class="meta-label">Patient:</span> <strong>${ledger.patientName}</strong></div>
        <div class="meta-row"><span class="meta-label">MR #:</span> ${ledger.patientMrNumber || '—'}</div>
        <div class="meta-row"><span class="meta-label">Payer:</span> ${ledger.payerType === 'PANEL' ? `Corporate / Panel${ledger.panelName ? ` (${ledger.panelName})` : ''}` : 'Self-Pay'}</div>
      </div>
    </div>
  `;
}

function ledgerTableHtml(ledger: AdmissionLedger) {
  return `
    <table>
      <thead>
        <tr>
          <th>Date/Time</th><th>Type</th><th>Department</th><th>Description</th>
          <th class="text-right">Qty</th><th class="text-right">Rate</th>
          <th class="text-right">Debit</th><th class="text-right">Credit</th><th class="text-right">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${ledger.entries
          .map(
            (e) => `
          <tr>
            <td>${formatTimestamp(e.date)}</td>
            <td>${e.type}</td>
            <td>${e.department || '—'}</td>
            <td>${e.description}</td>
            <td class="text-right">${e.qty ?? ''}</td>
            <td class="text-right">${e.rate != null ? formatPKR(e.rate) : ''}</td>
            <td class="text-right">${e.debit > 0 ? formatPKR(e.debit) : ''}</td>
            <td class="text-right">${e.credit > 0 ? formatPKR(e.credit) : ''}</td>
            <td class="text-right"><strong>${formatPKR(e.runningBalance)}</strong></td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
    <div class="summary-box">
      <div class="summary-row"><span>Total Charges</span><span class="val">${formatPKR(ledger.summary.totalCharges)}</span></div>
      <div class="summary-row"><span>Total Paid</span><span class="val">${formatPKR(ledger.summary.totalPaid)}</span></div>
      <div class="summary-row"><span>Available Advance / Credit</span><span class="val">${formatPKR(ledger.summary.availableCredit)}</span></div>
      <div class="summary-row"><span>Outstanding Balance</span><span class="val">${formatPKR(ledger.summary.outstandingBalance)}</span></div>
    </div>
  `;
}

/**
 * The Admission Patient Record — the patient's ONE running Admission Ledger
 * (source-of-truth: the user's admission ledger spec §3/§4). Every inpatient
 * charge (regardless of department) and every payment (allocated or a pure
 * advance/deposit) shows here chronologically with a running balance —
 * never a new patient-facing invoice per charge (§1/§5/§6).
 */
export const AdmissionLedgerModal: React.FC<AdmissionLedgerModalProps> = ({ admissionId, onClose, onChanged }) => {
  const toast = useToast();
  const [ledger, setLedger] = useState<AdmissionLedger | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setLedger(await fetchAdmissionLedger(admissionId));
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load admission ledger.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId]);

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
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
      toast.success(`Collected ${formatPKR(Number(amount))}. Receipt posted to the admission ledger.`);
      if (ledger) {
        openPrintWindow(
          'Payment Receipt',
          `${ledgerHeaderHtml(ledger, 'PAYMENT RECEIPT', 'Payment Receipt')}
           <div class="summary-box">
             <div class="summary-row"><span>Amount Received</span><span class="val">${formatPKR(Number(amount))}</span></div>
             <div class="summary-row"><span>Method</span><span class="val">${method}</span></div>
             ${reference.trim() ? `<div class="summary-row"><span>Reference</span><span class="val">${reference.trim()}</span></div>` : ''}
           </div>`,
        );
      }
      setAmount('');
      setReference('');
      await load();
      onChanged?.();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to collect payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintStatement = () => {
    if (!ledger) return;
    openPrintWindow(
      'Running Statement',
      `${ledgerHeaderHtml(ledger, 'RUNNING / INTERIM STATEMENT — NOT FINAL INVOICE', 'Running / Interim Statement')}${ledgerTableHtml(ledger)}`,
    );
  };

  const handleGenerateFinalBill = async () => {
    setIsGeneratingBill(true);
    try {
      const result = await generateFinalBill(admissionId);
      setLedger(result);
      toast.success(`Final Bill ${result.finalBillNumber} generated.`);
      openPrintWindow(
        'Final Bill',
        `${ledgerHeaderHtml(result, 'FINAL BILL / FINANCIAL CLOSURE STATEMENT', 'Final Bill', result.finalBillNumber)}${ledgerTableHtml(result)}`,
      );
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate final bill.');
    } finally {
      setIsGeneratingBill(false);
    }
  };

  const wardRoomBed = useMemo(
    () => (ledger ? [ledger.ward, ledger.room, ledger.bed].filter(Boolean).join(' / ') || '—' : '—'),
    [ledger],
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={ledger ? `Admission Record — ${ledger.admissionNumber}` : 'Admission Record'}
      subtitle="Running Admission Ledger — one continuous financial history for this admission."
      maxWidth="5xl"
    >
      {isLoading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Loading ledger…</span>
        </div>
      ) : loadError ? (
        <div className="p-6 flex flex-col items-center gap-2 text-center">
          <AlertCircle className="h-5 w-5 text-rose-500" />
          <p className="text-xs text-rose-700 font-medium">{loadError}</p>
          <button type="button" onClick={load} className="mt-1 text-xs font-semibold text-[#08775A] hover:underline">Retry</button>
        </div>
      ) : ledger ? (
        <div className="space-y-4">
          {/* Header info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 rounded-xl border border-slate-200 p-3.5">
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-slate-500 font-semibold">Patient</span><span className="font-bold text-slate-900">{ledger.patientName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-semibold">MR #</span><span className="font-semibold text-slate-800">{ledger.patientMrNumber || '—'}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500 font-semibold">Payer</span>
                {ledger.payerType === 'PANEL' ? <PanelBadge label={ledger.panelName || 'Panel'} /> : <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">Self-Pay</span>}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-slate-500 font-semibold">Admission Date</span><span className="font-semibold text-slate-800">{formatTimestamp(ledger.admittedAt)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-semibold">Ward / Room / Bed</span><span className="font-semibold text-slate-800">{wardRoomBed}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-semibold">Current Status</span><span className="font-bold text-[#08775A]">{ledger.status.replace(/_/g, ' ')}</span></div>
            </div>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase block">Total Charges</span>
              <span className="font-bold text-slate-800">{formatPKR(ledger.summary.totalCharges)}</span>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-[10px] text-emerald-700 uppercase block">Total Paid</span>
              <span className="font-bold text-emerald-800">{formatPKR(ledger.summary.totalPaid)}</span>
            </div>
            <div className="p-2.5 bg-[#effaf5] rounded-lg border border-[#c2e7db]">
              <span className="text-[10px] text-[#08775A] uppercase block">Available Credit</span>
              <span className="font-bold text-[#08775A]">{formatPKR(ledger.summary.availableCredit)}</span>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-[10px] text-amber-700 uppercase block">Outstanding</span>
              <span className="font-bold text-amber-800">{formatPKR(ledger.summary.outstandingBalance)}</span>
            </div>
          </div>

          {/* Panel figures */}
          {ledger.panel && (
            <div className="border border-purple-200 bg-purple-50/50 rounded-lg p-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-800 mb-2">Panel Figures</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div><span className="text-purple-700 block">Gross Charges</span><span className="font-bold text-purple-900">{formatPKR(ledger.panel.grossCharges)}</span></div>
                <div><span className="text-purple-700 block">Patient Share</span><span className="font-bold text-purple-900">{formatPKR(ledger.panel.patientShare)}</span></div>
                <div><span className="text-purple-700 block">Panel Receivable</span><span className="font-bold text-purple-900">{formatPKR(ledger.panel.panelReceivable)}</span></div>
                <div><span className="text-purple-700 block">Patient Paid</span><span className="font-bold text-purple-900">{formatPKR(ledger.panel.patientPaid)}</span></div>
                <div><span className="text-purple-700 block">Panel Realized</span><span className="font-bold text-purple-900">{formatPKR(ledger.panel.panelRealized)}</span></div>
                <div><span className="text-purple-700 block">Patient Outstanding</span><span className="font-bold text-purple-900">{formatPKR(ledger.panel.patientOutstanding)}</span></div>
                <div><span className="text-purple-700 block">Panel Outstanding</span><span className="font-bold text-purple-900">{formatPKR(ledger.panel.panelOutstanding)}</span></div>
              </div>
            </div>
          )}

          {/* Running Ledger table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    {['Date/Time', 'Type', 'Department', 'Description', 'Qty', 'Rate', 'Debit', 'Credit', 'Balance', 'Reference', 'Posted By'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.entries.map((e, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatTimestamp(e.date)}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-800">{e.type}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">{e.department || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{e.description}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{e.qty ?? ''}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{e.rate != null ? formatPKR(e.rate) : ''}</td>
                      <td className="px-3 py-2 text-right text-rose-700 font-semibold">{e.debit > 0 ? formatPKR(e.debit) : ''}</td>
                      <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{e.credit > 0 ? formatPKR(e.credit) : ''}</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900">{formatPKR(e.runningBalance)}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-[10px] text-slate-500">{e.reference}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">{e.postedBy || '—'}</td>
                    </tr>
                  ))}
                  {ledger.entries.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-3 py-6 text-center text-slate-400">No charges or payments posted yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Receive Payment */}
          <form onSubmit={handleCollectPayment} className="border-t border-slate-200 pt-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#08775A] flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Receive Payment
            </h4>
            {formError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NumberInput
                label="Amount"
                required
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                hint="Settles outstanding charges first; any extra banks as Advance/Credit."
              />
              <Select label="Payment Method" required options={PAYMENT_METHODS} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} />
              <TextInput label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Collect &amp; Print Receipt
              </button>
            </div>
          </form>

          {/* Statement / Final Bill actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handlePrintStatement}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4 text-[#08775A]" />
              <span>Generate Running Statement</span>
            </button>
            <div className="flex items-center gap-2">
              {ledger.finalBillNumber && (
                <span className="text-[11px] text-slate-500">
                  Final Bill: <span className="font-mono font-bold text-slate-800">{ledger.finalBillNumber}</span>
                </span>
              )}
              <button
                type="button"
                onClick={handleGenerateFinalBill}
                disabled={isGeneratingBill}
                className="px-4 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {isGeneratingBill ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                <span>{ledger.finalBillNumber ? 'Re-print Final Bill' : 'Generate Invoice / Final Bill'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
