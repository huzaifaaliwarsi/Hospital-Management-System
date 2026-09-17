import React, { useState, useMemo, useEffect } from 'react';
import {
  BedDouble,
  Search,
  UserCheck,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Wallet,
  RefreshCw,
  Building2,
  DollarSign,
  User,
} from 'lucide-react';
import { Patient, PatientGender, PayerType, GuardianRelation, GUARDIAN_RELATIONS } from '../../../types/patient';
import {
  getAllPatients,
  fetchPatients,
  createPatient,
  normalizePhone,
  isValidPhone,
  normalizeCnic,
  isValidCnic,
} from '../../../services/patientRegistryService';
import {
  fetchCorporatePanels,
  getActiveCorporatePanels,
  CorporatePanel,
} from '../../../services/panelService';
import { DepartmentService } from '../../../services/departmentService';
import { StaffUserService } from '../../../services/staffUserService';
import { WardsRoomsBedsService } from '../../../services/wardsRoomsBedsService';
import {
  createAdmission,
  CreateAdmissionFormValues,
  AdmissionRecord,
  MedicationMode,
} from '../../../services/admissionService';
import { getHospitalCurrentDate, formatDateISO } from '../../../utils/dateConstants';
import { useAuth } from '../../../context/AuthContext';
import { Select, Textarea, NumberInput, TextInput } from '../../../components/forms/FormControls';
import { PanelBadge } from '../../../components/common/PanelBadge';

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
 * v7.2 §2.9 (HMS_V7.2_NEW_REQUIREMENTS.md) — "Admission begins at Front Desk".
 * Clean inline intake: Option 1 (Existing Patient) vs Option 2 (Register New Patient)
 * with Self Pay vs Corporate / Panel selector.
 */
