import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BedDouble,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Wallet,
  RefreshCw,
  Building2,
  DollarSign,
  User,
} from 'lucide-react';
import { PatientGender, PayerType, GuardianRelation, GUARDIAN_RELATIONS } from '../../../types/patient';
import {
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
  AdmissionAdvanceReceipt,
  AdmissionPaymentMethod,
  MedicationMode,
} from '../../../services/admissionService';
import { getHospitalCurrentDate, formatDateISO } from '../../../utils/dateConstants';
import { formatPKR } from '../../../utils/formatters';
import { useAuth } from '../../../context/AuthContext';
import { Select, Textarea, NumberInput, TextInput, CNICInput } from '../../../components/forms/FormControls';
import { focusNextField, focusNextFieldOnEnter } from '../../../utils/formNavigation';

const PAYMENT_METHODS: { label: string; value: AdmissionPaymentMethod }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'Bank Transfer', value: 'BANK' },
  { label: 'Online', value: 'ONLINE' },
];

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
  advanceAmount: '',
  paymentMethod: 'CASH',
  paymentReference: '',
});

/**
 * v7.2 §2.9 (HMS_V7.2_NEW_REQUIREMENTS.md) — "Admission begins at Front Desk".
 * Landscape 2-column intake layout: Left = Patient Demographics & Payer; Right = Clinical Booking & Bed.
 */
