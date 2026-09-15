import React, { useState, useMemo, useEffect } from 'react';
import {
  Stethoscope,
  Eye,
  AlertTriangle,
  Search,
  UserCheck,
  UserPlus,
  AlertCircle,
  Receipt,
  Building2,
  CheckCircle2,
  DollarSign,
  User,
  Plus,
  Trash2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Patient, PatientGender, PayerType, GuardianRelation, GUARDIAN_RELATIONS } from '../../../types/patient';
import {
  getAllPatients,
  fetchPatients,
  createPatient,
  normalizePhone,
  isValidPhone,
} from '../../../services/patientRegistryService';
import {
  fetchCorporatePanels,
  getActiveCorporatePanels,
  CorporatePanel,
} from '../../../services/panelService';
import { DepartmentService } from '../../../services/departmentService';
import { StaffUserService } from '../../../services/staffUserService';
import {
  createEncounter,
  EncounterType,
  InvoiceDetail,
  addServiceLine,
} from '../../../services/invoiceService';
import {
  ServiceRatesService,
  fetchServices,
} from '../../../services/serviceRatesService';
import { HospitalService } from '../../../types/serviceRates';
import { TextInput, Select, Textarea } from '../../../components/forms/FormControls';
import { InvoiceDetailModal } from '../billing/InvoiceDetailModal';
import { formatPKR } from '../../../utils/formatters';

function resolveInitialEncounterType(): EncounterType {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('type') || urlParams.get('encounterType');
    const fromStorage = sessionStorage.getItem('preferred_encounter_type');
    const candidate = (fromUrl || fromStorage || '').toUpperCase();
    if (candidate === 'OPD' || candidate === 'OBSERVATION' || candidate === 'EMERGENCY') {
      sessionStorage.removeItem('preferred_encounter_type');
      return candidate as EncounterType;
    }
  }
  return 'OPD';
}

export interface SelectedServiceLine {
  serviceId: string;
  quantity: number;
}

