import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { formatPKR } from '../../../utils/formatters';
import { appointmentsApiService, AppointmentRecord } from '../../../services/frontdeskApiService';

interface AppointmentDetailModalProps {
  appointmentId: string;
  onClose: () => void;
}

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
    <span className="text-[10px] text-slate-500 uppercase block">{label}</span>
    <span className="font-semibold text-slate-800 text-xs">{value ?? '—'}</span>
  </div>
);

/** §18 — Appointment Detail Modal: every real field, no fabricated values. */
export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({ appointmentId, onClose }) => {
  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    appointmentsApiService
      .getAppointmentById(appointmentId)
      .then((a) => !cancelled && setAppointment(a))
      .catch((err) => !cancelled && setError(err?.message || 'Failed to load appointment.'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  return (
    <Modal isOpen onClose={onClose} title="Appointment Details" maxWidth="2xl">
      {isLoading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Loading…</span>
        </div>
      ) : error ? (
        <div className="p-6 flex flex-col items-center gap-2 text-center">
          <AlertCircle className="h-5 w-5 text-rose-500" />
          <p className="text-xs text-rose-700 font-medium">{error}</p>
        </div>
      ) : appointment ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Field label="Slot" value={`${appointment.slotDate}, ${appointment.slotTime}`} />
            <Field label="Status" value={appointment.status} />
            <Field label="Payer Type" value={appointment.payerType} />
            <Field label="Patient" value={appointment.patientName} />
            {appointment.payerType === 'Corporate / Panel' && <Field label="Panel" value={appointment.panelName} />}
            <Field label="Doctor" value={appointment.doctorName} />
            <Field label="Department" value={appointment.departmentName} />
            <Field label="Service" value={appointment.serviceName} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Field label="Gross Fee" value={formatPKR(appointment.invoiceTotal || appointment.estimatedAmount)} />
            {appointment.payerType === 'Corporate / Panel' && appointment.invoiceId && (
              <>
                <Field label="Patient Share" value={formatPKR(appointment.patientShare)} />
                <Field label="Panel Receivable" value={formatPKR(appointment.panelReceivable)} />
              </>
            )}
            <Field label="Advance Paid" value={formatPKR(appointment.advancePaid)} />
            <Field
              label="Current Remaining"
              value={formatPKR(
                Math.max(
                  0,
                  (appointment.payerType === 'Corporate / Panel' && appointment.invoiceId ? appointment.patientShare : appointment.invoiceTotal || appointment.estimatedAmount) -
                    appointment.advancePaid,
                ),
              )}
            />
          </div>

          {appointment.advanceReceipts.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Advance Receipt History</h4>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {appointment.advanceReceipts.map((r) => (
                  <div key={r.id} className="px-3 py-2 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-600">{r.receiptNumber}</span>
                    <span className="text-slate-500">{r.method}</span>
                    <span className="text-slate-400">{r.collectedAt}</span>
                    <span className={`font-semibold ${r.isReversed ? 'text-rose-600 line-through' : 'text-emerald-700'}`}>{formatPKR(r.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {appointment.status === 'CHECKED_IN' && appointment.invoiceId && (
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Invoice Reference" value={appointment.invoiceNumber} />
              <Field label="Encounter" value="Linked — see Hospital Invoices" />
            </div>
          )}

          {appointment.cancellationReason && <Field label="Cancellation Reason" value={appointment.cancellationReason} />}

          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
            <Field label="Created By" value={appointment.createdByLabel} />
            <Field label="Created At" value={appointment.createdAt} />
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
