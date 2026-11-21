import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Check, Send } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import { frontdeskApiService } from '../../../services/frontdeskApiService';
import {
  submitSettlement,
  fetchEligibleReceivers,
  EligibleReceiver,
} from '../../../services/settlementService';

interface AdminOnwardSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminOnwardSettlementModal: React.FC<AdminOnwardSettlementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [expectedCash, setExpectedCash] = useState(0);
  const [unsettledCount, setUnsettledCount] = useState(0);
  const [counted, setCounted] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [receivers, setReceivers] = useState<EligibleReceiver[]>([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setLoadError(null);
    setFormError(null);
    setCounted('');
    setReason('');

    Promise.all([
      frontdeskApiService.getCashBalance(),
      fetchEligibleReceivers(),
    ])
      .then(([balance, recList]) => {
        const exp = Number(balance.summary?.expectedPhysicalCash ?? 0);
        setExpectedCash(exp);
        setUnsettledCount(Number(balance.summary?.unsettledCount ?? 0));
        setCounted(exp > 0 ? String(exp) : '');
        setReceivers(recList);
        if (recList.length > 0) {
          const sa = recList.find((r) => r.role === 'SUPER_ADMIN') || recList[0];
          setSelectedReceiverId(sa.id);
        }
      })
      .catch((err: any) => {
        setLoadError(err?.message || 'Failed to load cash custody position.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const countedAmount = counted.trim() !== '' ? Number(counted) : 0;
  const difference = countedAmount - expectedCash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (counted.trim() === '' || Number.isNaN(countedAmount) || countedAmount < 0) {
      setFormError('Please enter valid physical cash.');
      return;
    }
    if (difference !== 0 && !reason.trim()) {
      setFormError('Counted cash differs from expected cash. A reason is required.');
      return;
    }
    if (!selectedReceiverId) {
      setFormError('Please select a Super Admin to receive this settlement.');
      return;
    }

    setIsSaving(true);
    try {
      await submitSettlement({
        physicalCash: countedAmount,
        handoverAmount: countedAmount,
        varianceReason: difference !== 0 ? reason.trim() : undefined,
        receiverUserId: selectedReceiverId,
        remarks: 'Admin onward settlement to Super Admin',
      });
      toast.success('Settlement submitted to Super Admin for audit review.');
      onSuccess();
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit settlement.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settle Custody Onward to Super Admin"
      subtitle="Transfer physical cash in your custody to an authorized Super Admin account."
      maxWidth="md"
    >
      {loadError ? (
        <div className="p-6 flex flex-col items-center gap-2 text-center">
          <AlertCircle className="h-6 w-6 text-rose-500" />
          <p className="text-xs text-rose-700 font-medium">{loadError}</p>
        </div>
      ) : isLoading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading cash custody…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Unsettled Cash Transactions:</span>
              <span className="font-bold font-mono text-slate-900">{unsettledCount}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-900">Expected Physical Cash:</span>
              <span className="text-base font-bold font-mono text-emerald-800">{formatPKR(expectedCash)}</span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="admin-settle-receiver" className="block font-bold text-slate-800 mb-1">
                Settle To (Super Admin Receiver) <span className="text-rose-500">*</span>
              </label>
              <select
                id="admin-settle-receiver"
                value={selectedReceiverId}
                onChange={(e) => setSelectedReceiverId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              >
                {receivers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.displayName || r.username} ({r.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="admin-settle-amount" className="block font-bold text-slate-800 mb-1">
                Physical Cash Handed Over <span className="text-rose-500">*</span>
              </label>
              <input
                id="admin-settle-amount"
                type="number"
                min={0}
                step="any"
                value={counted}
                onChange={(e) => {
                  setCounted(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                placeholder="0"
              />
            </div>

            {difference !== 0 && (
              <div>
                <label htmlFor="admin-settle-reason" className="block font-bold text-slate-800 mb-1">
                  Reason for Difference ({difference < 0 ? 'Shortfall' : 'Surplus'}) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="admin-settle-reason"
                  type="text"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  placeholder="e.g. partial handover / discrepancy explanation"
                />
              </div>
            )}
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Submit Settlement</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
