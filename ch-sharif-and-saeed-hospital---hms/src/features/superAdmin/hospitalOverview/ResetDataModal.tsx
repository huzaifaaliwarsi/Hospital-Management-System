import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  Loader2,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { dataResetService, ResetSummary } from '../../../services/dataResetService';
import { useToast } from '../../../context/ToastContext';

interface ResetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetSuccess?: () => void;
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  isOpen,
  onClose,
  onResetSuccess,
}) => {
  const toast = useToast();
  const [confirmationText, setConfirmationText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<ResetSummary | null>(null);

  if (!isOpen) return null;

  const isConfirmed = confirmationText.trim() === 'RESET';

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await dataResetService.resetTransactionalData();
      setSummaryResult(res.summary);
      toast.success('Test and transactional data successfully purged.');
      if (onResetSuccess) {
        onResetSuccess();
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to reset transactional data. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    const shouldReload = !!summaryResult;
    setConfirmationText('');
    setError(null);
    setSummaryResult(null);
    onClose();
    if (shouldReload) {
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#e2eae5] shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-950">Reset Test & Transactional Data</h3>
              <p className="text-xs text-rose-700">Permanent and irreversible cleanup</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-[#8b9e95] hover:text-[#111827] p-1.5 rounded-lg hover:bg-white/80 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {summaryResult ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <div className="h-10 w-10 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-emerald-950">
                  Database Reset Completed Successfully!
                </h4>
                <p className="text-xs text-emerald-700">
                  All transactional test clutter has been deleted. Master records remain intact.
                </p>
              </div>

              {/* Summary Stats Grid */}
              <div className="bg-[#f6faf8] border border-[#e2eae5] rounded-xl p-4 space-y-2.5">
                <span className="block text-[11px] font-bold text-[#52665e] uppercase tracking-wider">
                  Summary of Wiped Records
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-[#e2eae5] flex justify-between">
                    <span className="text-[#52665e]">Appointments:</span>
                    <span className="font-bold text-[#111827]">{summaryResult.appointments}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-[#e2eae5] flex justify-between">
                    <span className="text-[#52665e]">Invoices:</span>
                    <span className="font-bold text-[#111827]">{summaryResult.invoices}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-[#e2eae5] flex justify-between">
                    <span className="text-[#52665e]">Receipts & Cash:</span>
                    <span className="font-bold text-[#111827]">{summaryResult.paymentReceipts}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-[#e2eae5] flex justify-between">
                    <span className="text-[#52665e]">Admissions:</span>
                    <span className="font-bold text-[#111827]">{summaryResult.admissions}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-[#e2eae5] flex justify-between">
                    <span className="text-[#52665e]">Panel Patients:</span>
                    <span className="font-bold text-[#111827]">{summaryResult.panelPatients}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-[#e2eae5] flex justify-between">
                    <span className="text-[#52665e]">Self-Pay Visits:</span>
                    <span className="font-bold text-[#111827]">{summaryResult.selfPayEncounters}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-[#e2eae5] flex justify-between">
                    <span className="text-[#52665e]">Corporate Panels:</span>
                    <span className="font-bold text-[#111827]">{summaryResult.corporatePanels}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-[#e2eae5] flex justify-between">
                    <span className="text-[#52665e]">Beds Reset:</span>
                    <span className="font-bold text-[#111827]">{summaryResult.resetBeds}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 bg-[#129b70] hover:bg-[#08775A] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <span>Please read carefully before proceeding</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  This action will permanently delete all operational records (patients, appointments,
                  bills, cash books, admission stays) created during testing.
                </p>
              </div>

              {/* What is deleted vs preserved */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-rose-50/50 border border-rose-100 space-y-1.5">
                  <span className="block text-[11px] font-bold text-rose-800">
                    Will be Permanently Deleted:
                  </span>
                  <ul className="text-[11px] text-rose-700 space-y-1 list-disc list-inside">
                    <li>All Appointments & Queues</li>
                    <li>All Invoices & Payments</li>
                    <li>Cashier Shifts & Cashbook</li>
                    <li>Admissions & Bed Stays</li>
                    <li>All Patients (Panel & Self-Pay)</li>
                    <li>Corporate Panel Companies</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100 space-y-1.5">
                  <span className="block text-[11px] font-bold text-emerald-800">
                    Will Remain Safe & Intact:
                  </span>
                  <ul className="text-[11px] text-emerald-700 space-y-1 list-disc list-inside">
                    <li>Super Admin / Admin Logins</li>
                    <li>Doctors & Staff Users</li>
                    <li>Departments & Shifts</li>
                    <li>Services & Charge Rates</li>
                    <li>Hospital Profile & Ward/Bed Setup</li>
                  </ul>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Confirmation Input */}
              <div className="space-y-2 pt-2 border-t border-[#e2eae5]">
                <label className="block text-xs font-semibold text-[#111827]">
                  To confirm, type <span className="font-mono font-bold text-rose-700">RESET</span> below:
                </label>
                <input
                  type="text"
                  id="input-confirm-reset"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Type RESET here"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 border border-[#c2e7db] rounded-lg text-xs font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                  autoComplete="off"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-white hover:bg-[#f6faf8] text-[#52665e] hover:text-[#111827] border border-[#e2eae5] text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-confirm-wipe"
                  disabled={!isConfirmed || isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Resetting Database…</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Purge Test Records</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
