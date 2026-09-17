import React, { useMemo, useState } from 'react';
import { AlertCircle, Search, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { RadioGroup, Select, TextInput, Textarea, NumberInput, Toggle, CNICInput } from '../../../components/forms/FormControls';
import { DepartmentService } from '../../../services/departmentService';
import { StaffUserService } from '../../../services/staffUserService';
import { ServiceRatesService } from '../../../services/serviceRatesService';
import { getAllPatients } from '../../../services/patientRegistryService';
import { getPanelById } from '../../../services/panelService';
import { Patient } from '../../../types/patient';
import { formatDateISO, getHospitalCurrentDate } from '../../../utils/dateConstants';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';
import {
  appointmentsApiService,
  AppointmentPaymentMethod,
  AppointmentRecord,
} from '../../../services/frontdeskApiService';

const PAYMENT_METHODS: { label: string; value: AppointmentPaymentMethod }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'Bank Transfer', value: 'BANK' },
  { label: 'Online', value: 'ONLINE' },
];

interface BookAppointmentModalProps {
  onClose: () => void;
  onBooked: () => void;
  /** When set, the modal reschedules/edits this appointment instead of booking a new one (§15). */
  rescheduleAppointment?: AppointmentRecord;
}

/** Resolves Panel Service coverage for a service — the only tier that exists today; else NOT_COVERED (§2.5/§5 CRITICAL rule). */
function resolvePanelCoverage(panelId: string, serviceRateId: string, grossFee: number) {
  const panel = getPanelById(panelId);
  const now = new Date();
  const rule = panel?.discountRules.find((r) => {
    if (r.serviceRateId !== serviceRateId) return false;
    const from = new Date(r.effectiveFrom);
    const to = r.effectiveTo ? new Date(r.effectiveTo) : null;
    return from <= now && (!to || to >= now);
  });

  if (!rule || rule.coveragePercent == null) {
    return { covered: false, coveragePercent: 0, panelReceivable: 0, patientShare: grossFee, preauthRequired: rule?.preauthorizationRequired ?? false };
  }
  let panelReceivable = (grossFee * rule.coveragePercent) / 100;
  if (rule.capAmount != null && panelReceivable > rule.capAmount) panelReceivable = rule.capAmount;
  return {
    covered: true,
    coveragePercent: rule.coveragePercent,
    panelReceivable,
    patientShare: grossFee - panelReceivable,
    preauthRequired: !!rule.preauthorizationRequired,
  };
}

