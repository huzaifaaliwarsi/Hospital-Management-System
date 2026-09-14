import React, { useState, useMemo } from 'react';
import { BedDouble, Search, UserPlus, CheckCircle2, AlertCircle, ShieldCheck, Wallet, RefreshCw } from 'lucide-react';
import { Patient } from '../../../types/patient';
import { getAllPatients, createPatient } from '../../../services/patientRegistryService';
import { PatientModal } from '../../superAdmin/patientRegistry/PatientModal';
import { PatientFormData } from '../../../types/patient';
import { DepartmentService } from '../../../services/departmentService';
import { StaffUserService } from '../../../services/staffUserService';
import { WardsRoomsBedsService } from '../../../services/wardsRoomsBedsService';
import { createAdmission, CreateAdmissionFormValues, AdmissionRecord, MedicationMode } from '../../../services/admissionService';
import { getHospitalCurrentDate, formatDateISO } from '../../../utils/dateConstants';
import { useAuth } from '../../../context/AuthContext';
import { Select, Textarea, NumberInput, TextInput } from '../../../components/forms/FormControls';

const emptyForm = (): CreateAdmissionFormValues => ({
  panelPatientId: '',
  selfPayEncounterId: '',
  departmentId: '',
  doctorStaffId: '',
  preferredBedId: '',
  expectedAt: formatDateISO(getHospitalCurrentDate()),
  diagnosis: '',
  estimatedAmount: '',
  medicationMode: 'SELF',
  notes: '',
});

/**
 * v7.2 §2.9 (HMS_V7.2_NEW_REQUIREMENTS.md) — "Admission begins at Front
 * Desk," the spec's #1 non-negotiable rule. This is the real, DB-backed
 * replacement for what used to be a placeholder — every dropdown here
 * reads from the same live caches the rest of the app uses (Departments,
 * Staff, Wards/Rooms/Beds, Panel Patient Registry), and submitting posts
 * straight to `POST /admission`.
 */
