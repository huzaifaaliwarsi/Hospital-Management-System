import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Plus,
  Search,
  RotateCcw,
  AlertCircle,
  Loader2,
  CalendarClock,
  CheckCircle2,
  UserCheck,
  Ban,
  Eye,
  Wallet,
  LogIn,
  Receipt,
  Pencil,
} from 'lucide-react';
import { Select, TextInput } from '../../../components/forms/FormControls';
import { DepartmentService } from '../../../services/departmentService';
import { StaffUserService } from '../../../services/staffUserService';
import { formatDateISO, getHospitalCurrentDate } from '../../../utils/dateConstants';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import {
  appointmentsApiService,
  AppointmentRecord,
  AppointmentStatus,
} from '../../../services/frontdeskApiService';
import { BookAppointmentModal } from './BookAppointmentModal';
import { CollectAdvanceModal } from './CollectAdvanceModal';
import { CancelAppointmentModal } from './CancelAppointmentModal';
import { AppointmentDetailModal } from './AppointmentDetailModal';
import { InvoiceDetailModal } from '../billing/InvoiceDetailModal';
import { PanelBadge } from '../../../components/common/PanelBadge';

const STATUS_OPTIONS: { label: string; value: AppointmentStatus }[] = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Checked In', value: 'CHECKED_IN' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Rescheduled', value: 'RESCHEDULED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'No Show', value: 'NO_SHOW' },
];

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  CHECKED_IN: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-teal-100 text-teal-700',
  RESCHEDULED: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
  NO_SHOW: 'bg-slate-200 text-slate-600',
};

/** Payable amount, best-available at this point in the lifecycle — invoice-derived once Checked-In, estimate before. */
function payableAmount(a: AppointmentRecord): number {
  if (a.invoiceId) {
    return a.payerType === 'Corporate / Panel' ? a.patientShare : a.invoiceTotal;
  }
  return a.estimatedAmount;
}

/**
 * v7.2 §3.3 Front Desk Appointments — real, DB-backed (HMS_V7.2_NEW_REQUIREMENTS.md).
 * Booking, advance collection, reschedule, cancel and Check-In (which creates
 * the real department-tagged `HospitalInvoice`) all round-trip through
 * `appointmentsApiService` → `/api/v1/appointments*`. Zero hard-coded
 * operational data — every row, KPI and dropdown option comes from a live API.
 */
