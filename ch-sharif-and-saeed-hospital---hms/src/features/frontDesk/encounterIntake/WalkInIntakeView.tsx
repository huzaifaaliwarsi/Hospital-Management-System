import React, { useState, useMemo, useEffect } from 'react';
import {
  Stethoscope,
  Eye,
  AlertTriangle,
  UserPlus,
  AlertCircle,
  Receipt,
  Building2,
  CheckCircle2,
  User,
  RotateCcw,
} from 'lucide-react';
import { PatientGender, PayerType, GuardianRelation, GUARDIAN_RELATIONS } from '../../../types/patient';
import {
  createPatient,
  normalizePhone,
  isValidPhone,
} from '../../../services/patientRegistryService';
import {
  fetchCorporatePanels,
  getActiveCorporatePanels,
  CorporatePanel,
} from '../../../services/panelService';
import { StaffUserService, fetchStaffUsers } from '../../../services/staffUserService';
import { StaffUser } from '../../../types/staffUser';
import {
  createEncounter,
  addServiceLine,
  EncounterType,
  InvoiceDetail,
} from '../../../services/invoiceService';
import { fetchServices } from '../../../services/serviceRatesService';
import { fetchDepartments, DepartmentService } from '../../../services/departmentService';
import { Department } from '../../../types/department';
import { HospitalService } from '../../../types/serviceRates';
import { TextInput, Select, Textarea, CNICInput } from '../../../components/forms/FormControls';
import { InvoiceDetailModal } from '../billing/InvoiceDetailModal';
import { useRouter } from '../../../context/RouterContext';
import { formatPKR } from '../../../utils/formatters';