export const NewAdmissionView: React.FC = () => {
  const { currentUser } = useAuth();

  // Intake Mode: Existing vs New
  const [intakeMode, setIntakeMode] = useState<'EXISTING' | 'NEW'>('EXISTING');

  // Existing Patient Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // New Patient Inline Fields
  const [fullName, setFullName] = useState('');
  const [fatherGuardianName, setFatherGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState<GuardianRelation>('Father');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<PatientGender>('Male');
  const [cnic, setCnic] = useState('');
  const [payerType, setPayerType] = useState<PayerType>('Self Pay');
  const [panelId, setPanelId] = useState('');
  const [panelMemberId, setPanelMemberId] = useState('');

  // Admission form state
  const [formValues, setFormValues] = useState<CreateAdmissionFormValues>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createdAdmission, setCreatedAdmission] = useState<AdmissionRecord | null>(null);

  // Panels cache
  const [corporatePanels, setCorporatePanels] = useState<CorporatePanel[]>(getActiveCorporatePanels);

  useEffect(() => {
    fetchCorporatePanels().then(setCorporatePanels).catch(() => {});
    fetchPatients().catch(() => {});
  }, []);

  const departments = useMemo(() => DepartmentService.getDepartments().filter((d) => d.status === 'Active'), []);
  const doctors = useMemo(() => StaffUserService.getStaffUsers().filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'), []);
  const availableBeds = useMemo(() => WardsRoomsBedsService.getBeds().filter((b) => b.occupancyStatus === 'Available' && b.operationalStatus === 'Active'), []);

  // Department-filtered doctors
  const departmentDoctors = useMemo(() => {
    if (!formValues.departmentId) return doctors;
    const filtered = doctors.filter((d) => d.departmentId === formValues.departmentId);
    return filtered.length > 0 ? filtered : doctors;
  }, [doctors, formValues.departmentId]);

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

  const handleReset = () => {
    setSelectedPatient(null);
    setSearchTerm('');
    setFullName('');
    setFatherGuardianName('');
    setGuardianRelation('Father');
    setPrimaryPhone('');
    setAge('');
    setGender('Male');
    setCnic('');
    setPayerType('Self Pay');
    setPanelId('');
    setPanelMemberId('');
    setFormValues(emptyForm());
    setCreatedAdmission(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formValues.departmentId) {
      setFormError('Select the admitting department.');
      return;
    }
    if (!formValues.doctorStaffId) {
      setFormError('Select the admitting doctor.');
      return;
    }

    let activePatient = selectedPatient;

    // If Register New Patient mode is active, validate and create patient first
    if (intakeMode === 'NEW') {
      if (!fullName.trim()) {
        setFormError('Patient Full Name is required.');
        return;
      }
      if (!fatherGuardianName.trim()) {
        setFormError('Father / Guardian Name is required.');
        return;
      }
      if (!primaryPhone.trim()) {
        setFormError('Contact Phone is required.');
        return;
      }
      if (!isValidPhone(primaryPhone)) {
        setFormError('Please enter a valid phone number (at least 10 digits).');
        return;
      }
      const ageNum = Number(age);
      if (!age.trim() || isNaN(ageNum) || ageNum < 0 || ageNum > 130) {
        setFormError('Please enter a valid age in years.');
        return;
      }
      if (cnic.trim() && !isValidCnic(normalizeCnic(cnic))) {
        setFormError('CNIC must follow the Pakistani format: XXXXX-XXXXXXX-X (13 digits).');
        return;
      }
      if (payerType === 'Corporate / Panel') {
        if (!panelId) {
          setFormError('Please select a Corporate Panel.');
          return;
        }
        if (!panelMemberId.trim()) {
          setFormError('Panel Member ID / Card Number is required.');
          return;
        }
      }

      setIsSaving(true);
      try {
        const birthYear = new Date().getFullYear() - Math.max(0, Math.floor(ageNum));
        const dob = `${birthYear}-01-01`;

        const regRes = await createPatient(
          {
            fullName: fullName.trim(),
            fatherGuardianName: fatherGuardianName.trim(),
            guardianRelation,
            dateOfBirth: dob,
            age: ageNum,
            ageIsEstimated: true,
            gender,
            cnic: normalizeCnic(cnic) || '',
            passportNumber: '',
            primaryPhone: normalizePhone(primaryPhone),
            alternatePhone: '',
            email: '',
            addressLine1: '',
            addressLine2: '',
            city: 'Lahore',
            province: 'Punjab',
            country: 'Pakistan',
            bloodGroup: 'Unknown',
            payerType,
            panelId: payerType === 'Corporate / Panel' ? panelId : '',
            panelName: payerType === 'Corporate / Panel' ? corporatePanels.find((p) => p.id === panelId)?.name || '' : '',
            panelMemberId: payerType === 'Corporate / Panel' ? panelMemberId.trim() : '',
            emergencyContactName: '',
            emergencyContactRelation: '',
            emergencyContactPhone: '',
            status: 'ACTIVE',
          },
          currentUser
        );

        if (!regRes.success || !regRes.patient) {
          setFormError(regRes.error || 'Failed to register patient for admission.');
          setIsSaving(false);
          return;
        }

        activePatient = regRes.patient;
        setSelectedPatient(regRes.patient);
      } catch (err: any) {
        setFormError(err?.message || 'Failed to register patient.');
        setIsSaving(false);
        return;
      }
    }

    if (!activePatient) {
      setFormError('Please search and select an existing patient, or fill the new patient form.');
      return;
    }

    setIsSaving(true);
    try {
      const admissionPayload: CreateAdmissionFormValues = {
        ...formValues,
        panelPatientId: activePatient.payerType === 'Corporate / Panel' ? activePatient.id : '',
        selfPayEncounterId: activePatient.payerType === 'Self Pay' ? activePatient.id : '',
      };
      const admission = await createAdmission(admissionPayload);
      setCreatedAdmission(admission);
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message || err?.message || 'Failed to create admission.');
    } finally {
      setIsSaving(false);
    }
  };

  if (createdAdmission) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-in fade-in duration-150 pb-12">
        <div className="bg-white rounded-xl border border-emerald-200 shadow-xs overflow-hidden">
          <div className="bg-[#effaf5] border-b border-emerald-200 p-5 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#08775A] text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Admission Created Successfully</h2>
              <p className="text-xs text-slate-600">
                Created at Front Desk and sent to Admission Portal for bed allocation & stay management.
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
              Advance collection / deposit at Front Desk is logged with admission reference.
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs"
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
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0">
            <BedDouble className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">New Admission</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Admission begins at Front Desk (v7.2) with instant patient registration and department booking.
            </p>
          </div>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* 1. Patient Intake Mode (Option 1 vs Option 2) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            1. Patient Selection & Intake
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/90 rounded-xl">
            <button
              type="button"
              onClick={() => setIntakeMode('EXISTING')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                intakeMode === 'EXISTING'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5 text-[#08775A]" />
              <span>Option 1: Existing Patient</span>
            </button>
            <button
              type="button"
              onClick={() => setIntakeMode('NEW')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                intakeMode === 'NEW'
                  ? 'bg-white text-[#08775A] shadow-xs ring-1 ring-[#c2e7db]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5 text-[#08775A]" />
              <span>Option 2: Register New Patient</span>
            </button>
          </div>
        </div>

        {/* Option 1: Existing Patient Search */}
        {intakeMode === 'EXISTING' && (
          <div className="space-y-3 bg-slate-50/60 p-3.5 rounded-xl border border-slate-200/80">
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 bg-white border border-[#c2e7db] rounded-lg shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{selectedPatient.fullName}</span>
                      {selectedPatient.payerType === 'Corporate / Panel' ? (
                        <PanelBadge label={selectedPatient.payerType} className="px-2 py-0.5 text-[10px]" />
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {selectedPatient.payerType}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      {selectedPatient.mrNumber} • {selectedPatient.primaryPhone}
                      {selectedPatient.panelName ? ` • Panel: ${selectedPatient.panelName}` : ''}
                      {selectedPatient.age ? ` • Age: ${selectedPatient.age}y` : ''}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="text-xs font-semibold text-slate-600 hover:text-rose-600 px-2.5 py-1 bg-slate-50 hover:bg-rose-50 border border-slate-200 rounded-md transition-colors"
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search existing patient by name, MRN, phone or CNIC…"
                    className="w-full text-xs pl-8.5 pr-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#149E75]"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto shadow-sm">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPatient(p)}
                        className="w-full text-left px-3 py-2 hover:bg-emerald-50/50 text-xs flex items-center justify-between transition-colors"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{p.fullName}</span>
                          <span className="text-slate-400 ml-2">
                            {p.mrNumber} • {p.primaryPhone}
                          </span>
                        </div>
                        {p.payerType === 'Corporate / Panel' ? (
                          <PanelBadge label={p.payerType} className="text-[10px]" />
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {p.payerType}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Option 2: Register New Patient (Inline Form) */}
        {intakeMode === 'NEW' && (
          <div className="space-y-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5 text-[#08775A]" /> New Admission Patient Registration
              </span>
              <span className="text-[11px] text-slate-500">Fast inline hospital entry</span>
            </div>

            {/* Name & Guardian */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput
                label="Full Name"
                required
                placeholder="Patient's legal name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <TextInput
                label="Father / Guardian Name"
                required
                placeholder="Father / Husband / Guardian"
                value={fatherGuardianName}
                onChange={(e) => setFatherGuardianName(e.target.value)}
              />
            </div>

            {/* Phone, Age, CNIC */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TextInput
                label="Contact Phone"
                required
                placeholder="0300-1234567"
                value={primaryPhone}
                onChange={(e) => setPrimaryPhone(e.target.value)}
              />
              <TextInput
                label="Age (Years)"
                required
                type="number"
                min="0"
                max="130"
                placeholder="e.g. 35"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
              <TextInput
                label="CNIC (optional)"
                placeholder="XXXXX-XXXXXXX-X"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
              />
            </div>

            {/* Gender Pills */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gender <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                {(['Male', 'Female', 'Other / Not Specified'] as PatientGender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      gender === g
                        ? 'bg-[#08775A] text-white border-[#08775A] shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {g === 'Other / Not Specified' ? 'Other' : g}
                  </button>
                ))}
              </div>
            </div>

            {/* Billing / Payer Type Selector */}
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Billing / Payer Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPayerType('Self Pay')}
                  className={`p-3 rounded-xl border-2 text-left transition-all flex items-start gap-2.5 ${
                    payerType === 'Self Pay'
                      ? 'border-[#08775A] bg-[#effaf5] text-slate-900 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      payerType === 'Self Pay' ? 'bg-[#08775A] text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs">Self Pay (Direct Patient)</span>
                      {payerType === 'Self Pay' && <CheckCircle2 className="h-3.5 w-3.5 text-[#08775A]" />}
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Self-financed inpatient admission.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPayerType('Corporate / Panel')}
                  className={`p-3 rounded-xl border-2 text-left transition-all flex items-start gap-2.5 ${
                    payerType === 'Corporate / Panel'
                      ? 'border-amber-600 bg-amber-50/70 text-slate-900 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      payerType === 'Corporate / Panel' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs">Corporate / Panel</span>
                      {payerType === 'Corporate / Panel' && <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Company/Insurance credit guarantee admission.
                    </span>
                  </div>
                </button>
              </div>

              {/* Panel Details (Only if Corporate / Panel selected) */}
              {payerType === 'Corporate / Panel' && (
                <div className="mt-3 p-3.5 bg-white border border-amber-200 rounded-xl space-y-3 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select
                      label="Corporate Panel"
                      required
                      options={corporatePanels.map((p) => ({ label: `${p.name} (${p.code})`, value: p.id }))}
                      value={panelId}
                      onChange={(e) => setPanelId(e.target.value)}
                    />
                    <TextInput
                      label="Panel Member ID / Card #"
                      required
                      placeholder="e.g. EMP-99214 / CRD-4412"
                      value={panelMemberId}
                      onChange={(e) => setPanelMemberId(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Admission Details Form */}
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
            options={departmentDoctors.map((d) => ({ label: `${d.fullName} (${d.designation})`, value: d.id }))}
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
            label="Estimated Deposit / Amount (PKR, optional)"
            min={0}
            step={500}
            value={formValues.estimatedAmount}
            onChange={(e) =>
              setFormValues({
                ...formValues,
                estimatedAmount: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
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

        {((selectedPatient?.payerType === 'Corporate / Panel') || (intakeMode === 'NEW' && payerType === 'Corporate / Panel')) && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-[11px] text-purple-900 flex items-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Corporate / Panel admission — department invoices for this admission will separate Patient Co-pay share from Panel Receivable per corporate agreement.
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-sm disabled:opacity-60 transition-colors"
          >
            {isSaving ? 'Creating Admission…' : 'Create Admission'}
          </button>
        </div>
      </form>
    </div>
  );
};
