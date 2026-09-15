import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2, AlertCircle, Plus } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Select, NumberInput, TextInput, Textarea } from '../../components/forms/FormControls';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { formatPKR } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { fetchPaymentRequests, PaymentRequestRecord } from '../../services/paymentRequestService';
import { fetchAdmissions, requestAdmissionPayment, AdmissionRecord } from '../../services/admissionService';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PARTIALLY_FULFILLED: 'bg-blue-100 text-blue-700',
  FULFILLED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-slate-200 text-slate-600',
};

const NewRequestModal: React.FC<{ admissions: AdmissionRecord[]; onClose: () => void; onRequested: () => void }> = ({
  admissions,
  onClose,
  onRequested,
}) => {
  const toast = useToast();
  const [admissionId, setAdmissionId] = useState('');
  const [requestType, setRequestType] = useState<'ADVANCE' | 'PARTIAL' | 'FINAL'>('PARTIAL');
  const [amount, setAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionId) {
      setError('Select an admission.');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await requestAdmissionPayment(admissionId, { requestType, requestedAmount: Number(amount), notes: notes.trim() || undefined });
      toast.success('Payment request sent to Front Desk / Billing.');
      onRequested();
    } catch (err: any) {
      setError(err?.message || 'Failed to raise payment request.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Request Hospital Payment" subtitle="Sent to Front Desk / Billing — Admission never collects cash." maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        <Select
          label="Admission"
          required
          placeholder="Choose an active admission…"
          options={admissions.map((a) => ({ label: `${a.admissionNumber} — ${a.patientName}`, value: a.id }))}
          value={admissionId}
          onChange={(e) => setAdmissionId(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Request Type"
            options={[
              { label: 'Advance', value: 'ADVANCE' },
              { label: 'Partial', value: 'PARTIAL' },
              { label: 'Final', value: 'FINAL' },
            ]}
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as any)}
          />
          <NumberInput label="Amount (PKR)" required min={1} value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
        <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button>
          <button type="submit" disabled={isSaving} className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5">
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Send Request
          </button>
        </div>
      </form>
    </Modal>
  );
};

/**
 * Hospital Payment Requests (Admission-portal view) — raise a new request
 * (routes to Front Desk's queue) plus a read-only history. No Collect
 * action here: `POST /admission-payment-requests/:id/collect` requires
 * `frontdesk:create`, which the ADMISSION role never has — the "no Receive
 * Cash" rule is enforced structurally, not just by hiding a button.
 */
export const AdmissionPaymentRequestsView: React.FC = () => {
  const [requests, setRequests] = useState<PaymentRequestRecord[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<AdmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [reqs, active] = await Promise.all([fetchPaymentRequests(), fetchAdmissions({ status: 'ACTIVE' })]);
      setRequests(reqs);
      setActiveAdmissions(active);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load payment requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Hospital Payment Requests</h1>
            <p className="text-xs text-slate-500 mt-0.5">Raise advance/partial/final payment requests — Front Desk collects, Admission never does.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsNewOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" /> New Request
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading payment requests…" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : requests.length === 0 ? (
          <EmptyState title="No payment requests" description="Requests raised from active admissions will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Admission #', 'Patient', 'Type', 'Requested', 'Collected', 'Remaining', 'Status', 'Requested At'].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-700">{r.admissionNumber}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-900">{r.patientName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{r.requestType}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-800">{formatPKR(r.requestedAmount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-emerald-700">{formatPKR(r.collectedAmount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-amber-700">{formatPKR(r.remainingAmount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_BADGE[r.status] || 'bg-slate-100 text-slate-600'}`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">{r.requestedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isNewOpen && (
        <NewRequestModal
          admissions={activeAdmissions}
          onClose={() => setIsNewOpen(false)}
          onRequested={() => {
            setIsNewOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
};