export const WalkInIntakeView: React.FC = () => {
  const { currentPath } = useRouter();

  // Detect if user navigated from Dashboard or URL with a specific encounter type
  const queryType = useMemo<EncounterType | null>(() => {
    try {
      const searchString = currentPath.includes('?') ? currentPath.split('?')[1] : window.location.search;
      const urlParams = new URLSearchParams(searchString);
      const val = (urlParams.get('type') || urlParams.get('encounterType') || '').toUpperCase();
      if (val === 'OPD' || val === 'OBSERVATION' || val === 'EMERGENCY') {
        return val as EncounterType;
      }
      const fromStorage = sessionStorage.getItem('preferred_encounter_type');
      if (fromStorage && (fromStorage === 'OPD' || fromStorage === 'OBSERVATION' || fromStorage === 'EMERGENCY')) {
        return fromStorage as EncounterType;
      }
    } catch {
      // fallback
    }
    return null;
  }, [currentPath]);

  const [encounterType, setEncounterType] = useState<EncounterType | ''>(() => queryType || '');

  // Billing / Payer Category: New Patient (Self Pay) vs Panel Patient
  const [payerType, setPayerType] = useState<PayerType>('Self Pay');

  // Patient Registration Inline Fields (Always New Registration)
  const [fullName, setFullName] = useState('');
  const [fatherGuardianName, setFatherGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState<GuardianRelation>('Father');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<PatientGender>('Male');
  const [weight, setWeight] = useState('');
  const [cnic, setCnic] = useState('');

  // Panel Specific Fields
  const [panelId, setPanelId] = useState('');
  const [panelMemberId, setPanelMemberId] = useState('');

  // Department & Doctor selection (Department is Required)
  const [departments, setDepartments] = useState<Department[]>(() => DepartmentService.getDepartments().filter((d) => d.status === 'Active'));
  const [departmentId, setDepartmentId] = useState<string>('');
  const [doctorId, setDoctorId] = useState('');
  const [notes, setNotes] = useState('');

  // Live master data
  const [corporatePanels, setCorporatePanels] = useState<CorporatePanel[]>(getActiveCorporatePanels);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(() => StaffUserService.getStaffUsers());
  const [services, setServices] = useState<HospitalService[]>([]);

  // Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    fetchCorporatePanels().then(setCorporatePanels).catch(() => {});
    fetchStaffUsers().then(setStaffUsers).catch(() => {});
    fetchDepartments().then((depts) => {
      const active = depts.filter((d) => d.status === 'Active');
      setDepartments(active);
      if (encounterType === 'EMERGENCY') {
        const er = active.find((d) => d.code === 'ER' || d.name.toLowerCase().includes('emergency'));
        if (er) setDepartmentId(er.id);
      }
    }).catch(() => {});
    fetchServices().then(setServices).catch(() => {});
  }, []);

  useEffect(() => {
    if (queryType) {
      setEncounterType(queryType);
      sessionStorage.removeItem('preferred_encounter_type');
    }
  }, [queryType]);

  // When encounter type switches to EMERGENCY, auto-switch to ER department if available
  useEffect(() => {
    if (encounterType === 'EMERGENCY') {
      const er = departments.find((d) => d.code === 'ER' || d.name.toLowerCase().includes('emergency'));
      if (er && er.id !== departmentId) {
        setDepartmentId(er.id);
      }
    }
  }, [encounterType, departments]);

  // All active doctors across the hospital
  const allActiveDoctors = useMemo(
    () => staffUsers.filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'),
    [staffUsers]
  );

  const selectedDoctorObj = useMemo(
    () => allActiveDoctors.find((d) => d.id === doctorId),
    [allActiveDoctors, doctorId]
  );

  // Auto-fill Doctor's Department on doctor selection for ultra-fast intake
  const handleDoctorChange = (selectedDocId: string) => {
    setDoctorId(selectedDocId);
    if (selectedDocId) {
      const doc = allActiveDoctors.find((d) => d.id === selectedDocId);
      if (doc?.departmentId) {
        setDepartmentId(doc.departmentId);
      } else if (doc?.departmentName) {
        const match = departments.find(
          (dept) =>
            dept.name.toLowerCase() === doc.departmentName.toLowerCase() ||
            dept.code.toLowerCase() === doc.departmentName.toLowerCase()
        );
        if (match) {
          setDepartmentId(match.id);
        }
      }
    }
  };

  // Resolve configured default encounter service (Services & Rates)
  const defaultEncounterService = useMemo<HospitalService | null>(() => {
    if (!encounterType || !services || services.length === 0) return null;
    const active = services.filter((s) => s.status === 'Active');

    // 1. Department-specific default service for this encounterType
    const deptDefault = active.find(
      (s) => s.encounterType === encounterType && s.isDefaultEncounterService && s.departmentId === departmentId
    );
    if (deptDefault) return deptDefault;

    // 2. Global default service for this encounterType
    const globalDefault = active.find(
      (s) => s.encounterType === encounterType && s.isDefaultEncounterService
    );
    if (globalDefault) return globalDefault;

    // 3. Fallback to any active service mapped to this encounterType
    const encMatch = active.find((s) => s.encounterType === encounterType);
    if (encMatch) return encMatch;

    return null;
  }, [services, encounterType, departmentId]);

  const handleReset = () => {
    setFullName('');
    setFatherGuardianName('');
    setGuardianRelation('Father');
    setPrimaryPhone('');
    setAge('');
    setGender('Male');
    setWeight('');
    setPayerType('Self Pay');
    setPanelId('');
    setPanelMemberId('');
    setCnic('');
    setEncounterType(queryType || '');
    setDepartmentId('');
    setDoctorId('');
    setNotes('');
    setFormError(null);
    setCreatedInvoiceId(null);
  };

  const handleCreateEncounter = async () => {
    setFormError(null);

    // 0. Encounter Service Selection
    if (!encounterType) {
      setFormError('Please select an Encounter Service (e.g. OPD Consultation, Observation Care, or Emergency Triage).');
      return;
    }

    // 1. Patient Info Validation
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
      setFormError('Please enter a valid Pakistani mobile number (at least 10 digits, e.g. 0300-1234567).');
      return;
    }
    const ageNum = Number(age);
    if (!age.trim() || isNaN(ageNum) || ageNum < 0 || ageNum > 130) {
      setFormError('Please enter a valid age in years (0 - 130).');
      return;
    }

    // 2. Panel Details Validation
    if (payerType === 'Corporate / Panel') {
      if (!panelId) {
        setFormError('Please select a Corporate Panel.');
        return;
      }
      if (!panelMemberId.trim()) {
        setFormError('Panel Member ID / Card Number is required for Corporate / Panel billing.');
        return;
      }
    }

    // 3. Doctor & Department Validation (Auto-resolves department from doctor)
    if (!doctorId) {
      setFormError('Please select a Consulting Doctor.');
      return;
    }

    let effectiveDeptId = departmentId;
    if (!effectiveDeptId) {
      const doc = allActiveDoctors.find((s) => s.id === doctorId);
      if (doc?.departmentId) {
        effectiveDeptId = doc.departmentId;
        setDepartmentId(doc.departmentId);
      } else if (doc?.departmentName) {
        const match = departments.find(
          (d) =>
            d.name.toLowerCase() === doc.departmentName.toLowerCase() ||
            d.code.toLowerCase() === doc.departmentName.toLowerCase()
        );
        if (match) {
          effectiveDeptId = match.id;
          setDepartmentId(match.id);
        }
      } else if (departments.length > 0) {
        effectiveDeptId = departments[0].id;
        setDepartmentId(departments[0].id);
      }
    }

    if (!effectiveDeptId) {
      setFormError('Clinical Department could not be determined. Please ensure hospital departments exist.');
      return;
    }

    // 4. Default Encounter Service Validation (Must be configured in Services & Rates)
    if (!defaultEncounterService) {
      setFormError(`No default ${encounterType} service is configured. Please ask Admin to configure Services & Rates.`);
      return;
    }

    setIsSaving(true);
    try {
      const birthYear = new Date().getFullYear() - Math.max(0, Math.floor(ageNum));
      const dob = `${birthYear}-01-01`;
      const weightNote = weight.trim() ? `Weight: ${weight.trim()} kg` : '';
      const combinedNotes = [notes.trim(), weightNote].filter(Boolean).join(' | ');

      let targetInvoiceId = '';

      if (payerType === 'Self Pay') {
        // Direct Self Pay: Instant Encounter & Invoice shell
        const invoice: InvoiceDetail = await createEncounter({
          encounterType,
          newSelfPayPatient: {
            fullName: fullName.trim(),
            guardianName: fatherGuardianName.trim(),
            gender,
            dob,
            phone: normalizePhone(primaryPhone),
          },
          departmentId: effectiveDeptId,
          doctorStaffId: doctorId,
          notes: combinedNotes,
        });
        targetInvoiceId = invoice.id;
      } else {
        // Corporate / Panel: Register panel patient then create encounter & invoice
        const regRes = await createPatient(
          {
            fullName: fullName.trim(),
            fatherGuardianName: fatherGuardianName.trim(),
            guardianRelation,
            dateOfBirth: dob,
            age: ageNum,
            ageIsEstimated: true,
            gender,
            cnic: cnic.trim(),
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
            payerType: 'Corporate / Panel',
            panelId,
            panelName: corporatePanels.find((p) => p.id === panelId)?.name || '',
            panelMemberId: panelMemberId.trim(),
            emergencyContactName: '',
            emergencyContactRelation: '',
            emergencyContactPhone: '',
            status: 'ACTIVE',
          },
          null
        );

        if (!regRes.success || !regRes.patient) {
          setFormError(regRes.error || 'Failed to register panel patient.');
          setIsSaving(false);
          return;
        }

        const invoice = await createEncounter({
          encounterType,
          panelPatientId: regRes.patient.id,
          departmentId: effectiveDeptId,
          doctorStaffId: doctorId,
          notes: combinedNotes,
        });
        targetInvoiceId = invoice.id;
      }

      // Automatically attach Admin-configured default encounter service to invoice
      if (targetInvoiceId && defaultEncounterService) {
        try {
          await addServiceLine(targetInvoiceId, {
            serviceRateId: defaultEncounterService.id,
            quantity: 1,
            performedByStaffId: doctorId,
          });
        } catch (srvErr) {
          console.warn('Could not auto-attach encounter service line:', srvErr);
        }
      }

      setCreatedInvoiceId(targetInvoiceId);
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message || err?.message || 'Failed to create encounter & invoice.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-3.5 animate-in fade-in duration-150 pb-12">
      {/* Breadcrumb Header */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <span className="text-slate-600">Front Desk</span>
          <span className="text-slate-300">/</span>
          <span className="uppercase text-slate-500 font-semibold tracking-wide">PATIENT FLOW</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-bold">Walk-In / Encounter Intake</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border uppercase ${
            encounterType === 'OPD'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : encounterType === 'OBSERVATION'
              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
              : encounterType === 'EMERGENCY'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
        >
          {encounterType ? `${encounterType} Intake` : 'Walk-In Intake'}
        </span>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" /> {formError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        {/* 1. Patient Category Cards (New Patient vs Panel Patient) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            1. Patient Category & Billing
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* New Patient (Self Pay) Card */}
            <button
              type="button"
              onClick={() => setPayerType('Self Pay')}
              className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                payerType === 'Self Pay'
                  ? 'border-[#08775A] bg-[#effaf5] shadow-xs ring-1 ring-[#08775A]/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  payerType === 'Self Pay' ? 'bg-[#08775A] text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <UserPlus className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">New Patient</span>
                  {payerType === 'Self Pay' && (
                    <CheckCircle2 className="h-4 w-4 text-[#08775A] shrink-0" />
                  )}
                </div>
                <p className="text-[11px] font-semibold text-[#08775A] mt-0.5">Self Pay / General Walk-In</p>
                <span className="text-[10.5px] text-slate-500 block mt-0.5 leading-tight">
                  Direct patient payment via Cash or Card. Immediate invoice shell.
                </span>
              </div>
            </button>

            {/* Panel Patient Card */}
            <button
              type="button"
              onClick={() => setPayerType('Corporate / Panel')}
              className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                payerType === 'Corporate / Panel'
                  ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-1 ring-amber-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  payerType === 'Corporate / Panel' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Building2 className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">Panel Patient</span>
                  {payerType === 'Corporate / Panel' && (
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] font-semibold text-amber-800 mt-0.5">Corporate / Insurance Credit</p>
                <span className="text-[10.5px] text-slate-500 block mt-0.5 leading-tight">
                  Credit encounter backed by approved company tariff contract.
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* 4. Patient Information Form (Inline - Register New Patient is default) */}
        <div className="space-y-3.5 bg-slate-50/80 p-3.5 sm:p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-[#08775A]" /> Patient Information (New Registration)
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Instant Walk-In Entry</span>
          </div>

          {/* Full Name & Father / Guardian */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextInput
              label="Patient Full Name"
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

          {/* Contact, Age, Weight */}
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
              placeholder="e.g. 28"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            <TextInput
              label="Weight (kg) (optional)"
              type="number"
              min="1"
              max="300"
              step="0.5"
              placeholder="e.g. 68"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>

          {/* Gender */}
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
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
            <div className="pt-3 border-t border-amber-200 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Building2 className="h-3.5 w-3.5 text-amber-600" />
                <span>Panel Contract & Card Information</span>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CNICInput
                  label="CNIC (optional)"
                  placeholder="XXXXX-XXXXXXX-X"
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                />
                <Select
                  label="Guardian Relation (optional)"
                  options={GUARDIAN_RELATIONS.map((r) => ({ label: r, value: r }))}
                  value={guardianRelation}
                  onChange={(e) => setGuardianRelation(e.target.value as GuardianRelation)}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Service, Consulting Doctor & Auto Department */}
        <div className="border-t border-slate-100 pt-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              3. Service & Consulting Doctor <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-[#08775A] font-semibold bg-[#effaf5] border border-emerald-200 px-2 py-0.5 rounded">
              ⚡ Department Auto-Filled
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Encounter Service */}
            <Select
              label="Encounter Service"
              required
              options={[
                { label: '-- Select Service --', value: '' },
                { label: 'OPD Consultation', value: 'OPD' },
                { label: 'Observation Care (OBSV)', value: 'OBSERVATION' },
                { label: 'Emergency Triage (ER)', value: 'EMERGENCY' },
              ]}
              value={encounterType}
              onChange={(e) => setEncounterType(e.target.value as EncounterType | '')}
            />

            {/* 2. Consulting Doctor (User selects doctor -> department auto-fills!) */}
            <Select
              label="Consulting Doctor"
              required
              options={[
                { label: '-- Select Consulting Doctor --', value: '' },
                ...allActiveDoctors.map((d) => ({
                  label: `${d.fullName} (${d.departmentName || d.designation || 'Doctor'})`,
                  value: d.id,
                })),
              ]}
              value={doctorId}
              onChange={(e) => handleDoctorChange(e.target.value)}
            />

            {/* 3. Department (Auto-filled from doctor, can be overridden if desired) */}
            <div>
              <Select
                label="Clinical Department"
                options={[
                  { label: '-- Auto-assigned from Doctor --', value: '' },
                  ...departments.map((d) => ({
                    label: `${d.name} (${d.code})`,
                    value: d.id,
                  })),
                ]}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              />
              {selectedDoctorObj?.departmentName && (
                <span className="text-[10.5px] text-[#08775A] font-semibold mt-1 block">
                  ✓ Auto: {selectedDoctorObj.departmentName}
                </span>
              )}
            </div>
          </div>

          {/* Compact UX-Friendly Fee Preview Bar */}
          {!encounterType ? (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 animate-in fade-in">
              <Receipt className="h-4 w-4 shrink-0 text-slate-400" />
              <span>
                Please select an <strong>Encounter Service</strong> (e.g. OPD Consultation, Observation, ER) to view and calculate standard fees.
              </span>
            </div>
          ) : defaultEncounterService ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-xs animate-in fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white shrink-0 font-black text-[10px] tracking-wide">
                  FEE
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-800">{defaultEncounterService.name}</span>
                  <span className="text-[10px] font-mono bg-white border border-emerald-300 px-1.5 py-0.5 rounded text-emerald-800 font-semibold">
                    {defaultEncounterService.code}
                  </span>
                  <span className="text-[11px] text-slate-500 hidden md:inline">
                    • {defaultEncounterService.departmentName || defaultEncounterService.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {payerType === 'Self Pay' ? (
                  <>
                    <span className="text-[11px] text-slate-600 font-medium">Standard Patient Fee:</span>
                    <span className="text-sm font-black text-[#08775A]">
                      {formatPKR(defaultEncounterService.standardRate)}
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-right">
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                      Panel Credit Covered
                    </span>
                    <span className="text-[11px] text-slate-500">
                      (Base: {formatPKR(defaultEncounterService.standardRate)})
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                No default rate configured for <strong>{encounterType}</strong>. Please set a default service in{' '}
                <strong>Admin &gt; Services & Rates</strong>.
              </span>
            </div>
          )}
        </div>

        {/* 4. Notes & Clinical Vitals */}
        <div className="border-t border-slate-100 pt-3.5">
          <Textarea
            label="Notes & Clinical Vitals (optional)"
            placeholder="e.g. Presenting complaints, vitals, referral notes..."
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={handleCreateEncounter}
            disabled={isSaving || !encounterType || !defaultEncounterService}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-sm disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Receipt className="h-4 w-4" />
            {isSaving
              ? 'Creating Encounter…'
              : !encounterType
              ? 'Select Encounter Service to Proceed'
              : !defaultEncounterService
              ? `Missing ${encounterType} Service Configuration`
              : payerType === 'Self Pay'
              ? `Register & Create ${encounterType} Invoice (${formatPKR(defaultEncounterService.standardRate)})`
              : `Register Panel & Create ${encounterType} Invoice`}
          </button>
        </div>
      </div>

      {/* Immediate Invoice Detail Modal upon Creation */}
      {createdInvoiceId && (
        <InvoiceDetailModal invoiceId={createdInvoiceId} onClose={handleReset} onChanged={() => {}} />
      )}
    </div>
  );
};
