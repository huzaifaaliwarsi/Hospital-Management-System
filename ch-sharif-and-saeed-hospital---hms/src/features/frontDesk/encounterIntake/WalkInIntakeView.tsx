import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Plus,
  X,
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
import { TextInput, Select, Textarea, CNICInput, MultiSelect } from '../../../components/forms/FormControls';
import { InvoiceDetailModal } from '../billing/InvoiceDetailModal';
import { useRouter } from '../../../context/RouterContext';
import { formatPKR } from '../../../utils/formatters';
import { focusNextField, focusNextFieldOnEnter } from '../../../utils/formNavigation';

export const WalkInIntakeView: React.FC = () => {
  const { currentPath } = useRouter();
  const formContainerRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const doctorDropdownOpenRef = useRef(false);
  const handleEnterNext = (e: React.KeyboardEvent<HTMLElement>) => focusNextFieldOnEnter(e, formContainerRef.current);

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

  // Direct navigation (no dashboard-supplied type) starts blank so Front Desk
  // must explicitly pick OPD / Observation / Emergency from the dropdown below.
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
  const [address, setAddress] = useState('');

  // Panel Specific Fields
  const [panelId, setPanelId] = useState('');
  const [panelMemberId, setPanelMemberId] = useState('');

  // Department & Doctor selection (Department is Required)
  const [departments, setDepartments] = useState<Department[]>(() => DepartmentService.getDepartments().filter((d) => d.status === 'Active'));
  const [departmentId, setDepartmentId] = useState<string>('');
  const [doctorId, setDoctorId] = useState('');
  const [notes, setNotes] = useState('');

  // Additional billable services attached to the encounter (Emergency procedures,
  // Observation care add-ons, Lab tests, Injections, etc.) loaded live from DB.
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Live master data
  const [corporatePanels, setCorporatePanels] = useState<CorporatePanel[]>(getActiveCorporatePanels);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(() => StaffUserService.getStaffUsers());
  const [services, setServices] = useState<HospitalService[]>([]);

  // Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    fetchCorporatePanels().then(setCorporatePanels).catch(() => { });
    fetchStaffUsers().then(setStaffUsers).catch(() => { });
    fetchDepartments().then((depts) => {
      const active = depts.filter((d) => d.status === 'Active');
      setDepartments(active);
      if (encounterType === 'EMERGENCY') {
        const er = active.find((d) => d.code === 'ER' || d.name.toLowerCase().includes('emergency'));
        if (er) setDepartmentId(er.id);
      }
    }).catch(() => { });
    fetchServices().then(setServices).catch(() => { });
  }, []);

  useEffect(() => {
    if (queryType) {
      setEncounterType(queryType);
    }
  }, [queryType]);

  // Land the cursor directly in the Patient Full Name field on open, so Front
  // Desk can start typing immediately (walk-in registration is time-critical).
  useEffect(() => {
    const nameInput = formContainerRef.current?.querySelector<HTMLInputElement>('#patient-full-name');
    nameInput?.focus();
  }, []);

  // When encounter type switches to EMERGENCY and no doctor is chosen yet,
  // auto-switch to the hospital's ER department as a starting point.
  // (Once a doctor is selected, the doctor-scoped effect below takes over.)
  useEffect(() => {
    if (encounterType === 'EMERGENCY' && !doctorId) {
      const er = departments.find((d) => d.code === 'ER' || d.name.toLowerCase().includes('emergency'));
      if (er && er.id !== departmentId) {
        setDepartmentId(er.id);
      }
    }
  }, [encounterType, departments, doctorId]);

  // All active doctors across the hospital
  const allActiveDoctors = useMemo(
    () => staffUsers.filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'),
    [staffUsers]
  );

  const selectedDoctorObj = useMemo(
    () => allActiveDoctors.find((d) => d.id === doctorId),
    [allActiveDoctors, doctorId]
  );

  // Which Department flag corresponds to the currently selected Encounter Service.
  const encounterDeptFlag = useMemo<'opdEnabled' | 'observationEnabled' | 'emergencyEnabled' | null>(() => {
    if (encounterType === 'OPD') return 'opdEnabled';
    if (encounterType === 'OBSERVATION') return 'observationEnabled';
    if (encounterType === 'EMERGENCY') return 'emergencyEnabled';
    return null;
  }, [encounterType]);

  // Resolves a doctor's own assigned Department records (never the full hospital list).
  const getDoctorDepartments = (doc: StaffUser): Department[] => {
    const ids = doc.departmentIds?.length ? doc.departmentIds : doc.departmentId ? [doc.departmentId] : [];
    if (ids.length === 0) return [];
    const list = departments.filter((d) => ids.includes(d.id));
    if (doc.departmentId) {
      list.sort((a, b) => {
        if (a.id === doc.departmentId) return -1;
        if (b.id === doc.departmentId) return 1;
        return 0;
      });
    }
    return list;
  };

  const handleDoctorChange = (selectedDocId: string) => {
    setDoctorId(selectedDocId);
  };

  // Consulting Doctor dropdown gets two-step Enter behavior: a closed <select>
  // ignores Enter by default, so the first Enter press opens the native
  // options popup; arrow keys + a second Enter then pick the highlighted
  // doctor (native browser behavior once the popup is open) and onChange
  // below advances focus to the next field automatically.
  const handleDoctorSelectKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key !== 'Enter') return;
    if (doctorDropdownOpenRef.current) return;
    e.preventDefault();
    doctorDropdownOpenRef.current = true;
    const el = e.currentTarget as HTMLSelectElement & { showPicker?: () => void };
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

  // Consulting Doctor list, filtered down to doctors who have at least one
  // department that supports the currently selected Encounter Service — e.g.
  // selecting "OPD" shows only doctors who see OPD patients (a doctor who
  // sits ONLY in OPD, or a doctor who also covers ER/Observation elsewhere,
  // both qualify; a doctor with NO OPD department at all is hidden).
  // A doctor with no department data at all is kept visible — we can't tell,
  // so we don't hide them outright.
  const doctorsForEncounterType = useMemo(() => {
    if (!encounterDeptFlag) return allActiveDoctors;
    return allActiveDoctors.filter((doc) => {
      const depts = getDoctorDepartments(doc);
      if (depts.length === 0) return true;
      return depts.some((d) => d[encounterDeptFlag]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allActiveDoctors, departments, encounterDeptFlag]);

  // If the selected doctor no longer supports the (newly changed) Encounter
  // Service, clear the doctor & department so Front Desk re-picks a doctor
  // who actually sees that type of patient.
  useEffect(() => {
    if (doctorId && !doctorsForEncounterType.some((d) => d.id === doctorId)) {
      setDoctorId('');
      setDepartmentId('');
    }
  }, [doctorsForEncounterType, doctorId]);

  // Departments scoped to the selected doctor (for the Clinical Dept dropdown) —
  // only that doctor's own assigned department(s), never the full hospital list.
  // If the doctor works in more than one department (e.g. sits in both OPD &
  // ER), narrow further to the department(s) that support the currently
  // selected Encounter Service — so picking "OPD" for a doctor who works in
  // both OPD & ER resolves straight to their OPD department instead of
  // asking Front Desk to disambiguate. This applies the same way for
  // Observation and Emergency.
  const doctorScopedDepartments = useMemo(() => {
    if (!selectedDoctorObj) return departments;
    const scoped = getDoctorDepartments(selectedDoctorObj);
    if (scoped.length === 0) return departments;
    if (scoped.length > 1 && encounterDeptFlag) {
      const matchingEncounterType = scoped.filter((d) => d[encounterDeptFlag]);
      if (matchingEncounterType.length > 0) {
        matchingEncounterType.sort((a, b) => {
          if (a.id === selectedDoctorObj.departmentId) return -1;
          if (b.id === selectedDoctorObj.departmentId) return 1;
          return 0;
        });
        return matchingEncounterType;
      }
    }
    return scoped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctorObj, departments, encounterDeptFlag]);

  // Keep Clinical Department in sync with the (possibly Encounter-Service-narrowed)
  // doctor-scoped list: auto-select when only one candidate remains, otherwise
  // clear a stale selection that's no longer in scope.
  useEffect(() => {
    if (!selectedDoctorObj) return;
    if (doctorScopedDepartments.length === 1) {
      if (departmentId !== doctorScopedDepartments[0].id) {
        setDepartmentId(doctorScopedDepartments[0].id);
      }
    } else if (!doctorScopedDepartments.some((d) => d.id === departmentId)) {
      setDepartmentId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctorObj, doctorScopedDepartments]);

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

  // All active billable services in the database that Front Desk can add to the encounter
  // (Observation services, Emergency procedures, Lab tests, Injections, etc.)
  // Excludes only the base encounter service itself so the base fee is not duplicated.
  const additionalBillableServices = useMemo<HospitalService[]>(() => {
    return services.filter(
      (s) =>
        s.status === 'Active' &&
        s.id !== defaultEncounterService?.id
    );
  }, [services, defaultEncounterService]);

  const selectedAdditionalServices = useMemo(
    () => additionalBillableServices.filter((s) => selectedServiceIds.includes(s.id)),
    [additionalBillableServices, selectedServiceIds]
  );

  const selectedServicesTotal = useMemo(
    () => selectedAdditionalServices.reduce((sum, s) => sum + s.standardRate, 0),
    [selectedAdditionalServices]
  );

  // Additional services cascading selection (Department / Source -> Service)
  const [selectedServiceStream, setSelectedServiceStream] = useState<string>('HOSPITAL_SERVICES');
  const [candidateServiceId, setCandidateServiceId] = useState<string>('');

  const serviceStreamOptions = useMemo(() => {
    const list = [
      { label: '🏥 Hospital Services (Procedures / Clinical Care)', value: 'HOSPITAL_SERVICES' },
      { label: '🔬 Laboratory (LAB / Pathology) — Outsourced', value: 'LAB' },
      { label: '🩻 Radiology & Imaging (X-Ray / Ultrasound / CT) — Outsourced', value: 'RADIOLOGY' },
    ];
    departments
      .filter((d) => d.status === 'Active')
      .forEach((d) => {
        const nameLower = d.name.toLowerCase();
        if (
          nameLower.includes('hospital service') ||
          nameLower === 'hospital' ||
          nameLower === 'laboratory' ||
          nameLower === 'lab' ||
          nameLower === 'radiology' ||
          nameLower.includes('imaging')
        ) {
          return;
        }
        const tag = d.fulfillmentOwnership === 'Outsourced' ? 'Outsourced' : 'Internal';
        list.push({
          label: `${d.name} (${tag})`,
          value: d.id,
        });
      });
    return list;
  }, [departments]);

  const filteredStreamServices = useMemo(() => {
    if (selectedServiceStream === 'HOSPITAL_SERVICES') {
      return additionalBillableServices.filter(
        (s) =>
          s.serviceStream !== 'LAB' &&
          s.category !== 'Laboratory' &&
          s.category !== 'Diagnostic' &&
          s.category !== 'Radiology' &&
          !(s.departmentName || '').toLowerCase().includes('lab') &&
          !(s.departmentName || '').toLowerCase().includes('radiology') &&
          !(s.departmentName || '').toLowerCase().includes('imaging') &&
          !(s.name || '').toLowerCase().includes('x-ray') &&
          !(s.name || '').toLowerCase().includes('ultrasound') &&
          !(s.name || '').toLowerCase().includes('ct scan') &&
          !(s.name || '').toLowerCase().includes('mri')
      );
    }
    if (selectedServiceStream === 'LAB') {
      return additionalBillableServices.filter(
        (s) =>
          (s.serviceStream === 'LAB' ||
            s.category === 'Laboratory' ||
            s.category === 'Diagnostic' ||
            (s.departmentName || '').toLowerCase().includes('lab') ||
            (s.departmentName || '').toLowerCase().includes('pathology')) &&
          s.category !== 'Radiology' &&
          !(s.departmentName || '').toLowerCase().includes('radiology') &&
          !(s.departmentName || '').toLowerCase().includes('imaging') &&
          !(s.name || '').toLowerCase().includes('x-ray') &&
          !(s.name || '').toLowerCase().includes('ultrasound') &&
          !(s.name || '').toLowerCase().includes('ct scan') &&
          !(s.name || '').toLowerCase().includes('mri')
      );
    }
    if (selectedServiceStream === 'RADIOLOGY') {
      return additionalBillableServices.filter(
        (s) =>
          s.category === 'Radiology' ||
          (s.departmentName || '').toLowerCase().includes('radiology') ||
          (s.departmentName || '').toLowerCase().includes('imaging') ||
          (s.name || '').toLowerCase().includes('x-ray') ||
          (s.name || '').toLowerCase().includes('ultrasound') ||
          (s.name || '').toLowerCase().includes('ct scan') ||
          (s.name || '').toLowerCase().includes('mri')
      );
    }
    return additionalBillableServices.filter(
      (s) => s.departmentId === selectedServiceStream || s.departmentName === selectedServiceStream
    );
  }, [additionalBillableServices, selectedServiceStream]);

  const handleAddAdditionalService = () => {
    if (!candidateServiceId) return;
    if (!selectedServiceIds.includes(candidateServiceId)) {
      setSelectedServiceIds((prev) => [...prev, candidateServiceId]);
    }
    setCandidateServiceId('');
  };

  const handleRemoveAdditionalService = (idToRemove: string) => {
    setSelectedServiceIds((prev) => prev.filter((id) => id !== idToRemove));
  };

  const getServiceStreamBadge = (s: HospitalService) => {
    const isRad =
      s.category === 'Radiology' ||
      (s.departmentName || '').toLowerCase().includes('radiology') ||
      (s.departmentName || '').toLowerCase().includes('imaging') ||
      (s.name || '').toLowerCase().includes('x-ray') ||
      (s.name || '').toLowerCase().includes('ultrasound') ||
      (s.name || '').toLowerCase().includes('ct scan') ||
      (s.name || '').toLowerCase().includes('mri');
    if (isRad) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          Radiology (Outsourced)
        </span>
      );
    }
    const isLab =
      s.serviceStream === 'LAB' ||
      s.category === 'Laboratory' ||
      s.category === 'Diagnostic' ||
      (s.departmentName || '').toLowerCase().includes('lab') ||
      (s.departmentName || '').toLowerCase().includes('pathology');
    if (isLab) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          Laboratory (Outsourced)
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
        Hospital Services
      </span>
    );
  };

  // Clear selected add-on services when Encounter Service changes
  useEffect(() => {
    if (selectedServiceIds.length > 0) {
      setSelectedServiceIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterType]);

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
    setSelectedServiceIds([]);
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

      // Attach any additional services Front Desk selected (Emergency procedures,
      // Observation care add-ons, Lab tests, Injections, etc.) — each becomes its
      // own invoice line, so the amount adds directly onto the encounter invoice total.
      if (targetInvoiceId && selectedServiceIds.length > 0) {
        for (const serviceId of selectedServiceIds) {
          try {
            await addServiceLine(targetInvoiceId, {
              serviceRateId: serviceId,
              quantity: 1,
              performedByStaffId: doctorId || undefined,
            });
          } catch (srvErr) {
            console.warn('Could not attach additional service line:', srvErr);
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

  return (
    <div ref={formContainerRef} className="w-full max-w-7xl mx-auto space-y-4 animate-in fade-in duration-150 pb-12">
      {/* Breadcrumb Header */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <span className="text-slate-600">Front Desk</span>
          <span className="text-slate-300">/</span>
          <span className="uppercase text-slate-500 font-semibold tracking-wide">PATIENT FLOW</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 font-medium">Walk-In / Encounter Intake</span>
          {encounterType && (
            <>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900 font-bold">
                {encounterType === 'OPD'
                  ? 'OPD'
                  : encounterType === 'OBSERVATION'
                  ? 'Observation'
                  : 'Emergency'}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-md text-xs font-bold border uppercase tracking-wide ${encounterType === 'OPD'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : encounterType === 'OBSERVATION'
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                  : encounterType === 'EMERGENCY'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
          >
            {encounterType ? `${encounterType} Intake` : 'Walk-In Intake'}
          </span>
          <button
            type="button"
            onClick={handleReset}
            title="Reset Form"
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3 text-slate-400" />
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

      {/* Encounter Service — only shown for a direct Walk-In visit (no type
          pre-selected from the Dashboard); the Dashboard already fixes the
          service (OPD / Observation / Emergency) before landing here. */}
      {!queryType && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <Select
            label="Encounter Service"
            required
            options={[
              { label: '-- Select Encounter Service --', value: '' },
              { label: 'OPD Consultation', value: 'OPD' },
              { label: 'Observation Care', value: 'OBSERVATION' },
              { label: 'Emergency Triage', value: 'EMERGENCY' },
            ]}
            value={encounterType}
            onChange={(e) => setEncounterType(e.target.value as EncounterType | '')}
            onKeyDown={handleEnterNext}
            hint="Choose OPD, Observation, or Emergency for this walk-in patient."
          />
        </div>
      )}

      {/* Landscape Two-Column Grid: Left = Patient Demographics & Payer; Right = Service, Doctor, Fee & Submit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Patient Registration (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          {/* 1. Patient Category Cards (New Patient vs Panel Patient) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              1. Patient Category &amp; Billing
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* New Patient (Self Pay) Card */}
              <button
                type="button"
                onClick={() => setPayerType('Self Pay')}
                className={`p-3 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${payerType === 'Self Pay'
                    ? 'border-[#08775A] bg-[#effaf5] shadow-xs ring-1 ring-[#08775A]/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
              >
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${payerType === 'Self Pay' ? 'bg-[#08775A] text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                    }`}
                >
                  <UserPlus className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">New Patient</span>
                    {payerType === 'Self Pay' && (
                      <CheckCircle2 className="h-4 w-4 text-[#08775A] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-[#08775A] mt-0.5">Self Pay / General Walk-In</p>
                  <span className="text-[10px] text-slate-500 block mt-0.5 leading-tight">
                    Cash or Card. Immediate invoice shell.
                  </span>
                </div>
              </button>

              {/* Panel Patient Card */}
              <button
                type="button"
                onClick={() => setPayerType('Corporate / Panel')}
                className={`p-3 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${payerType === 'Corporate / Panel'
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-1 ring-amber-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
              >
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${payerType === 'Corporate / Panel' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                    }`}
                >
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">Panel Patient</span>
                    {payerType === 'Corporate / Panel' && (
                      <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-amber-800 mt-0.5">Corporate / Insurance</p>
                  <span className="text-[10px] text-slate-500 block mt-0.5 leading-tight">
                    Credit encounter backed by company tariff.
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Patient Demographics & Information Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[#08775A]" /> 2. Patient Information (New Registration)
              </span>
              <span className="text-[10.5px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded">
                Instant Walk-In Entry
              </span>
            </div>

            {/* Full Name & Father / Guardian */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput
                label="Patient Full Name"
                required
                placeholder="Patient's legal name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.toUpperCase())}
                onKeyDown={handleEnterNext}
              />
              <TextInput
                label="Father / Guardian Name"
                required
                placeholder="Father / Husband / Guardian"
                value={fatherGuardianName}
                onChange={(e) => setFatherGuardianName(e.target.value.toUpperCase())}
                onKeyDown={handleEnterNext}
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
                onKeyDown={handleEnterNext}
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
                onKeyDown={handleEnterNext}
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
                onKeyDown={handleEnterNext}
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
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${gender === g
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
              <div className="pt-3 border-t border-amber-200 space-y-3 bg-amber-50/40 p-3 rounded-lg animate-in fade-in">
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
                    onChange={(e) => setPanelId(e.target.value)}
                    onKeyDown={handleEnterNext}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CNICInput
                    label="CNIC (optional)"
                    placeholder="XXXXX-XXXXXXX-X"
                    value={cnic}
                    onChange={(e) => setCnic(e.target.value)}
                    onKeyDown={handleEnterNext}
                  />
                  <Select
                    label="Guardian Relation (optional)"
                    options={GUARDIAN_RELATIONS.map((r) => ({ label: r, value: r }))}
                    value={guardianRelation}
                    onChange={(e) => setGuardianRelation(e.target.value as GuardianRelation)}
                    onKeyDown={handleEnterNext}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Doctor, Fee Summary & Submit (5 cols on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 3. Consulting Doctor Assignment (Service fixed, Department auto-resolved) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3 shrink-0">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                3. Consulting Doctor <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10.5px] text-[#08775A] font-semibold bg-[#effaf5] border border-emerald-200 px-2 py-0.5 rounded">
                {encounterType === 'OPD'
                  ? 'OPD Consultation'
                  : encounterType === 'OBSERVATION'
                  ? 'Observation Care'
                  : encounterType === 'EMERGENCY'
                  ? 'Emergency Triage'
                  : 'Encounter'}
              </span>
            </div>

            {/* Consulting Doctor Dropdown ONLY */}
            <Select
              label="Consulting Doctor"
              required
              options={[
                { label: '-- Select Consulting Doctor --', value: '' },
                ...doctorsForEncounterType.map((d) => ({
                  label: `${d.fullName} (${d.departmentName || d.designation || 'Doctor'})`,
                  value: d.id,
                })),
              ]}
              value={doctorId}
              onChange={(e) => {
                handleDoctorChange(e.target.value);
                doctorDropdownOpenRef.current = false;
                if (e.target.value) {
                  focusNextField(e.currentTarget, formContainerRef.current);
                }
              }}
              onKeyDown={handleDoctorSelectKeyDown}
              onBlur={() => {
                doctorDropdownOpenRef.current = false;
              }}
            />

            {selectedDoctorObj ? (
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <span>Clinical Department:</span>
                <span className="font-bold text-[#08775A] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ {departments.find((d) => d.id === departmentId)?.name || doctorScopedDepartments[0]?.name || selectedDoctorObj.departmentName || 'General'}
                </span>
              </div>
            ) : (
              <span className="text-[10.5px] text-slate-400 block">
                Showing doctors authorized for {encounterType || 'this service'}
              </span>
            )}
          </div>

          {/* 3b. Additional Services / Procedures Selection (OBSERVATION, EMERGENCY, OPD) */}
          {encounterType && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#08775A] flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    {encounterType === 'OBSERVATION'
                      ? 'Observation Services & Investigations'
                      : encounterType === 'EMERGENCY'
                      ? 'Emergency Services, Procedures & Investigations'
                      : 'Additional Services / Tests'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select source (Hospital Services, Outsourced Lab, Radiology) and add required services
                  </p>
                </div>
                {selectedAdditionalServices.length > 0 && (
                  <span className="text-xs font-bold text-[#08775A] bg-[#effaf5] px-2.5 py-1 rounded-lg border border-[#c2e7db]">
                    {selectedAdditionalServices.length} Selected • {formatPKR(selectedServicesTotal)}
                  </span>
                )}
              </div>

              {/* 2-Level Cascading Selector: Stream/Source -> Specific Service */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* 1. Category / Source */}
                <div className="sm:col-span-5">
                  <Select
                    label="1. Service Category / Source"
                    options={serviceStreamOptions}
                    value={selectedServiceStream}
                    onChange={(e) => {
                      setSelectedServiceStream(e.target.value);
                      setCandidateServiceId('');
                    }}
                    hint={
                      selectedServiceStream === 'HOSPITAL_SERVICES'
                        ? 'Internal hospital procedures, clinical care & nursing'
                        : selectedServiceStream === 'LAB'
                        ? 'Outsourced Laboratory & Pathology tests'
                        : selectedServiceStream === 'RADIOLOGY'
                        ? 'Outsourced X-Ray, Ultrasound, & Imaging'
                        : 'Departmental clinical services'
                    }
                  />
                </div>

                {/* 2. Specific Service Dropdown */}
                <div className="sm:col-span-5">
                  <Select
                    label="2. Service / Procedure / Test"
                    placeholder={
                      filteredStreamServices.length === 0
                        ? 'No services available in this category'
                        : 'Choose a service to add…'
                    }
                    options={filteredStreamServices.map((s) => ({
                      label: `${s.name} (${s.code}) — ${formatPKR(s.standardRate)}`,
                      value: s.id,
                    }))}
                    value={candidateServiceId}
                    onChange={(e) => setCandidateServiceId(e.target.value)}
                    hint={
                      candidateServiceId
                        ? `Standard Rate: ${formatPKR(filteredStreamServices.find((s) => s.id === candidateServiceId)?.standardRate ?? 0)}`
                        : 'Select service then click Add'
                    }
                  />
                </div>

                {/* Add Service Button */}
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddAdditionalService}
                    disabled={!candidateServiceId}
                    className="w-full py-2 px-3 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Added Services Table / List */}
              {selectedAdditionalServices.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 mt-2">
                  <div className="px-3 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <span>Selected Services ({selectedAdditionalServices.length})</span>
                    <button
                      type="button"
                      onClick={() => setSelectedServiceIds([])}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold lowercase"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="divide-y divide-slate-200 max-h-56 overflow-y-auto">
                    {selectedAdditionalServices.map((s) => (
                      <div
                        key={s.id}
                        className="px-3 py-2.5 flex items-center justify-between bg-white hover:bg-slate-50/80 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {getServiceStreamBadge(s)}
                          <div>
                            <span className="font-semibold text-slate-800">{s.name}</span>
                            <span className="font-mono text-[11px] text-slate-400 ml-1.5">({s.code})</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900">{formatPKR(s.standardRate)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAdditionalService(s.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                            title="Remove Service"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  No additional services added yet. Select category &amp; service above, then click <strong>Add</strong>.
                </div>
              )}
            </div>
          )}

          {/* 4. Billing & Standard Fee Summary Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-[#08775A]" /> Billing Summary
              </span>
              {defaultEncounterService && (
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {defaultEncounterService.code}
                </span>
              )}
            </div>

            {!encounterType ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                <Receipt className="h-4 w-4 shrink-0 text-slate-400" />
                <span>Select an Encounter Service above to calculate standard rates.</span>
              </div>
            ) : defaultEncounterService ? (
              <div className="p-3.5 rounded-xl bg-[#effaf5] border border-[#c2e7db] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-xs text-slate-900">{defaultEncounterService.name}</div>
                    <div className="text-[10.5px] text-slate-500 mt-0.5">
                      {defaultEncounterService.departmentName || defaultEncounterService.category || 'Clinical Encounter'}
                    </div>
                  </div>
                  <div className="text-right">
                    {payerType === 'Self Pay' ? (
                      <div>
                        <div className="text-lg font-black text-[#08775A]">
                          {formatPKR(defaultEncounterService.standardRate)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">Standard Patient Fee</div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 inline-block">
                          Panel Credit
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Base: {formatPKR(defaultEncounterService.standardRate)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedAdditionalServices.length > 0 && (
                  <div className="pt-2 border-t border-emerald-200/70 space-y-1">
                    {selectedAdditionalServices.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>{s.name}</span>
                        <span className="font-semibold">{formatPKR(s.standardRate)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1.5 border-t border-emerald-200/70 text-xs">
                      <span className="font-bold text-slate-800">
                        Total {payerType === 'Self Pay' ? 'Patient Fee' : 'Billable'}
                      </span>
                      <span className="font-black text-[#08775A]">
                        {formatPKR(defaultEncounterService.standardRate + selectedServicesTotal)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  No default rate configured for <strong>{encounterType}</strong> in Services &amp; Rates.
                </span>
              </div>
            )}
          </div>

          {/* 5. Notes & Clinical Vitals */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="intake-notes-textarea" className="text-xs font-semibold text-slate-700">
                Notes &amp; Clinical Vitals (optional)
              </label>
              <button
                type="button"
                onClick={() => {
                  submitButtonRef.current?.focus();
                  submitButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#08775A] hover:text-[#065f46] hover:underline cursor-pointer"
                title="Click or press Enter in notes to jump straight to Register button"
              >
                <span>Jump to Register Button ➔</span>
              </button>
            </div>
            <textarea
              id="intake-notes-textarea"
              rows={2}
              placeholder="e.g. Presenting complaints, BP, pulse, referral notes... (Press Enter to jump to Register button)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitButtonRef.current?.focus();
                  submitButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
              }}
              className="w-full rounded-lg border bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70] border-slate-300"
            />
            <div className="flex items-center justify-between text-[10.5px] text-slate-400 px-0.5">
              <span>Press <strong className="font-semibold text-slate-600">Enter</strong> to jump straight to Register button</span>
              <span>Shift+Enter for multi-line</span>
            </div>
          </div>

          {/* 6. Action Submit Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2.5">
            <button
              ref={submitButtonRef}
              id="btn-register-encounter"
              type="button"
              onClick={handleCreateEncounter}
              disabled={isSaving || !encounterType || !defaultEncounterService}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] focus:bg-[#065f46] focus:ring-4 focus:ring-[#08775A]/40 focus:outline-none rounded-xl shadow-sm disabled:opacity-60 transition-all cursor-pointer"
            >
              <Receipt className="h-4 w-4" />
              {isSaving
                ? 'Creating Encounter…'
                : !encounterType
                  ? 'Select Encounter Service to Proceed'
                  : !defaultEncounterService
                    ? `Missing ${encounterType} Service Configuration`
                    : payerType === 'Self Pay'
                      ? `Register & Create ${encounterType} Invoice (${formatPKR(defaultEncounterService.standardRate + selectedServicesTotal)})`
                      : `Register Panel & Create ${encounterType} Invoice`}
            </button>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>⚡ Fast-billing front desk</span>
              <span>Press Enter to register</span>
            </div>
          </div>
        </div>
      </div>

      {/* Immediate Invoice Detail Modal upon Creation */}
      {createdInvoiceId && (
        <InvoiceDetailModal invoiceId={createdInvoiceId} onClose={handleReset} onChanged={() => { }} autoOpenPayment />
      )}
    </div>
  );
};
