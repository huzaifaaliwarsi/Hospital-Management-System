import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { formatPKR } from '../../../utils/formatters';
import { appointmentsApiService, AppointmentRecord } from '../../../services/frontdeskApiService';

interface AppointmentDetailModalProps {
  appointmentId: string;
  onClose: () => void;
}

const ReadOnlyField: React.FC<{
  label: string;
  value: React.ReactNode;
  className?: string;
  highlight?: 'emerald' | 'rose' | 'blue' | 'normal';
}> = ({ label, value, className = '', highlight = 'normal' }) => {
  let valueStyle = 'bg-slate-50 border-slate-200 text-slate-900';
  if (highlight === 'emerald') {
    valueStyle = 'bg-emerald-50/60 border-emerald-200 text-emerald-800 font-bold';
  } else if (highlight === 'rose') {
    valueStyle = 'bg-rose-50/60 border-rose-200 text-rose-700 font-bold';
  } else if (highlight === 'blue') {
    valueStyle = 'bg-blue-50/60 border-blue-200 text-blue-800 font-bold';
  }

  return (
    <div className={className}>
      <label className="block text-[11px] font-medium text-slate-600 mb-1">
        {label}
      </label>
      <div
        className={`px-3 py-2 border rounded-lg text-xs font-medium truncate ${valueStyle}`}
      >
        {value ?? '—'}
      </div>
    </div>
  );
};

const SectionHeading: React.FC<{ title: string }> = ({ title }) => (
  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
    {title}
  </h4>
);

/**
 * Appointment Detail Modal matching Add New Staff modal design:
 * Clean green header box at the top, clear section headers, and standard field inputs.
 */
export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  appointmentId,
  onClose,
}) => {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const netRemaining = appointment
    ? Math.max(
        0,
        (appointment.payerType === 'Corporate / Panel' && appointment.invoiceId
          ? appointment.patientShare
          : appointment.invoiceTotal || appointment.estimatedAmount) - appointment.advancePaid
      )
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Green Box Header (Same as Add New Staff Modal) */}
        <div className="bg-gradient-to-r from-[#0a4636] to-[#08775A] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-base">Appointment Details</h3>
            <p className="text-xs text-emerald-100 mt-0.5">
              {appointment?.slotDate
                ? `${appointment.slotDate} · ${appointment.slotTime} (${appointment.status})`
                : 'Appointment Record'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body with Clean Form-style Sections */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-[#08775A]" />
              <span className="text-xs">Loading appointment details…</span>
            </div>
          ) : error ? (
            <div className="py-8 px-4 flex flex-col items-center gap-2 text-center bg-rose-50 rounded-lg border border-rose-200">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              <p className="text-xs text-rose-700 font-semibold">{error}</p>
            </div>
          ) : appointment ? (
            <>
              {/* Section 1: Appointment & Schedule */}
              <div>
                <SectionHeading title="Schedule & Status" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <ReadOnlyField
                    label="Slot Date & Time"
                    value={`${appointment.slotDate}, ${appointment.slotTime}`}
                  />
                  <ReadOnlyField
                    label="Status"
                    value={appointment.status}
                    highlight={
                      appointment.status === 'CHECKED_IN'
                        ? 'emerald'
                        : appointment.status === 'CANCELLED'
                        ? 'rose'
                        : 'normal'
                    }
                  />
                  <ReadOnlyField
                    label="Payer Type"
                    value={
                      appointment.payerType === 'Corporate / Panel' && appointment.panelName
                        ? `Panel (${appointment.panelName})`
                        : appointment.payerType
                    }
                  />
                </div>
              </div>

              {/* Section 2: Patient & Consultation */}
              <div>
                <SectionHeading title="Patient & Consultation Details" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <ReadOnlyField label="Patient Name" value={appointment.patientName} />
                  <ReadOnlyField label="Contact Phone" value={appointment.patientPhone || '—'} />
                  <ReadOnlyField label="Consulting Doctor" value={appointment.doctorName || 'Not Assigned'} />
                  <ReadOnlyField label="Department" value={appointment.departmentName || '—'} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">
                  <ReadOnlyField label="Encounter Service" value={appointment.serviceName || 'OPD'} />
                  {appointment.queueNumber ? (
                    <ReadOnlyField label="Queue / Token Number" value={appointment.queueNumber} highlight="emerald" />
                  ) : (
                    <ReadOnlyField
                      label="Encounter Reference"
                      value={appointment.invoiceNumber ? `Linked (${appointment.invoiceNumber})` : 'Pending Check-In'}
                    />
                  )}
                </div>
              </div>

              {/* Section 3: Billing & Payments */}
              <div>
                <SectionHeading title="Billing & Payment Details" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <ReadOnlyField
                    label="Gross Fee"
                    value={formatPKR(appointment.invoiceTotal || appointment.estimatedAmount)}
                  />
                  <ReadOnlyField
                    label="Advance Paid"
                    value={formatPKR(appointment.advancePaid)}
                    highlight={appointment.advancePaid > 0 ? 'emerald' : 'normal'}
                  />
                  <ReadOnlyField
                    label="Current Remaining"
                    value={formatPKR(netRemaining)}
                    highlight={netRemaining > 0 ? 'rose' : 'emerald'}
                  />
                </div>

                {/* Panel breakdown if Corporate */}
                {appointment.payerType === 'Corporate / Panel' && appointment.invoiceId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">
                    <ReadOnlyField label="Patient Share" value={formatPKR(appointment.patientShare)} />
                    <ReadOnlyField label="Panel Receivable" value={formatPKR(appointment.panelReceivable)} />
                  </div>
                )}
              </div>

              {/* Section 4: Advance Receipts History (if any) */}
              {appointment.advanceReceipts && appointment.advanceReceipts.length > 0 && (
                <div>
                  <SectionHeading title="Advance Payment Receipts" />
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-3.5 py-2">Receipt No</th>
                          <th className="px-3.5 py-2">Method</th>
                          <th className="px-3.5 py-2">Date & Time</th>
                          <th className="px-3.5 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {appointment.advanceReceipts.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="px-3.5 py-2 font-mono font-medium text-slate-800">{r.receiptNumber}</td>
                            <td className="px-3.5 py-2 text-slate-600">{r.method}</td>
                            <td className="px-3.5 py-2 text-slate-500">{r.collectedAt}</td>
                            <td
                              className={`px-3.5 py-2 text-right font-semibold tabular-nums ${
                                r.isReversed ? 'text-rose-600 line-through' : 'text-emerald-700'
                              }`}
                            >
                              {formatPKR(r.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cancellation Reason if cancelled */}
              {appointment.cancellationReason && (
                <div>
                  <SectionHeading title="Cancellation Note" />
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                    {appointment.cancellationReason}
                  </div>
                </div>
              )}

              {/* Audit Info */}
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex flex-wrap justify-between gap-2">
                <span>
                  Created by: <strong className="text-slate-700">{appointment.createdByLabel || 'System'}</strong>
                </span>
                <span>
                  Created at: <strong className="text-slate-700">{appointment.createdAt}</strong>
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer with Clean Button */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
