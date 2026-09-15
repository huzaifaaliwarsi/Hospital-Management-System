import React, { useEffect, useState } from 'react';
import { CreditCard, Loader2, AlertCircle, Wallet, RotateCcw } from 'lucide-react';
import { Select } from '../../../components/forms/FormControls';
import { formatPKR } from '../../../utils/formatters';
import { fetchPaymentRequests, PaymentRequestRecord, PaymentRequestStatus } from '../../../services/paymentRequestService';
import { CollectPaymentRequestModal } from './CollectPaymentRequestModal';
import { PanelBadge } from '../../../components/common/PanelBadge';

const STATUS_OPTIONS: { label: string; value: PaymentRequestStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Partially Fulfilled', value: 'PARTIALLY_FULFILLED' },
  { label: 'Fulfilled', value: 'FULFILLED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const STATUS_BADGE: Record<PaymentRequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PARTIALLY_FULFILLED: 'bg-blue-100 text-blue-700',
  FULFILLED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

/**
 * Front Desk queue for `AdmissionPaymentRequest` rows the Admission portal
 * raises (HMS_V7.2_NEW_REQUIREMENTS.md §3.3) — real, backed by
 * `services/paymentRequestService.ts` → `/api/v1/admission-payment-requests*`.
 * Defaults to the active queue (Pending + Partially Fulfilled); pick a
 * status to see the rest.
 */
export const AdmissionPaymentRequestsView: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<PaymentRequestStatus | ''>('');
  const [requests, setRequests] = useState<PaymentRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collectTarget, setCollectTarget] = useState<PaymentRequestRecord | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRequests(await fetchPaymentRequests(statusFilter || undefined));
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load payment requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Admission Payment Requests</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Advance / Partial / Final payment requests raised by the Admission Portal — collect against them here.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="w-56">
          <Select
            label="Status"
            placeholder="Active (Pending + Partial)"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PaymentRequestStatus | '')}
          />
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 mt-4">
          <RotateCcw className="h-3 w-3" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loadError ? (
          <div className="p-8 flex flex-col items-center gap-2 text-center">
            <AlertCircle className="h-6 w-6 text-rose-500" />
            <p className="text-xs text-rose-700 font-medium">{loadError}</p>
            <button type="button" onClick={load} className="mt-1 text-xs font-semibold text-[#08775A] hover:underline">
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Loading payment requests…</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">No payment requests found for the selected filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Admission', 'Patient', 'Payer', 'Department / Doctor', 'Type', 'Requested', 'Collected', 'Remaining', 'Status', 'Requested By', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-700">{r.admissionNumber}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{r.patientName}</div>
                      <div className="text-[10px] text-slate-400">{r.patientPhone}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.payerType === 'Corporate / Panel' ? (
                        <PanelBadge />
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">Self-Pay</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                      {r.departmentName} / {r.doctorName}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{r.requestType}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-800">{formatPKR(r.requestedAmount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-emerald-700">{formatPKR(r.collectedAmount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-amber-700">{formatPKR(r.remainingAmount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_BADGE[r.status]}`}>{r.status.replace('_', ' ')}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{r.requestedByLabel}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {(r.status === 'PENDING' || r.status === 'PARTIALLY_FULFILLED') && (
                        <button
                          type="button"
                          title="Collect Payment"
                          onClick={() => setCollectTarget(r)}
                          className="p-1.5 rounded-md text-[#08775A] hover:bg-[#effaf5]"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {collectTarget && (
        <CollectPaymentRequestModal
          request={collectTarget}
          onClose={() => setCollectTarget(null)}
          onCollected={() => {
            setCollectTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
};