export const BookAppointmentModal: React.FC<BookAppointmentModalProps> = ({ onClose, onBooked, rescheduleAppointment }) => {
  const toast = useToast();
  const isReschedule = !!rescheduleAppointment;
  const departments = useMemo(() => DepartmentService.getDepartments().filter((d) => d.status === 'Active'), []);
  const activeServices = useMemo(() => ServiceRatesService.getServices().filter((s) => s.status === 'Active'), []);
  const activeDoctors = useMemo(
    () => StaffUserService.getStaffUsers().filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'),
    [],
  );

  const [patientType, setPatientType] = useState<'SELF_PAY' | 'PANEL'>('SELF_PAY');
  const [panelSearch, setPanelSearch] = useState('');
  const [selectedPanelPatient, setSelectedPanelPatient] = useState<Patient | null>(null);
  const [selfPay, setSelfPay] = useState({
    fullName: '',
    guardianName: '',
    phone: '',
    cnicOrPassport: '',
    gender: '',
    dob: '',
  });

  const [departmentId, setDepartmentId] = useState(rescheduleAppointment?.departmentId || '');
  const [doctorStaffId, setDoctorStaffId] = useState(rescheduleAppointment?.doctorId || '');
  const [serviceRateId, setServiceRateId] = useState(rescheduleAppointment?.serviceRateId || '');
  const [date, setDate] = useState(formatDateISO(getHospitalCurrentDate()));
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');

  const [collectAdvance, setCollectAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState<number | ''>('');
  const [advanceMethod, setAdvanceMethod] = useState<AppointmentPaymentMethod>('CASH');
  const [advanceReference, setAdvanceReference] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const departmentServices = useMemo(
    () => (departmentId ? activeServices.filter((s) => s.departmentId === departmentId) : activeServices),
    [activeServices, departmentId],
  );
  const departmentDoctors = useMemo(() => {
    const scoped = departmentId ? activeDoctors.filter((d) => d.departmentId === departmentId) : [];
    return scoped.length > 0 ? scoped : activeDoctors;
  }, [activeDoctors, departmentId]);

  const selectedService = departmentServices.find((s) => s.id === serviceRateId) || activeServices.find((s) => s.id === serviceRateId);
  const grossFee = selectedService?.standardRate ?? 0;

  const panelPreview =
    patientType === 'PANEL' && selectedPanelPatient?.panelId && selectedService
      ? resolvePanelCoverage(selectedPanelPatient.panelId, selectedService.id, grossFee)
      : null;

  const patientPayable = patientType === 'PANEL' ? (panelPreview ? panelPreview.patientShare : grossFee) : grossFee;

  const panelSearchResults = useMemo(() => {
    if (!panelSearch.trim()) return [];
    const q = panelSearch.trim().toLowerCase();
    return getAllPatients()
      .filter((p) => p.payerType === 'Corporate / Panel')
      .filter((p) => p.fullName.toLowerCase().includes(q) || p.mrNumber.toLowerCase().includes(q) || p.primaryPhone.includes(q))
      .slice(0, 10);
  }, [panelSearch]);

  const handleDepartmentChange = (id: string) => {
    setDepartmentId(id);
    // Clear invalid Doctor/Service selections when Department changes (§12).
    setServiceRateId('');
    setDoctorStaffId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isReschedule) {
      setIsSaving(true);
      try {
        const slotAt = new Date(`${date}T${time}:00`).toISOString();
        await appointmentsApiService.updateAppointment(rescheduleAppointment!.id, {
          slotAt,
          doctorStaffId: doctorStaffId || undefined,
          departmentId: departmentId || undefined,
          serviceRateId: serviceRateId || undefined,
        });
        toast.success('Appointment rescheduled.');
        onBooked();
      } catch (err: any) {
        setFormError(err?.message || 'Failed to reschedule appointment.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (patientType === 'PANEL' && !selectedPanelPatient) {
      setFormError('Search and select a Panel patient.');
      return;
    }
    if (patientType === 'PANEL' && selectedPanelPatient?.status !== 'ACTIVE') {
      setFormError('This Panel membership is not Active — cannot book against an inactive membership.');
      return;
    }
    if (patientType === 'SELF_PAY' && (!selfPay.fullName.trim() || !selfPay.phone.trim())) {
      setFormError('Full Name and Phone are required for a Self-Pay patient.');
      return;
    }
    if (!departmentId || !doctorStaffId || !serviceRateId) {
      setFormError('Department, Doctor and Service are all required.');
      return;
    }
    if (collectAdvance) {
      if (!advanceAmount || Number(advanceAmount) <= 0) {
        setFormError('Enter a valid advance amount.');
        return;
      }
      if (Number(advanceAmount) > patientPayable) {
        setFormError(`Advance (${formatPKR(Number(advanceAmount))}) cannot exceed the patient payable amount (${formatPKR(patientPayable)}).`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const slotAt = new Date(`${date}T${time}:00`).toISOString();
      await appointmentsApiService.bookAppointment({
        panelPatientId: patientType === 'PANEL' ? selectedPanelPatient!.id : undefined,
        newSelfPayPatient:
          patientType === 'SELF_PAY'
            ? {
                fullName: selfPay.fullName.trim(),
                guardianName: selfPay.guardianName.trim() || undefined,
                phone: selfPay.phone.trim(),
                cnicOrPassport: selfPay.cnicOrPassport.trim() || undefined,
                gender: selfPay.gender || undefined,
                dob: selfPay.dob || undefined,
              }
            : undefined,
        departmentId,
        doctorStaffId,
        serviceRateId,
        slotAt,
        estimatedAmount: grossFee || undefined,
        advanceAmount: collectAdvance ? Number(advanceAmount) : undefined,
        paymentMethod: collectAdvance ? advanceMethod : undefined,
        paymentReference: collectAdvance ? advanceReference.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Appointment booked.');
      onBooked();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to book appointment.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      maxWidth="3xl"
      title={isReschedule ? 'Reschedule Appointment' : 'Book Appointment'}
      subtitle={isReschedule ? `${rescheduleAppointment!.patientName} — ${rescheduleAppointment!.serviceName}` : 'Self-Pay or Corporate / Panel patient'}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            form="book-appointment-form"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isReschedule ? 'Save Changes' : 'Book Appointment'}
          </button>
        </>
      }
    >
      <form id="book-appointment-form" onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {!isReschedule && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#08775A]">Patient</h3>
            <RadioGroup
              name="patientType"
              inline
              value={patientType}
              onChange={(v) => {
                setPatientType(v as 'SELF_PAY' | 'PANEL');
                setSelectedPanelPatient(null);
                setPanelSearch('');
              }}
              options={[
                { value: 'SELF_PAY', label: 'Self-Pay' },
                { value: 'PANEL', label: 'Corporate / Panel' },
              ]}
            />

            {patientType === 'PANEL' ? (
              selectedPanelPatient ? (
                <div className="flex items-center justify-between p-3 bg-[#effaf5] border border-[#c2e7db] rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{selectedPanelPatient.fullName}</span>
                      {selectedPanelPatient.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                          <ShieldCheck className="h-3 w-3" /> Active Membership
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                          <ShieldAlert className="h-3 w-3" /> {selectedPanelPatient.status}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {selectedPanelPatient.mrNumber} • {selectedPanelPatient.primaryPhone} • {selectedPanelPatient.panelName} (
                      {selectedPanelPatient.panelMemberId || 'no member ID'})
                    </span>
                  </div>
                  <button type="button" onClick={() => setSelectedPanelPatient(null)} className="text-xs font-semibold text-slate-500 hover:text-rose-600">
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={panelSearch}
                      onChange={(e) => setPanelSearch(e.target.value)}
                      placeholder="Search Panel Patient Registry — name, MRN or phone…"
                      className="w-full text-xs pl-8.5 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75]"
                    />
                  </div>
                  {panelSearchResults.length > 0 && (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {panelSearchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPanelPatient(p);
                            setPanelSearch('');
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{p.fullName}</span>
                            <span className="text-slate-400 ml-2">
                              {p.mrNumber} • {p.panelName}
                            </span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${p.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {p.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput label="Full Name" required value={selfPay.fullName} onChange={(e) => setSelfPay({ ...selfPay, fullName: e.target.value })} />
                <TextInput label="Father / Guardian" value={selfPay.guardianName} onChange={(e) => setSelfPay({ ...selfPay, guardianName: e.target.value })} />
                <TextInput label="Phone" required value={selfPay.phone} onChange={(e) => setSelfPay({ ...selfPay, phone: e.target.value })} />
                <CNICInput label="CNIC (optional)" value={selfPay.cnicOrPassport} onChange={(e) => setSelfPay({ ...selfPay, cnicOrPassport: e.target.value })} />
                <Select
                  label="Gender"
                  options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]}
                  value={selfPay.gender}
                  onChange={(e) => setSelfPay({ ...selfPay, gender: e.target.value })}
                />
                <TextInput label="Date of Birth" type="date" value={selfPay.dob} onChange={(e) => setSelfPay({ ...selfPay, dob: e.target.value })} />
                <p className="sm:col-span-2 text-[11px] text-slate-500">
                  This is a temporary, per-visit identity — no permanent Patient Registry record is created for Self-Pay.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 pt-2 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#08775A]">Appointment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Department"
              required
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
              value={departmentId}
              onChange={(e) => handleDepartmentChange(e.target.value)}
            />
            <Select
              label="Doctor"
              required
              hint="Active doctors, preferring the selected department"
              options={departmentDoctors.map((d) => ({ label: `${d.fullName} (${d.designation})`, value: d.id }))}
              value={doctorStaffId}
              onChange={(e) => setDoctorStaffId(e.target.value)}
            />
            <Select
              label="Service"
              required
              options={departmentServices.map((s) => ({ label: `${s.name} — ${formatPKR(s.standardRate)}`, value: s.id }))}
              value={serviceRateId}
              onChange={(e) => setServiceRateId(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              <TextInput label="Time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <Textarea label="Reason / Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {selectedService && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Billing Preview</h4>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Standard Service Fee</span>
              <span className="font-semibold text-slate-800">{formatPKR(grossFee)}</span>
            </div>
            {patientType === 'PANEL' && selectedPanelPatient && (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Panel Coverage</span>
                  <span className="font-semibold text-slate-800">
                    {panelPreview?.covered ? `${panelPreview.coveragePercent}% (${formatPKR(panelPreview.panelReceivable)})` : 'Not Covered'}
                  </span>
                </div>
                {panelPreview?.preauthRequired && (
                  <p className="text-[10px] text-amber-700 font-medium">⚠ Preauthorization required by panel contract.</p>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Panel Receivable</span>
                  <span className="font-semibold text-purple-700">{formatPKR(panelPreview?.panelReceivable ?? 0)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-xs pt-1.5 border-t border-slate-200">
              <span className="font-semibold text-slate-700">{patientType === 'PANEL' ? 'Patient Share' : 'Patient Payable'}</span>
              <span className="font-bold text-[#08775A]">{formatPKR(patientPayable)}</span>
            </div>
          </div>
        )}

        {!isReschedule && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <Toggle label="Collect Advance Now?" checked={collectAdvance} onChange={setCollectAdvance} />
            {collectAdvance && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumberInput
                  label="Amount"
                  required
                  min={1}
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <Select label="Payment Method" required options={PAYMENT_METHODS} value={advanceMethod} onChange={(e) => setAdvanceMethod(e.target.value as AppointmentPaymentMethod)} />
                <TextInput label="Reference (optional)" value={advanceReference} onChange={(e) => setAdvanceReference(e.target.value)} />
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};