export const NewAdmissionView: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);

  const [formValues, setFormValues] = useState<CreateAdmissionFormValues>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createdAdmission, setCreatedAdmission] = useState<AdmissionRecord | null>(null);

  const departments = useMemo(() => DepartmentService.getDepartments().filter((d) => d.status === 'Active'), []);
  const doctors = useMemo(() => StaffUserService.getStaffUsers().filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'), []);
  const availableBeds = useMemo(() => WardsRoomsBedsService.getBeds().filter((b) => b.occupancyStatus === 'Available' && b.operationalStatus === 'Active'), []);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.trim().toLowerCase();
    return getAllPatients()
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.mrNumber.toLowerCase().includes(q) ||
          p.primaryPhone.includes(q) ||
          (p.cnic && p.cnic.includes(q))
      )
      .slice(0, 10);
  }, [searchTerm]);

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchTerm('');
    setFormValues((prev) => ({
      ...prev,
      panelPatientId: patient.payerType === 'Corporate / Panel' ? patient.id : '',
      selfPayEncounterId: patient.payerType === 'Self Pay' ? patient.id : '',
    }));
    setFormError(null);
  };

  const handleRegisterNewPatient = async (data: PatientFormData) => {
    const res = await createPatient(data, currentUser);
    if (!res.success || !res.patient) {
      setFormError(res.error || 'Failed to register patient.');
      return;
    }
    setIsPatientModalOpen(false);
    handleSelectPatient(res.patient);
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setFormValues(emptyForm());
    setCreatedAdmission(null);
    setFormError(null);
    setSearchTerm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedPatient) {
      setFormError('Search and select (or register) a patient first.');
      return;
    }
    if (!formValues.departmentId) {
      setFormError('Select the admitting department.');
      return;
    }
    if (!formValues.doctorStaffId) {
      setFormError('Select the admitting doctor.');
      return;
    }

    setIsSaving(true);
    try {
      const admission = await createAdmission(formValues);
      setCreatedAdmission(admission);
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message || err?.message || 'Failed to create admission.');
    } finally {
      setIsSaving(false);
    }
  };

  if (createdAdmission) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-in fade-in duration-150">
        <div className="bg-white rounded-xl border border-emerald-200 shadow-xs overflow-hidden">
          <div className="bg-[#effaf5] border-b border-emerald-200 p-5 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#08775A] text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Admission Created</h2>
              <p className="text-xs text-slate-600">
                Sent to Admission Portal for bed confirmation, stay management and department requests.
              </p>
            </div>
          </div>
          <div className="p-5 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Admission Number</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{createdAdmission.admissionNumber}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                <span className="font-bold text-amber-700">{createdAdmission.status}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Patient</span>
                <span className="font-semibold text-slate-900">{createdAdmission.patientName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Payer Type</span>
                <span className="font-semibold text-slate-900">{createdAdmission.payerType}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Department</span>
                <span className="font-semibold text-slate-900">{createdAdmission.departmentName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Admitting Doctor</span>
                <span className="font-semibold text-slate-900">{createdAdmission.doctorName}</span>
              </div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
              <Wallet className="h-3.5 w-3.5 inline mr-1.5" />
              Advance collection / receipt printing at Front Desk is tracked as a follow-up (HMS_V7.2_NEW_REQUIREMENTS.md §2.11)
              — not built in this pass.
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Create Another Admission
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
            <BedDouble className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">New Admission</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Admission is created here at Front Desk (v7.2) and handed off to the Admission Portal for stay management.
            </p>
          </div>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Patient selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#08775A]">1. Patient</h3>

        {selectedPatient ? (
          <div className="flex items-center justify-between p-3 bg-[#effaf5] border border-[#c2e7db] rounded-lg">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{selectedPatient.fullName}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedPatient.payerType === 'Corporate / Panel' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {selectedPatient.payerType}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                {selectedPatient.mrNumber} • {selectedPatient.primaryPhone}
                {selectedPatient.panelName && <> • {selectedPatient.panelName}</>}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPatient(null)}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, MRN, phone or CNIC…"
                className="w-full text-xs pl-8.5 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75]"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{p.fullName}</span>
                      <span className="text-slate-400 ml-2">{p.mrNumber} • {p.primaryPhone}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        p.payerType === 'Corporate / Panel' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {p.payerType}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsPatientModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#08775A] hover:underline"
            >
              <UserPlus className="h-3.5 w-3.5" /> Register New Patient (Self-Pay or Panel)
            </button>
          </>
        )}
      </div>

      {/* Admission details */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#08775A]">2. Admission Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Admitting Department"
            required
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
            value={formValues.departmentId}
            onChange={(e) => setFormValues({ ...formValues, departmentId: e.target.value })}
          />
          <Select
            label="Admitting Doctor"
            required
            options={doctors.map((d) => ({ label: `${d.fullName} (${d.designation})`, value: d.id }))}
            value={formValues.doctorStaffId}
            onChange={(e) => setFormValues({ ...formValues, doctorStaffId: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Bed Preference (optional)"
            hint="Tentative only — bed becomes occupied at Admission Portal check-in, not here."
            options={availableBeds.map((b) => ({
              label: `${b.wardName} / ${b.roomName} / Bed ${b.bedNumber}${b.departmentName ? ` (${b.departmentName})` : ''}`,
              value: b.id,
            }))}
            value={formValues.preferredBedId}
            onChange={(e) => setFormValues({ ...formValues, preferredBedId: e.target.value })}
          />
          <Select
            label="Fulfillment Mode"
            hint="Self = patient arranges own medicines. Hospital Managed = Pharmacy fulfills via requests."
            options={[
              { label: 'Self', value: 'SELF' },
              { label: 'Hospital Managed', value: 'HOSPITAL_MANAGED' },
            ]}
            value={formValues.medicationMode}
            onChange={(e) => setFormValues({ ...formValues, medicationMode: e.target.value as MedicationMode })}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput
            label="Expected Admission Date"
            type="date"
            value={formValues.expectedAt}
            onChange={(e) => setFormValues({ ...formValues, expectedAt: e.target.value })}
          />
          <NumberInput
            label="Estimated Amount (PKR, optional)"
            min={0}
            step={500}
            value={formValues.estimatedAmount}
            onChange={(e) => setFormValues({ ...formValues, estimatedAmount: e.target.value === '' ? '' : Number(e.target.value) })}
          />
        </div>
        <Textarea
          label="Diagnosis / Admission Reason (optional)"
          rows={2}
          value={formValues.diagnosis}
          onChange={(e) => setFormValues({ ...formValues, diagnosis: e.target.value })}
        />
        <Textarea
          label="Notes (optional)"
          rows={2}
          value={formValues.notes}
          onChange={(e) => setFormValues({ ...formValues, notes: e.target.value })}
        />

        {selectedPatient?.payerType === 'Corporate / Panel' && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-[11px] text-purple-900 flex items-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Panel patient — department invoices for this admission will separate Patient Share from Panel Receivable once the
              department billing split (§2.2) lands.
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60"
          >
            {isSaving ? 'Creating…' : 'Create Admission'}
          </button>
        </div>
      </form>

      <PatientModal isOpen={isPatientModalOpen} onClose={() => setIsPatientModalOpen(false)} onSave={handleRegisterNewPatient} />
    </div>
  );
};