export const NewAdmissionView: React.FC = () => {
  const { currentUser } = useAuth();
  const formContainerRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const selectDropdownOpenRef = useRef<HTMLSelectElement | null>(null);
  const handleEnterNext = (e: React.KeyboardEvent<HTMLElement>) => focusNextFieldOnEnter(e, formContainerRef.current);

  const handleSelectKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key !== 'Enter') return;
    const el = e.currentTarget as HTMLSelectElement & { showPicker?: () => void };
    if (selectDropdownOpenRef.current === el) return;
    e.preventDefault();
    selectDropdownOpenRef.current = el;
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker();
      } else {
        el.click();
      }
    } catch {
      el.click();
    }
  };

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
  const [createdAdvanceReceipt, setCreatedAdvanceReceipt] = useState<AdmissionAdvanceReceipt | null>(null);

  // Panels cache
  const [corporatePanels, setCorporatePanels] = useState<CorporatePanel[]>(getActiveCorporatePanels);

  useEffect(() => {
    fetchCorporatePanels().then(setCorporatePanels).catch(() => {});
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

  const handleReset = () => {
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
    setFormError(null);
    setCreatedAdmission(null);
    setCreatedAdvanceReceipt(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Patient Fields Validation
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

    // 2. Admission Fields Validation
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
      // 3. Register Patient
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

      const activePatient = regRes.patient;

      // 4. Create Admission
      const admissionPayload: CreateAdmissionFormValues = {
        ...formValues,
        panelPatientId: activePatient.payerType === 'Corporate / Panel' ? activePatient.id : '',
        selfPayEncounterId: activePatient.payerType === 'Self Pay' ? activePatient.id : '',
      };
      const { admission, advanceReceipt } = await createAdmission(admissionPayload);
      setCreatedAdmission(admission);
      setCreatedAdvanceReceipt(advanceReceipt);
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
            {createdAdvanceReceipt ? (
              <div className="p-3 bg-[#effaf5] border border-emerald-200 rounded-lg text-emerald-900 flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 shrink-0" />
                  Advance collected — receipt <strong className="font-mono">{createdAdvanceReceipt.receiptNumber}</strong> ({createdAdvanceReceipt.method})
                </span>
                <span className="font-bold font-mono">{formatPKR(createdAdvanceReceipt.amount)}</span>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px]">
                No advance was collected at admission — a receipt can be recorded any time from Hospital Invoices once the stay has an invoice.
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
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
    <div ref={formContainerRef} className="w-full max-w-7xl mx-auto space-y-4 animate-in fade-in duration-150 pb-12">
      {/* Breadcrumb Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <span className="text-slate-600">Front Desk</span>
          <span className="text-slate-300">/</span>
          <span className="uppercase text-slate-500 font-semibold tracking-wide">PATIENT FLOW</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-bold">New Admission</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md text-xs font-bold border uppercase tracking-wide bg-[#effaf5] text-[#08775A] border-[#c2e7db]">
            Inpatient Admission Intake
          </span>
          <button
            type="button"
            onClick={handleReset}
            title="Reset Form"
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3 text-slate-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* Landscape Two-Column Form Grid */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Patient Category & Demographics (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          {/* 1. Patient Category Cards (Self Pay vs Panel) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              1. Patient Category &amp; Billing
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Self Pay Card */}
              <button
                type="button"
                onClick={() => setPayerType('Self Pay')}
                className={`p-3 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                  payerType === 'Self Pay'
                    ? 'border-[#08775A] bg-[#effaf5] shadow-xs ring-1 ring-[#08775A]/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    payerType === 'Self Pay' ? 'bg-[#08775A] text-white shadow-xs' : 'bg-slate-100 text-slate-500'
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

              {/* Corporate / Panel Card */}
              <button
                type="button"
                onClick={() => setPayerType('Corporate / Panel')}
                className={`p-3 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                  payerType === 'Corporate / Panel'
                    ? 'border-amber-600 bg-amber-50/70 shadow-xs ring-1 ring-amber-600/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    payerType === 'Corporate / Panel' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
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
          </div>

          {/* 2. Patient Demographics Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                2. Patient Information
              </label>
              <span className="text-[11px] text-[#08775A] font-semibold bg-[#effaf5] border border-emerald-200 px-2 py-0.5 rounded">
                Inline Registration
              </span>
            </div>

            {/* Name & Guardian */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput
                label="Full Name"
                required
                placeholder="Patient's legal name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.toUpperCase())}
                onKeyDown={handleEnterNext}
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <TextInput
                    label="Father / Guardian Name"
                    required
                    placeholder="Father / Husband / Guardian"
                    value={fatherGuardianName}
                    onChange={(e) => setFatherGuardianName(e.target.value.toUpperCase())}
                    onKeyDown={handleEnterNext}
                  />
                </div>
                <div>
                  <Select
                    label="Relation"
                    options={GUARDIAN_RELATIONS.map((r) => ({ label: r, value: r }))}
                    value={guardianRelation}
                    onChange={(e) => {
                      setGuardianRelation(e.target.value as GuardianRelation);
                      selectDropdownOpenRef.current = null;
                      if (e.target.value) {
                        focusNextField(e.currentTarget, formContainerRef.current);
                      }
                    }}
                    onKeyDown={handleSelectKeyDown}
                    onBlur={() => {
                      selectDropdownOpenRef.current = null;
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Phone, Age, CNIC */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TextInput
                label="Contact Phone"
                required
                placeholder="0300-1234567"
                value={primaryPhone}
                onChange={(e) => setPrimaryPhone(e.target.value)}
                onKeyDown={handleEnterNext}
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
                onKeyDown={handleEnterNext}
              />
              <CNICInput
                label="CNIC (optional)"
                placeholder="XXXXX-XXXXXXX-X"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                onKeyDown={handleEnterNext}
              />
            </div>

            {/* Gender Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Gender <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                {(['Male', 'Female', 'Other / Not Specified'] as PatientGender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
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

            {/* Corporate / Panel Specific Fields (Only if Panel selected) */}
            {payerType === 'Corporate / Panel' && (
              <div className="pt-3 border-t border-amber-200 space-y-3 bg-amber-50/40 p-3.5 rounded-xl border border-amber-200/80 animate-in fade-in">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Building2 className="h-3.5 w-3.5 text-amber-600" />
                  <span>Panel Contract &amp; Card Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Corporate Panel"
                    required
                    options={[
                      { label: '-- Select Corporate Panel --', value: '' },
                      ...corporatePanels.map((p) => ({ label: `${p.name} (${p.code})`, value: p.id })),
                    ]}
                    value={panelId}
                    onChange={(e) => {
                      setPanelId(e.target.value);
                      selectDropdownOpenRef.current = null;
                      if (e.target.value) {
                        focusNextField(e.currentTarget, formContainerRef.current);
                      }
                    }}
                    onKeyDown={handleSelectKeyDown}
                    onBlur={() => {
                      selectDropdownOpenRef.current = null;
                    }}
                  />
                  <TextInput
                    label="Panel Member ID / Card #"
                    required
                    placeholder="e.g. EMP-99214 / CRD-4412"
                    value={panelMemberId}
                    onChange={(e) => setPanelMemberId(e.target.value.toUpperCase())}
                    onKeyDown={handleEnterNext}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Clinical & Admission Details (5 cols on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#08775A]">
                3. Admission &amp; Ward Details
              </label>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 text-[#08775A]" /> Booking
              </span>
            </div>

            {/* Department & Doctor */}
            <div className="space-y-3">
              <Select
                label="Admitting Department"
                required
                options={[
                  { label: '-- Select Admitting Department --', value: '' },
                  ...departments.map((d) => ({ label: d.name, value: d.id })),
                ]}
                value={formValues.departmentId}
                onChange={(e) => {
                  setFormValues((prev) => ({ ...prev, departmentId: e.target.value }));
                  selectDropdownOpenRef.current = null;
                  if (e.target.value) {
                    focusNextField(e.currentTarget, formContainerRef.current);
                  }
                }}
                onKeyDown={handleSelectKeyDown}
                onBlur={() => {
                  selectDropdownOpenRef.current = null;
                }}
              />
              <Select
                label="Admitting Doctor"
                required
                options={[
                  { label: '-- Select Admitting Doctor --', value: '' },
                  ...departmentDoctors.map((d) => ({ label: `${d.fullName} (${d.designation})`, value: d.id })),
                ]}
                value={formValues.doctorStaffId}
                onChange={(e) => {
                  setFormValues((prev) => ({ ...prev, doctorStaffId: e.target.value }));
                  selectDropdownOpenRef.current = null;
                  if (e.target.value) {
                    focusNextField(e.currentTarget, formContainerRef.current);
                  }
                }}
                onKeyDown={handleSelectKeyDown}
                onBlur={() => {
                  selectDropdownOpenRef.current = null;
                }}
              />
            </div>

            {/* Bed Preference & Fulfillment */}
            <div className="space-y-3">
              <Select
                label="Bed Preference (optional)"
                hint="Tentative only — bed becomes occupied at Admission Portal check-in."
                options={[
                  { label: '-- Select Bed Preference (optional) --', value: '' },
                  ...availableBeds.map((b) => ({
                    label: `${b.wardName} / ${b.roomName} / Bed ${b.bedNumber}${b.departmentName ? ` (${b.departmentName})` : ''}`,
                    value: b.id,
                  })),
                ]}
                value={formValues.preferredBedId}
                onChange={(e) => {
                  setFormValues((prev) => ({ ...prev, preferredBedId: e.target.value }));
                  selectDropdownOpenRef.current = null;
                  if (e.target.value) {
                    focusNextField(e.currentTarget, formContainerRef.current);
                  }
                }}
                onKeyDown={handleSelectKeyDown}
                onBlur={() => {
                  selectDropdownOpenRef.current = null;
                }}
              />
              <Select
                label="Fulfillment Mode"
                hint="Self = arranges own medicines. Hospital Managed = Pharmacy fulfills via requests."
                options={[
                  { label: 'Self (Patient Arranged)', value: 'SELF' },
                  { label: 'Hospital Managed (Pharmacy)', value: 'HOSPITAL_MANAGED' },
                ]}
                value={formValues.medicationMode}
                onChange={(e) => {
                  setFormValues((prev) => ({ ...prev, medicationMode: e.target.value as MedicationMode }));
                  selectDropdownOpenRef.current = null;
                  if (e.target.value) {
                    focusNextField(e.currentTarget, formContainerRef.current);
                  }
                }}
                onKeyDown={handleSelectKeyDown}
                onBlur={() => {
                  selectDropdownOpenRef.current = null;
                }}
              />
            </div>

            {/* Expected Date & Estimated Total Cost (planning figure — never collected as cash here) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput
                label="Expected Admission Date"
                type="date"
                value={formValues.expectedAt}
                onChange={(e) => setFormValues({ ...formValues, expectedAt: e.target.value })}
                onKeyDown={handleEnterNext}
              />
              <NumberInput
                label="Estimated Total Cost (PKR, optional)"
                hint="Planning figure only — not collected as cash."
                min={0}
                step={500}
                placeholder="0"
                value={formValues.estimatedAmount}
                onChange={(e) =>
                  setFormValues({
                    ...formValues,
                    estimatedAmount: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                onKeyDown={handleEnterNext}
              />
            </div>

            {/* Advance Received Now — real money, posts a real receipt + cashier ledger entry on submit */}
            <div className="p-3.5 bg-[#effaf5] border border-[#c2e7db] rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#08775A]">
                <Wallet className="h-3.5 w-3.5" />
                <span>Advance Received Now (optional)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumberInput
                  label="Advance Amount (PKR)"
                  min={0}
                  step={500}
                  placeholder="0"
                  value={formValues.advanceAmount}
                  onChange={(e) =>
                    setFormValues({
                      ...formValues,
                      advanceAmount: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  onKeyDown={handleEnterNext}
                />
                <Select
                  label="Payment Method"
                  options={PAYMENT_METHODS}
                  value={formValues.paymentMethod}
                  onChange={(e) => {
                    setFormValues((prev) => ({ ...prev, paymentMethod: e.target.value as AdmissionPaymentMethod }));
                    selectDropdownOpenRef.current = null;
                    if (e.target.value) {
                      focusNextField(e.currentTarget, formContainerRef.current);
                    }
                  }}
                  onKeyDown={handleSelectKeyDown}
                  onBlur={() => {
                    selectDropdownOpenRef.current = null;
                  }}
                />
              </div>
              {Number(formValues.advanceAmount) > 0 && (
                <TextInput
                  label="Reference / Receipt # (optional)"
                  placeholder="e.g. Cash Receipt # / Card Auth Code"
                  value={formValues.paymentReference}
                  onChange={(e) => setFormValues({ ...formValues, paymentReference: e.target.value })}
                  onKeyDown={handleEnterNext}
                />
              )}
            </div>

            {/* Diagnosis & Notes */}
            <Textarea
              label="Diagnosis / Admission Reason"
              rows={2}
              placeholder="Primary admitting complaint or diagnosis…"
              value={formValues.diagnosis}
              onChange={(e) => setFormValues({ ...formValues, diagnosis: e.target.value.toUpperCase() })}
              onKeyDown={handleEnterNext}
            />
            <Textarea
              label="Intake Notes (optional)"
              rows={2}
              placeholder="Special instructions, allergies, dietary…"
              value={formValues.notes}
              onChange={(e) => setFormValues({ ...formValues, notes: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitButtonRef.current?.focus();
                }
              }}
            />

            {payerType === 'Corporate / Panel' && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-[11px] text-purple-900 flex items-start gap-2">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-600" />
                <span>
                  Panel admission — invoices will separate Patient Co-pay share from Panel Receivable per agreement.
                </span>
              </div>
            )}

            {/* Submit & Reset Buttons */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <button
                ref={submitButtonRef}
                type="submit"
                disabled={isSaving}
                className="w-full py-3 px-4 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <BedDouble className="h-4 w-4" />
                <span>{isSaving ? 'Creating Admission…' : 'Create Admission & Handover'}</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Reset All Fields
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