export const AppointmentsView: React.FC = () => {
  const toast = useToast();
  const departments = useMemo(() => DepartmentService.getDepartments().filter((d) => d.status === 'Active'), []);
  const doctors = useMemo(
    () => StaffUserService.getStaffUsers().filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'),
    [],
  );

  const [dateFilter, setDateFilter] = useState(formatDateISO(getHospitalCurrentDate()));
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isBookOpen, setIsBookOpen] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState<AppointmentRecord | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentRecord | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRecord | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [invoiceModalId, setInvoiceModalId] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const rows = await appointmentsApiService.getAppointments({
        date: dateFilter || undefined,
        departmentId: departmentFilter || undefined,
        doctorStaffId: doctorFilter || undefined,
        status: statusFilter || undefined,
        search: searchTerm.trim() || undefined,
      });
      setAppointments(rows);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load appointments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, departmentFilter, doctorFilter, statusFilter]);

  // Search is debounced-by-hand via a simple timeout so every keystroke doesn't refetch.
  useEffect(() => {
    const t = setTimeout(() => {
      load();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const resetFilters = () => {
    setDateFilter(formatDateISO(getHospitalCurrentDate()));
    setDepartmentFilter('');
    setDoctorFilter('');
    setStatusFilter('');
    setSearchTerm('');
  };

  const kpis = useMemo(() => {
    return {
      total: appointments.length,
      confirmed: appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'RESCHEDULED').length,
      checkedIn: appointments.filter((a) => a.status === 'CHECKED_IN').length,
      cancelled: appointments.filter((a) => a.status === 'CANCELLED').length,
    };
  }, [appointments]);

  const handleCheckIn = async (a: AppointmentRecord) => {
    setCheckingInId(a.id);
    try {
      const encType: 'OPD' | 'OBSERVATION' | 'EMERGENCY' = a.notes?.includes('[EMERGENCY]')
        ? 'EMERGENCY'
        : a.notes?.includes('[OBSERVATION]')
        ? 'OBSERVATION'
        : 'OPD';
      const result = await appointmentsApiService.checkInAppointment(a.id, { encounterType: encType });
      toast.success(`${a.patientName} checked in — invoice created.`);
      await load();
      if (result.invoiceId) setInvoiceModalId(result.invoiceId);
    } catch (err: any) {
      toast.error(err?.message || 'Check-in failed.');
    } finally {
      setCheckingInId(null);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Appointments</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage scheduled patient visits, advances, check-in and appointment status.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsBookOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Book Appointment
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Today's Appointments", value: kpis.total, icon: CalendarClock, color: 'text-slate-700 bg-slate-100' },
          { label: 'Confirmed / Scheduled', value: kpis.confirmed, icon: CheckCircle2, color: 'text-blue-700 bg-blue-50' },
          { label: 'Checked In', value: kpis.checkedIn, icon: UserCheck, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Cancelled', value: kpis.cancelled, icon: Ban, color: 'text-rose-700 bg-rose-50' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${k.color}`}>
              <k.icon className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 leading-none">{k.value}</p>
              <p className="text-[11px] text-slate-500 mt-1">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <TextInput label="Date" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          <Select
            label="Department"
            placeholder="All Departments"
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          />
          <Select
            label="Doctor"
            placeholder="All Doctors"
            options={doctors.map((d) => ({ label: d.fullName, value: d.id }))}
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
          />
          <Select
            label="Status"
            placeholder="All Statuses"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | '')}
          />
          <TextInput
            label="Search"
            icon={<Search className="h-3.5 w-3.5" />}
            placeholder="Patient name, phone, MRN…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <span className="text-[11px] text-slate-500">
            {isLoading ? 'Loading…' : `Showing ${appointments.length} record${appointments.length === 1 ? '' : 's'}`}
          </span>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
          >
            <RotateCcw className="h-3 w-3" /> Reset Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loadError ? (
          <div className="p-8 flex flex-col items-center gap-2 text-center">
            <AlertCircle className="h-6 w-6 text-rose-500" />
            <p className="text-xs text-rose-700 font-medium">{loadError}</p>
            <button
              type="button"
              onClick={load}
              className="mt-1 text-xs font-semibold text-[#08775A] hover:underline"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Loading appointments…</span>
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">No appointments found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Slot', 'Patient', 'Payer', 'Doctor', 'Department', 'Service', 'Patient Payable', 'Advance Paid', 'Remaining', 'Status', 'Actions'].map(
                    (h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((a) => {
                  const payable = payableAmount(a);
                  const remaining = Math.max(0, payable - a.advancePaid);
                  const eligibleForActions = a.status === 'CONFIRMED' || a.status === 'RESCHEDULED';
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{a.slotTime}</div>
                        <div className="text-[10px] text-slate-400">{a.slotDate}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{a.patientName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {a.payerType === 'Corporate / Panel' ? (
                            <PanelBadge />
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">Self-Pay</span>
                          )}
                          <span className="text-[10px] text-slate-400">{a.patientPhone}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                        {a.payerType === 'Corporate / Panel' ? a.panelName || '—' : 'Self Pay'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{a.doctorName}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{a.departmentName}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{a.serviceName}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-800">{formatPKR(payable)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-emerald-700">{formatPKR(a.advancePaid)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-amber-700">{formatPKR(remaining)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_BADGE[a.status]}`}>{a.status}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {eligibleForActions && (
                            <>
                              <button
                                type="button"
                                title="Check In"
                                disabled={checkingInId === a.id}
                                onClick={() => handleCheckIn(a)}
                                className="p-1.5 rounded-md text-[#08775A] hover:bg-[#effaf5] disabled:opacity-50"
                              >
                                {checkingInId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                title="Collect Advance"
                                onClick={() => setAdvanceTarget(a)}
                                className="p-1.5 rounded-md text-amber-700 hover:bg-amber-50"
                              >
                                <Wallet className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Reschedule"
                                onClick={() => setRescheduleTarget(a)}
                                className="p-1.5 rounded-md text-blue-700 hover:bg-blue-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Cancel"
                                onClick={() => setCancelTarget(a)}
                                className="p-1.5 rounded-md text-rose-700 hover:bg-rose-50"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {a.status === 'CHECKED_IN' && a.invoiceId && (
                            <button
                              type="button"
                              title="Open Invoice / Billing"
                              onClick={() => setInvoiceModalId(a.invoiceId!)}
                              className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="View Details"
                            onClick={() => setDetailId(a.id)}
                            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isBookOpen && (
        <BookAppointmentModal
          onClose={() => setIsBookOpen(false)}
          onBooked={() => {
            setIsBookOpen(false);
            load();
          }}
        />
      )}

      {advanceTarget && (
        <CollectAdvanceModal
          appointment={advanceTarget}
          onClose={() => setAdvanceTarget(null)}
          onCollected={() => {
            setAdvanceTarget(null);
            load();
          }}
        />
      )}

      {cancelTarget && (
        <CancelAppointmentModal
          appointment={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={() => {
            setCancelTarget(null);
            load();
          }}
        />
      )}

      {rescheduleTarget && (
        <BookAppointmentModal
          rescheduleAppointment={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onBooked={() => {
            setRescheduleTarget(null);
            load();
          }}
        />
      )}

      {detailId && <AppointmentDetailModal appointmentId={detailId} onClose={() => setDetailId(null)} />}

      {invoiceModalId && (
        <InvoiceDetailModal invoiceId={invoiceModalId} onClose={() => setInvoiceModalId(null)} onChanged={load} />
      )}
    </div>
  );
};