export const WalkInIntakeView: React.FC = () => {
  const [encounterType, setEncounterType] = useState<EncounterType>(resolveInitialEncounterType);

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
  const [weight, setWeight] = useState('');
  const [payerType, setPayerType] = useState<PayerType>('Self Pay');
  const [panelId, setPanelId] = useState('');
  const [panelMemberId, setPanelMemberId] = useState('');
  const [cnic, setCnic] = useState('');

  // Department / Doctor / Notes
  const [departmentId, setDepartmentId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [notes, setNotes] = useState('');

  // Live master caches
  const [corporatePanels, setCorporatePanels] = useState<CorporatePanel[]>(getActiveCorporatePanels);
  const [allServices, setAllServices] = useState<HospitalService[]>(ServiceRatesService.getServices);

  // Selected Services for this intake
  const [selectedServices, setSelectedServices] = useState<SelectedServiceLine[]>([]);
  const [servicePickerId, setServicePickerId] = useState('');

  // Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    fetchCorporatePanels().then(setCorporatePanels).catch(() => {});
    fetchPatients().catch(() => {});
    fetchServices().then(setAllServices).catch(() => {});
  }, []);

  useEffect(() => {
    const candidate = resolveInitialEncounterType();
    if (candidate) {
      setEncounterType(candidate);
    }
  }, []);

  const departments = useMemo(() => DepartmentService.getDepartments().filter((d) => d.status === 'Active'), []);
  const doctors = useMemo(
    () => StaffUserService.getStaffUsers().filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'),
    []
  );

  // Department-filtered doctors
  const departmentDoctors = useMemo(() => {
    if (!departmentId) return doctors;
    const deptDocs = doctors.filter((d) => d.departmentId === departmentId);
    return deptDocs.length > 0 ? deptDocs : doctors;
  }, [doctors, departmentId]);

  // Department-filtered services (configured by Super Admin)
  const availableServices = useMemo(() => {
    const active = allServices.filter((s) => s.status === 'Active');
    if (!departmentId) return active;
    const filtered = active.filter((s) => s.departmentId === departmentId);
    return filtered.length > 0 ? filtered : active;
  }, [allServices, departmentId]);

  const selectedDepartmentObj = useMemo(() => {
    return departments.find((d) => d.id === departmentId);
  }, [departments, departmentId]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.trim().toLowerCase();
    return getAllPatients()
      .filter((p) => p.fullName.toLowerCase().includes(q) || p.mrNumber.toLowerCase().includes(q) || p.primaryPhone.includes(q))
      .slice(0, 10);
  }, [searchTerm]);

  const handleAddService = (srvId: string) => {
    if (!srvId) return;
    setSelectedServices((prev) => {
      const existing = prev.find((item) => item.serviceId === srvId);
      if (existing) {
        return prev.map((item) => (item.serviceId === srvId ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...prev, { serviceId: srvId, quantity: 1 }];
    });
    setServicePickerId('');
  };

  const handleUpdateQuantity = (srvId: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveService(srvId);
      return;
    }
    setSelectedServices((prev) =>
      prev.map((item) => (item.serviceId === srvId ? { ...item, quantity: qty } : item))
    );
  };

  const handleRemoveService = (srvId: string) => {
    setSelectedServices((prev) => prev.filter((item) => item.serviceId !== srvId));
  };

  // Estimated Subtotal
  const estimatedTotal = useMemo(() => {
    return selectedServices.reduce((acc, item) => {
      const srv = allServices.find((s) => s.id === item.serviceId);
      return acc + (srv?.standardRate || 0) * item.quantity;
    }, 0);
  }, [selectedServices, allServices]);

  const handleReset = () => {
    setSelectedPatient(null);
    setSearchTerm('');
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
    setDepartmentId('');
    setDoctorId('');
    setNotes('');
    setSelectedServices([]);
    setServicePickerId('');
    setFormError(null);
    setCreatedInvoiceId(null);
  };

  const handleCreateEncounter = async () => {
    setFormError(null);

    // 1. Existing Patient Validation
    if (intakeMode === 'EXISTING') {
      if (!selectedPatient) {
        setFormError('Please search and select an existing patient first, or choose "Register New Patient".');
        return;
      }

      setIsSaving(true);
      try {
        const invoice: InvoiceDetail = await createEncounter({
          encounterType,
          panelPatientId: selectedPatient.payerType === 'Corporate / Panel' ? selectedPatient.id : '',
          selfPayEncounterId: selectedPatient.payerType === 'Self Pay' ? selectedPatient.id : '',
          departmentId,
          doctorStaffId: doctorId,
          notes,
        });

        // Attach department services directly to invoice
        if (selectedServices.length > 0) {
          for (const srvItem of selectedServices) {
            try {
              await addServiceLine(invoice.id, {
                serviceRateId: srvItem.serviceId,
                quantity: srvItem.quantity,
                performedByStaffId: doctorId || undefined,
              });
            } catch (lineErr) {
              console.warn('Failed to add line item:', lineErr);
            }
          }
        }

        setCreatedInvoiceId(invoice.id);
      } catch (err: any) {
        setFormError(err?.response?.data?.error?.message || err?.message || 'Failed to create encounter.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // 2. New Patient Inline Validation
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

    setIsSaving(true);
    try {
      const birthYear = new Date().getFullYear() - Math.max(0, Math.floor(ageNum));
      const dob = `${birthYear}-01-01`;
      const weightNote = weight.trim() ? `Weight: ${weight.trim()} kg` : '';
      const combinedNotes = [notes.trim(), weightNote].filter(Boolean).join(' | ');

      let targetInvoiceId = '';

      if (payerType === 'Self Pay') {
        // Direct Self Pay: Instant Encounter & Invoice
        const invoice = await createEncounter({
          encounterType,
          newSelfPayPatient: {
            fullName: fullName.trim(),
            guardianName: fatherGuardianName.trim(),
            gender,
            dob,
            phone: normalizePhone(primaryPhone),
          },
          departmentId,
          doctorStaffId: doctorId,
          notes: combinedNotes,
        });
        targetInvoiceId = invoice.id;
        await fetchPatients().catch(() => {});
      } else {
        // Corporate / Panel: Register panel patient then create encounter
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
          departmentId,
          doctorStaffId: doctorId,
          notes: combinedNotes,
        });
        targetInvoiceId = invoice.id;
      }

      // Attach selected department services to invoice
      if (targetInvoiceId && selectedServices.length > 0) {
        for (const srvItem of selectedServices) {
          try {
            await addServiceLine(targetInvoiceId, {
              serviceRateId: srvItem.serviceId,
              quantity: srvItem.quantity,
              performedByStaffId: doctorId || undefined,
            });
          } catch (lineErr) {
            console.warn('Failed to add line item:', lineErr);
          }
        }
      }

      setCreatedInvoiceId(targetInvoiceId);
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message || err?.message || 'Failed to create encounter & invoice.');
    } finally {
      setIsSaving(false);
    }
  };

  const ENCOUNTER_OPTIONS: Array<{
    type: EncounterType;
    label: string;
    sub: string;
    icon: typeof Stethoscope;
    activeBorder: string;
    activeBg: string;
    activeText: string;
  }> = [
    {
      type: 'OPD',
      label: 'OPD',
      sub: 'Outpatient Clinic',
      icon: Stethoscope,
      activeBorder: 'border-emerald-600 bg-emerald-50/60 text-emerald-900',
      activeText: 'text-emerald-700',
      activeBg: 'bg-emerald-600 text-white',
    },
    {
      type: 'OBSERVATION',
      label: 'OBSV',
      sub: 'Day Care & Observation',
      icon: Eye,
      activeBorder: 'border-indigo-600 bg-indigo-50/60 text-indigo-900',
      activeText: 'text-indigo-700',
      activeBg: 'bg-indigo-600 text-white',
    },
    {
      type: 'EMERGENCY',
      label: 'ER',
      sub: 'Immediate Emergency',
      icon: AlertTriangle,
      activeBorder: 'border-rose-600 bg-rose-50/60 text-rose-900',
      activeText: 'text-rose-700',
      activeBg: 'bg-rose-600 text-white',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in duration-150 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Walk-In / Encounter Intake</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Quick encounter intake for OPD, Observation, and Emergency patients with instant invoice generation.
            </p>
          </div>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" /> {formError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-5">
        {/* 1. Encounter Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            1. Select Encounter Type
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {ENCOUNTER_OPTIONS.map((opt) => {
              const isSelected = encounterType === opt.type;
              const Icon = opt.icon;
              return (
                <button
                  type="button"
                  key={opt.type}
                  onClick={() => setEncounterType(opt.type)}
                  className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? `${opt.activeBorder} shadow-xs ring-1 ring-offset-1 ring-slate-400`
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-sm tracking-wide">{opt.label}</span>
                    <div
                      className={`h-6 w-6 rounded-md flex items-center justify-center ${
                        isSelected ? opt.activeBg : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 line-clamp-1">{opt.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Patient Intake Mode Switcher (Option 1 vs Option 2) */}
        <div className="border-t border-slate-100 pt-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            2. Patient Selection & Intake
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
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                          selectedPatient.payerType === 'Corporate / Panel'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {selectedPatient.payerType}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      {selectedPatient.mrNumber} • {selectedPatient.primaryPhone}
                      {selectedPatient.fatherGuardianName ? ` • Guardian: ${selectedPatient.fatherGuardianName}` : ''}
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
                    placeholder="Search existing patient by name, MRN or phone…"
                    className="w-full text-xs pl-8.5 pr-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#149E75]"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto shadow-sm">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setSearchTerm('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-emerald-50/50 text-xs flex items-center justify-between transition-colors"
                      >
                        <span>
                          <span className="font-semibold text-slate-900">{p.fullName}</span>{' '}
                          <span className="text-slate-400 ml-2">
                            {p.mrNumber} • {p.primaryPhone}
                          </span>
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            p.payerType === 'Corporate / Panel'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p.payerType}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Option 2: Register New Patient Form (Inline Directly Below) */}
        {intakeMode === 'NEW' && (
          <div className="space-y-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5 text-[#08775A]" /> Quick Patient Information
              </span>
              <span className="text-[11px] text-slate-500">Fast 10-second walk-in entry</span>
            </div>

            {/* Basic Info: Name & Guardian */}
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

            {/* Gender Quick Selector */}
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

            {/* Billing / Payer Type Toggle */}
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
                      <span className="font-bold text-xs">Self Pay (Cash / Card)</span>
                      {payerType === 'Self Pay' && <CheckCircle2 className="h-3.5 w-3.5 text-[#08775A]" />}
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Direct patient payment. Generates invoice immediately.
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
                      Company or insurance credit. Tariff & discount rules applied.
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TextInput
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
          </div>
        )}

        {/* 3. Department & Doctor */}
        <div className="border-t border-slate-100 pt-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            3. Department & Consulting Doctor
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Department"
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setServicePickerId('');
              }}
            />
            <Select
              label="Consulting Doctor"
              options={departmentDoctors.map((d) => ({ label: d.fullName, value: d.id }))}
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            />
          </div>
        </div>

        {/* 4. Billable Services (Department-Wise from Super Admin) */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                4. Billable Services (Department-Wise)
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {selectedDepartmentObj
                  ? `Showing services configured by Super Admin for ${selectedDepartmentObj.name}`
                  : 'Select a department above, or choose from active hospital services'}
              </p>
            </div>
            {selectedServices.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                {selectedServices.length} Selected • {formatPKR(estimatedTotal)}
              </span>
            )}
          </div>

          {/* Quick Service Picker Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                label=""
                options={[
                  { label: '-- Select service to add --', value: '' },
                  ...availableServices.map((s) => ({
                    label: `${s.name} (${s.code}) — ${formatPKR(s.standardRate)} [${s.category}]`,
                    value: s.id,
                  })),
                ]}
                value={servicePickerId}
                onChange={(e) => {
                  const val = e.target.value;
                  setServicePickerId(val);
                  if (val) handleAddService(val);
                }}
              />
            </div>
          </div>

          {/* Quick-Pick Service Pills for the selected department */}
          {availableServices.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {availableServices.slice(0, 6).map((srv) => {
                const isAdded = selectedServices.some((s) => s.serviceId === srv.id);
                return (
                  <button
                    type="button"
                    key={srv.id}
                    onClick={() => handleAddService(srv.id)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors ${
                      isAdded
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-[#08775A] hover:bg-slate-50'
                    }`}
                  >
                    <Plus className="h-3 w-3 text-[#08775A]" />
                    <span>{srv.name}</span>
                    <span className="text-slate-400">({formatPKR(srv.standardRate)})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected Services Table / List */}
          {selectedServices.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-xs">
              {selectedServices.map((item) => {
                const srv = allServices.find((s) => s.id === item.serviceId);
                const lineTotal = (srv?.standardRate || 0) * item.quantity;
                return (
                  <div key={item.serviceId} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/60">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-slate-900 truncate">{srv?.name || 'Service'}</div>
                      <div className="text-[11px] text-slate-500">
                        {srv?.code} • {srv?.departmentName || 'General'} • {formatPKR(srv?.standardRate || 0)} each
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.serviceId, item.quantity - 1)}
                          className="px-2 py-0.5 text-slate-600 hover:text-slate-900 font-bold"
                        >
                          -
                        </button>
                        <span className="px-2 font-bold text-slate-900 min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.serviceId, item.quantity + 1)}
                          className="px-2 py-0.5 text-slate-600 hover:text-slate-900 font-bold"
                        >
                          +
                        </button>
                      </div>

                      {/* Line Total */}
                      <span className="font-bold text-slate-900 w-24 text-right">
                        {formatPKR(lineTotal)}
                      </span>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => handleRemoveService(item.serviceId)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                        title="Remove service"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Subtotal Banner */}
              <div className="p-3 bg-slate-50/80 flex items-center justify-between border-t border-slate-200">
                <span className="text-xs font-bold text-slate-700">Estimated Services Subtotal:</span>
                <span className="text-sm font-extrabold text-[#08775A]">{formatPKR(estimatedTotal)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-3 px-4 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
              No services attached yet. Pick from the dropdown or quick buttons above.
            </div>
          )}
        </div>

        {/* 5. Notes & Vitals */}
        <div className="border-t border-slate-100 pt-4">
          <Textarea
            label="Notes & Clinical Vitals (optional)"
            placeholder="e.g. Presenting symptoms, vitals, referral notes..."
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
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleCreateEncounter}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-sm disabled:opacity-60 transition-colors"
          >
            <Receipt className="h-4 w-4" />
            {isSaving
              ? 'Creating Encounter…'
              : intakeMode === 'NEW'
              ? payerType === 'Self Pay'
                ? `Register & Create ${encounterType} Invoice`
                : `Register Panel & Create ${encounterType} Invoice`
              : `Create ${encounterType} Encounter & Open Invoice`}
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
