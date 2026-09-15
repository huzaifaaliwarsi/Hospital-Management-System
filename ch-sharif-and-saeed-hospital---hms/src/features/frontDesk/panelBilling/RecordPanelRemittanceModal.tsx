import React, { useMemo, useState } from 'react';
import { AlertCircle, Loader2, Wallet } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { NumberInput, Select, TextInput, Textarea, Toggle } from '../../../components/forms/FormControls';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import {
  recordPanelRemittance,
  PanelRemittanceMethod,
  PanelStatementInvoiceRow,
} from '../../../services/panelBillingService';

const METHODS: { label: string; value: PanelRemittanceMethod }[] = [
  { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
  { label: 'Cheque', value: 'CHEQUE' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Cash', value: 'CASH' },
];

interface RecordPanelRemittanceModalProps {
  corporatePanelId: string;
  corporatePanelName: string;
  outstandingInvoices: PanelStatementInvoiceRow[];
  onClose: () => void;
  onRecorded: () => void;
}

/**
 * Panel Remittance (HMS_V7.2_NEW_REQUIREMENTS.md §2.5/§2.8) — record an
 * incoming payment from the panel company and allocate it across this
 * panel's outstanding department invoices. Mirrors
 * `AdmissionStatementModal`'s Collect Payment form exactly (same
 * auto/manual allocation toggle, same largest-remainder rounding on the
 * backend) — this is the same allocation problem, one level up.
 */
export const RecordPanelRemittanceModal: React.FC<RecordPanelRemittanceModalProps> = ({
  corporatePanelId,
  corporatePanelName,
  outstandingInvoices,
  onClose,
  onRecorded,
}) => {
  const toast = useToast();
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<PanelRemittanceMethod>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualAmounts, setManualAmounts] = useState<Record<string, number | ''>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
        .map(([hospitalInvoiceId, v]) => ({ hospitalInvoiceId, amount: Number(v) }));
      if (allocations.length === 0) {
        setFormError('Enter at least one department invoice allocation amount.');
        return;
      }
      setIsSaving(true);
      try {
        await recordPanelRemittance(corporatePanelId, {
          amount: manualSum,
          method,
          reference: reference.trim() || undefined,
          remarks: remarks.trim() || undefined,
          allocations,
        });
        toast.success(`Recorded ${formatPKR(manualSum)} remittance from ${corporatePanelName}, allocated across ${allocations.length} invoice(s).`);
        onRecorded();
      } catch (err: any) {
        setFormError(err?.message || 'Failed to record remittance.');
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
      await recordPanelRemittance(corporatePanelId, {
        amount: Number(amount),
        method,
        reference: reference.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      toast.success(`Recorded ${formatPKR(Number(amount))} remittance from ${corporatePanelName}, auto-allocated proportionally.`);
      onRecorded();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record remittance.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Record Panel Remittance"
      subtitle={`${corporatePanelName} — allocate the incoming payment across outstanding department invoices.`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {formError && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {outstandingInvoices.length === 0 ? (
          <p className="text-xs text-slate-500">No outstanding panel receivable to allocate against for this panel.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Allocation</span>
              <Toggle label="Manual per-invoice allocation" checked={manualMode} onChange={setManualMode} />
            </div>

            {manualMode ? (
              <div className="space-y-2">
                {outstandingInvoices.map((inv) => (
                  <div key={inv.hospitalInvoiceId} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-40 shrink-0 truncate" title={`${inv.patientName} — ${inv.invoiceNumber}`}>
                      {inv.patientName} ({inv.invoiceNumber})
                    </span>
                    <span className="text-[10px] text-slate-400 w-32 shrink-0">
                      Outstanding: {formatPKR(inv.panelReceivableOutstanding)}
                    </span>
                    <NumberInput
                      min={0}
                      max={inv.panelReceivableOutstanding}
                      value={manualAmounts[inv.hospitalInvoiceId] ?? ''}
                      onChange={(e) =>
                        setManualAmounts({
                          ...manualAmounts,
                          [inv.hospitalInvoiceId]: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      className="max-w-[140px]"
                    />
                  </div>
                ))}
                <p className="text-[11px] text-slate-500">
                  Total to record: <strong>{formatPKR(manualSum)}</strong>
                </p>
              </div>
            ) : (
              <NumberInput
                label="Amount"
                required
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                hint="Auto-allocated proportionally to each invoice's outstanding panel receivable."
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Select label="Method" required options={METHODS} value={method} onChange={(e) => setMethod(e.target.value as PanelRemittanceMethod)} />
              <TextInput label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <Textarea label="Remarks (optional)" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-600">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Wallet className="h-3.5 w-3.5" /> Record & Allocate
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};
