import React, { useState } from 'react';
import { AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Textarea } from '../../../components/forms/FormControls';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import { appointmentsApiService, AppointmentRecord } from '../../../services/frontdeskApiService';

interface CancelAppointmentModalProps {
  appointment: AppointmentRecord;
  onClose: () => void;
  onCancelled: () => void;
}

/** §16 — Cancellation Reason is mandatory; an existing advance is never silently refunded. */
export const CancelAppointmentModal: React.FC<CancelAppointmentModalProps> = ({ appointment, onClose, onCancelled }) => {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError('Cancellation reason is required.');
      return;
    }
    setIsSaving(true);
    try {
      await appointmentsApiService.cancelAppointment(appointment.id, reason.trim());
      toast.success('Appointment cancelled.');
      onCancelled();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel appointment.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Cancel Appointment"
      subtitle={`${appointment.patientName} — ${appointment.serviceName}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            Back
          </button>
          <button
            type="submit"
            form="cancel-appointment-form"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirm Cancellation
          </button>
        </>
      }
    >
      <form id="cancel-appointment-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {appointment.advancePaid > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              An advance of <strong>{formatPKR(appointment.advancePaid)}</strong> was already collected on this appointment. Cancelling will{' '}
              <strong>not</strong> refund it automatically — this remains a financial follow-up (process via the existing Refund workflow on the
              linked invoice, or record it as patient credit).
            </span>
          </div>
        )}

        <Textarea
          label="Cancellation Reason"
          required
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Patient requested reschedule, doctor unavailable…"
        />
      </form>
    </Modal>
  );
};
