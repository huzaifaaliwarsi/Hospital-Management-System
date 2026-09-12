import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  MapPin,
  Building,
  HeartHandshake,
  AlertTriangle,
  AlertCircle,
  Search,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  Patient,
  PatientFormData,
  PatientGender,
  PayerType,
  BloodGroup,
  GuardianRelation,
  PATIENT_GENDERS,
  PAYER_TYPES,
  BLOOD_GROUPS,
  GUARDIAN_RELATIONS,
  DuplicateCheckResult,
} from '../../../types/patient';
import {
  calculateAgeFromDob,
  normalizeCnic,
  isValidCnic,
  isValidPhone,
  checkDuplicates,
  generateNextMrNumber,
  getAllPatients,
} from '../../../services/patientRegistryService';
import { getActiveCorporatePanels } from '../../../services/panelService';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PatientFormData) => void;
  patientToEdit?: Patient | null;
  onOpenExistingPatient?: (patient: Patient) => void;
}

export const PatientModal: React.FC<PatientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  patientToEdit,
  onOpenExistingPatient,
}) => {
  const isEditMode = Boolean(patientToEdit);
  const activePanels = getActiveCorporatePanels();

  // Quick lookup search for existing patient
  const [quickSearchTerm, setQuickSearchTerm] = useState('');
  const [quickSearchResults, setQuickSearchResults] = useState<Patient[]>([]);

  // Projected MR for display
  const [previewMrNumber, setPreviewMrNumber] = useState('');

  // Form State
  const [formData, setFormData] = useState<PatientFormData>({
    fullName: '',
    fatherGuardianName: '',
    guardianRelation: 'Father',
    dateOfBirth: '',
    age: '',
    ageIsEstimated: false,
    gender: 'Male',
    cnic: '',
    passportNumber: '',
    primaryPhone: '',
    alternatePhone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'Unknown',
    payerType: 'Self Pay',
    panelId: '',
    panelName: '',
    panelMemberId: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
    status: 'ACTIVE',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckResult | null>(null);
  const [ignoreWeakDuplicateWarning, setIgnoreWeakDuplicateWarning] = useState(false);

  // Initialize or reset form
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setDuplicateWarning(null);
      setIgnoreWeakDuplicateWarning(false);
      setQuickSearchTerm('');
      setQuickSearchResults([]);

      if (patientToEdit) {
        setFormData({
          fullName: patientToEdit.fullName,
          fatherGuardianName: patientToEdit.fatherGuardianName || '',
          guardianRelation: patientToEdit.guardianRelation || 'Father',
          dateOfBirth: patientToEdit.dateOfBirth || '',
          age: patientToEdit.age,
          ageIsEstimated: patientToEdit.ageIsEstimated,
          gender: patientToEdit.gender,
          cnic: patientToEdit.cnic || '',
          passportNumber: patientToEdit.passportNumber || '',
          primaryPhone: patientToEdit.primaryPhone,
          alternatePhone: patientToEdit.alternatePhone || '',
          email: patientToEdit.email || '',
          addressLine1: patientToEdit.addressLine1 || '',
          addressLine2: patientToEdit.addressLine2 || '',
          city: patientToEdit.city || 'Lahore',
          province: patientToEdit.province || 'Punjab',
          country: patientToEdit.country || 'Pakistan',
          bloodGroup: patientToEdit.bloodGroup || 'Unknown',
          payerType: patientToEdit.payerType,
          panelId: patientToEdit.panelId || '',
          panelName: patientToEdit.panelName || '',
          panelMemberId: patientToEdit.panelMemberId || '',
          emergencyContactName: patientToEdit.emergencyContactName || '',
          emergencyContactRelation: patientToEdit.emergencyContactRelation || '',
          emergencyContactPhone: patientToEdit.emergencyContactPhone || '',
          status: patientToEdit.status,
        });
        setPreviewMrNumber(patientToEdit.mrNumber);
      } else {
        // Register mode: reset and compute next MR
        const nextMr = generateNextMrNumber();
        setPreviewMrNumber(nextMr);
        setFormData({
          fullName: '',
          fatherGuardianName: '',
          guardianRelation: 'Father',
          dateOfBirth: '',
          age: '',
          ageIsEstimated: false,
          gender: 'Male',
          cnic: '',
          passportNumber: '',
          primaryPhone: '',
          alternatePhone: '',
          email: '',
          addressLine1: '',
          addressLine2: '',
          city: 'Lahore',
          province: 'Punjab',
          country: 'Pakistan',
          bloodGroup: 'Unknown',
          payerType: 'Self Pay',
          panelId: '',
          panelName: '',
          panelMemberId: '',
          emergencyContactName: '',
          emergencyContactRelation: '',
          emergencyContactPhone: '',
          status: 'ACTIVE',
        });
      }
    }
  }, [isOpen, patientToEdit]);

  // Handle quick lookup search
  useEffect(() => {
    if (!quickSearchTerm.trim()) {
      setQuickSearchResults([]);
      return;
    }
    const q = quickSearchTerm.trim().toLowerCase();
    const all = getAllPatients();
    const matches = all.filter((p) => {
      const mMr = p.mrNumber.toLowerCase().includes(q);
      const mName = p.fullName.toLowerCase().includes(q);
      const mCnic = p.cnic ? p.cnic.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || p.cnic.toLowerCase().includes(q) : false;
      const mPhone = p.primaryPhone ? p.primaryPhone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) : false;
      return mMr || mName || mCnic || mPhone;
    });
    setQuickSearchResults(matches.slice(0, 5));
  }, [quickSearchTerm]);

  // Live duplicate detection
  useEffect(() => {
    if (!isOpen) return;

    const normCnic = normalizeCnic(formData.cnic);
    const hasCnic = normCnic && isValidCnic(normCnic);
    const hasPhone = isValidPhone(formData.primaryPhone);
    const hasPassport = Boolean(formData.passportNumber?.trim());
    const hasNameAndFather = Boolean(formData.fullName.trim() && formData.fatherGuardianName.trim());
    const hasNameAndDob = Boolean(formData.fullName.trim() && formData.dateOfBirth);

    if (hasCnic || hasPassport || (hasPhone && formData.primaryPhone.length >= 10) || hasNameAndFather || hasNameAndDob) {
      const check = checkDuplicates(
        {
          cnic: normCnic,
          passportNumber: formData.passportNumber,
          primaryPhone: formData.primaryPhone,
          fullName: formData.fullName,
          fatherGuardianName: formData.fatherGuardianName,
          dateOfBirth: formData.dateOfBirth,
        },
        patientToEdit?.id
      );

      if (check.isExactCnic || check.isExactPassport || check.isPossibleDuplicate) {
        setDuplicateWarning(check);
        return;
      }
    }

    setDuplicateWarning(null);
  }, [
    formData.cnic,
    formData.passportNumber,
    formData.primaryPhone,
    formData.fullName,
    formData.fatherGuardianName,
    formData.dateOfBirth,
    isOpen,
    patientToEdit,
  ]);

  if (!isOpen) return null;

  // Handle DOB change: automatically calculate age and sync
  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dob = e.target.value;
    if (dob) {
      const computedAge = calculateAgeFromDob(dob);
      setFormData((prev) => ({
        ...prev,
        dateOfBirth: dob,
        age: computedAge,
        ageIsEstimated: false,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        dateOfBirth: '',
        age: '',
        ageIsEstimated: true,
      }));
    }
  };

  // Handle Manual Age change (only allowed when DOB is empty)
  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({
      ...prev,
      age: val,
      ageIsEstimated: true,
    }));
  };

  // Handle CNIC with auto-normalization
  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleanDigits = raw.replace(/\D/g, '').slice(0, 13);
    let formatted = cleanDigits;
    if (cleanDigits.length > 5 && cleanDigits.length <= 12) {
      formatted = `${cleanDigits.slice(0, 5)}-${cleanDigits.slice(5)}`;
    } else if (cleanDigits.length > 12) {
      formatted = `${cleanDigits.slice(0, 5)}-${cleanDigits.slice(5, 12)}-${cleanDigits.slice(12)}`;
    }
    setFormData((prev) => ({ ...prev, cnic: formatted }));
  };

  // Handle Payer Type Switch: if Self Pay, clear panel info
  const handlePayerTypeChange = (newPayer: PayerType) => {
    if (newPayer === 'Self Pay') {
      setFormData((prev) => ({
        ...prev,
        payerType: 'Self Pay',
        panelId: '',
        panelName: '',
        panelMemberId: '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        payerType: 'Corporate / Panel',
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Patient full name is required.';
    }

    if (!formData.gender) {
      newErrors.gender = 'Gender is required.';
    }

    if (!formData.primaryPhone.trim()) {
      newErrors.primaryPhone = 'Primary phone number is required.';
    } else if (!isValidPhone(formData.primaryPhone)) {
      newErrors.primaryPhone = 'Please enter a valid phone number (at least 10 digits).';
    }

    if (formData.cnic.trim()) {
      const norm = normalizeCnic(formData.cnic);
      if (!isValidCnic(norm)) {
        newErrors.cnic = 'CNIC must be 13 digits (format: XXXXX-XXXXXXX-X).';
      }
    }

    if (!formData.dateOfBirth && (formData.age === '' || Number(formData.age) < 0 || Number(formData.age) > 125)) {
      newErrors.age = 'Provide a valid age (0–125) or select Date of Birth.';
    }

    if (formData.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        newErrors.email = 'Please provide a valid email address.';
      }
    }

    if (formData.payerType === 'Corporate / Panel') {
      if (!formData.panelId) {
        newErrors.panelId = 'Please select a Corporate Panel.';
      }
      if (!formData.panelMemberId.trim()) {
        newErrors.panelMemberId = 'Panel Member ID / Card Number is required.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // If exact duplicate exists, block creation completely
    if (duplicateWarning?.isExactCnic || duplicateWarning?.isExactPassport) {
      return;
    }

    // If weaker match exists and not yet dismissed by staff
    if (duplicateWarning?.isPossibleDuplicate && !ignoreWeakDuplicateWarning) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-[#e2eae5] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#effaf5] border border-[#c2e7db] text-[#08775A] flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {isEditMode ? `Edit Patient Record` : `Register New Patient`}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Permanent MR:</span>
                  <span className="font-mono font-bold text-[#08775A] bg-[#effaf5] px-1.5 py-0.5 rounded-sm border border-[#c2e7db]">
                    {previewMrNumber}
                  </span>
                  {isEditMode && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm border border-amber-200">
                      Read-Only (Preserved)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with scroll */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1 text-sm">
          {/* Quick Lookup Toolbar for New Registration */}
          {!isEditMode && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Search className="w-3.5 h-3.5 text-[#08775A]" />
                  <span>Search Existing Patient First</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Recommended to prevent duplicate MR creation
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={quickSearchTerm}
                  onChange={(e) => setQuickSearchTerm(e.target.value)}
                  placeholder="Check CNIC, Phone, MR Number, or Patient Name..."
                  className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-[#08775A] focus:ring-1 focus:ring-[#08775A]"
                />
                {quickSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setQuickSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick Results Preview */}
              {quickSearchResults.length > 0 && (
                <div className="mt-2.5 bg-white border border-emerald-200 rounded-lg divide-y divide-slate-100 overflow-hidden shadow-xs">
                  <div className="px-3 py-1.5 bg-emerald-50 text-[11px] font-semibold text-emerald-800">
                    Existing Patients Found ({quickSearchResults.length}):
                  </div>
                  {quickSearchResults.map((p) => (
                    <div
                      key={p.id}
                      className="px-3 py-2 flex items-center justify-between hover:bg-slate-50 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#08775A] mr-2">
                          {p.mrNumber}
                        </span>
                        <span className="font-semibold text-slate-800">{p.fullName}</span>
                        {p.fatherGuardianName && (
                          <span className="text-slate-400 ml-1">
                            ({p.guardianRelation}: {p.fatherGuardianName})
                          </span>
                        )}
                        <span className="text-slate-500 ml-2 font-mono">{p.primaryPhone}</span>
                        {p.cnic && (
                          <span className="text-slate-400 ml-2 font-mono">[{p.cnic}]</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenExistingPatient) {
                            onOpenExistingPatient(p);
                            onClose();
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#08775A] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open Patient
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DUPLICATE WARNING / BLOCKING BANNERS */}
          {duplicateWarning && (
            <div>
              {duplicateWarning.isExactCnic || duplicateWarning.isExactPassport ? (
                // Hard Duplicate Block (Exact CNIC or Passport)
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-900">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-red-800">
                        Duplicate Identity Blocked
                      </h4>
                      <p className="text-xs text-red-700 mt-0.5">
                        {duplicateWarning.reason}
                      </p>

                      {duplicateWarning.matchedPatients.map((matched) => (
                        <div
                          key={matched.id}
                          className="mt-2.5 bg-white border border-red-200 rounded-lg p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-mono font-bold text-[#08775A] mr-2">
                              {matched.mrNumber}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {matched.fullName}
                            </span>
                            <span className="text-slate-500 ml-2 font-mono">
                              Phone: {matched.primaryPhone}
                            </span>
                            {matched.cnic && (
                              <span className="text-slate-600 ml-2 font-mono">
                                CNIC: {matched.cnic}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenExistingPatient) {
                                onOpenExistingPatient(matched);
                                onClose();
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#08775A] text-white rounded-md text-xs font-medium hover:bg-[#07664d] transition-colors"
                          >
                            Open Existing Patient
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : duplicateWarning.isPossibleDuplicate && !ignoreWeakDuplicateWarning ? (
                // Weaker Match Warning (Phone or Name Match)
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-amber-800">
                        Possible Existing Patient Found
                      </h4>
                      <p className="text-xs text-amber-700 mt-0.5">
                        {duplicateWarning.reason}
                      </p>

                      <div className="mt-2 space-y-1.5">
                        {duplicateWarning.matchedPatients.map((matched) => (
                          <div
                            key={matched.id}
                            className="bg-white border border-amber-200 rounded-lg p-2.5 text-xs flex items-center justify-between"
                          >
                            <div>
                              <span className="font-mono font-bold text-[#08775A] mr-2">
                                {matched.mrNumber}
                              </span>
                              <span className="font-semibold text-slate-800">
                                {matched.fullName}
                              </span>
                              <span className="text-slate-500 ml-2 font-mono">
                                {matched.primaryPhone}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenExistingPatient) {
                                  onOpenExistingPatient(matched);
                                  onClose();
                                }
                              }}
                              className="text-xs font-semibold text-[#08775A] hover:underline"
                            >
                              Review Patient
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIgnoreWeakDuplicateWarning(true)}
                          className="px-3 py-1 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700 transition-colors"
                        >
                          Continue Registration (Different Individual)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <form id="patient-form" onSubmit={handleSubmit} className="space-y-6">
            {/* SECTION 1: PATIENT IDENTITY */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                <User className="w-4 h-4 text-[#08775A]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Patient Identity
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Full Name */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Muhammad Tariq Khan"
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white ${
                      errors.fullName
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-300 focus:border-[#08775A]'
                    }`}
                  />
                  {errors.fullName && (
                    <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>
                  )}
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value as PatientGender })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  >
                    {PATIENT_GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Father / Guardian Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Father / Guardian / Spouse Name
                  </label>
                  <input
                    type="text"
                    value={formData.fatherGuardianName}
                    onChange={(e) =>
                      setFormData({ ...formData, fatherGuardianName: e.target.value })
                    }
                    placeholder="e.g. Abdul Hameed Khan"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                </div>

                {/* Guardian Relation */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Guardian Relation
                  </label>
                  <select
                    value={formData.guardianRelation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        guardianRelation: e.target.value as GuardianRelation,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  >
                    {GUARDIAN_RELATIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Blood Group */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) =>
                      setFormData({ ...formData, bloodGroup: e.target.value as BloodGroup })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  >
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleDobChange}
                    max="2026-09-09"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formData.dateOfBirth ? 'Age auto-computed' : 'Leave empty if unknown'}
                  </p>
                </div>

                {/* Age */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Age (Years){' '}
                    {formData.ageIsEstimated && (
                      <span className="text-amber-600 font-normal">(Estimated)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={handleAgeChange}
                    disabled={Boolean(formData.dateOfBirth)}
                    placeholder="e.g. 45"
                    min="0"
                    max="125"
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white ${
                      formData.dateOfBirth ? 'bg-slate-100 text-slate-600' : ''
                    } ${errors.age ? 'border-red-400' : 'border-slate-300'}`}
                  />
                  {errors.age && <p className="text-xs text-red-500 mt-1">{errors.age}</p>}
                </div>

                {/* CNIC */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CNIC (Pakistani National ID)
                  </label>
                  <input
                    type="text"
                    value={formData.cnic}
                    onChange={handleCnicChange}
                    placeholder="35202-1234567-1"
                    maxLength={15}
                    className={`w-full px-3 py-2 font-mono bg-slate-50 border rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white ${
                      errors.cnic ? 'border-red-400' : 'border-slate-300 focus:border-[#08775A]'
                    }`}
                  />
                  {errors.cnic && <p className="text-xs text-red-500 mt-1">{errors.cnic}</p>}
                </div>

                {/* Passport Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Passport Number (Foreign / Oversees)
                  </label>
                  <input
                    type="text"
                    value={formData.passportNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, passportNumber: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. PA123456"
                    className="w-full px-3 py-2 font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: CONTACT INFORMATION */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                <Phone className="w-4 h-4 text-[#08775A]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Contact Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Primary Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.primaryPhone}
                    onChange={(e) => setFormData({ ...formData, primaryPhone: e.target.value })}
                    placeholder="0300-1234567"
                    className={`w-full px-3 py-2 font-mono bg-slate-50 border rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white ${
                      errors.primaryPhone
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-300 focus:border-[#08775A]'
                    }`}
                  />
                  {errors.primaryPhone && (
                    <p className="text-xs text-red-500 mt-1">{errors.primaryPhone}</p>
                  )}
                </div>

                {/* Alternate Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alternate Phone
                  </label>
                  <input
                    type="text"
                    value={formData.alternatePhone}
                    onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                    placeholder="0321-7654321 / 042-35..."
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="patient@example.com"
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white ${
                      errors.email ? 'border-red-400' : 'border-slate-300 focus:border-[#08775A]'
                    }`}
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
              </div>
            </div>

            {/* SECTION 3: ADDRESS */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                <MapPin className="w-4 h-4 text-[#08775A]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Residential Address
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    placeholder="House / Flat No, Street, Sector, Colony"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Address Line 2 (Area / Landmark)
                  </label>
                  <input
                    type="text"
                    value={formData.addressLine2}
                    onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                    placeholder="Nearby landmark or phase"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Lahore"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Province</label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    placeholder="e.g. Punjab"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="e.g. Pakistan"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: PAYER INFORMATION */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                <Building className="w-4 h-4 text-[#08775A]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Payer Information
                </h3>
              </div>

              {/* Payer Type Selection */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Payer Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.payerType === 'Self Pay'
                        ? 'border-[#08775A] bg-[#effaf5] text-[#08775A] font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payerType"
                      checked={formData.payerType === 'Self Pay'}
                      onChange={() => handlePayerTypeChange('Self Pay')}
                      className="text-[#08775A] focus:ring-[#08775A]"
                    />
                    <div>
                      <div className="text-sm">Self Pay</div>
                      <div className="text-xs text-slate-500 font-normal">
                        Patient pays directly at billing counter
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.payerType === 'Corporate / Panel'
                        ? 'border-[#08775A] bg-[#effaf5] text-[#08775A] font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payerType"
                      checked={formData.payerType === 'Corporate / Panel'}
                      onChange={() => handlePayerTypeChange('Corporate / Panel')}
                      className="text-[#08775A] focus:ring-[#08775A]"
                    />
                    <div>
                      <div className="text-sm">Corporate / Panel</div>
                      <div className="text-xs text-slate-500 font-normal">
                        Covered by insurance, govt sehat card or enterprise
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Corporate Panel Fields */}
              {formData.payerType === 'Corporate / Panel' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Corporate Panel Entity <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.panelId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const p = activePanels.find((panel) => panel.id === selectedId);
                        setFormData({
                          ...formData,
                          panelId: selectedId,
                          panelName: p ? p.name : '',
                        });
                      }}
                      className={`w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white ${
                        errors.panelId ? 'border-red-400' : 'border-slate-300 focus:border-[#08775A]'
                      }`}
                    >
                      <option value="">-- Select Corporate Panel --</option>
                      {activePanels.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                    {errors.panelId && (
                      <p className="text-xs text-red-500 mt-1">{errors.panelId}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Panel Member ID / Card Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.panelMemberId}
                      onChange={(e) =>
                        setFormData({ ...formData, panelMemberId: e.target.value })
                      }
                      placeholder="e.g. SLI-99214-PK / Card #"
                      className={`w-full px-3 py-2 font-mono bg-slate-50 border rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white ${
                        errors.panelMemberId
                          ? 'border-red-400'
                          : 'border-slate-300 focus:border-[#08775A]'
                      }`}
                    />
                    {errors.panelMemberId && (
                      <p className="text-xs text-red-500 mt-1">{errors.panelMemberId}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Informational note for Panel Changes */}
              {isEditMode && (
                <div className="mt-3.5 flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Updated payer information will apply to future transactions. Historical billing
                    records retain their original payer details.
                  </span>
                </div>
              )}
            </div>

            {/* SECTION 5: EMERGENCY CONTACT */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                <HeartHandshake className="w-4 h-4 text-[#08775A]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Emergency Contact
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.emergencyContactName}
                    onChange={(e) =>
                      setFormData({ ...formData, emergencyContactName: e.target.value })
                    }
                    placeholder="e.g. Begum Nasreen"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Relation</label>
                  <input
                    type="text"
                    value={formData.emergencyContactRelation}
                    onChange={(e) =>
                      setFormData({ ...formData, emergencyContactRelation: e.target.value })
                    }
                    placeholder="e.g. Spouse / Son / Brother"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.emergencyContactPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, emergencyContactPhone: e.target.value })
                    }
                    placeholder="0300-1122334"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:border-[#08775A]"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="text-xs text-slate-500">
            <span className="text-red-500 font-semibold">*</span> Required hospital identity fields
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors border border-slate-300 bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="patient-form"
              disabled={Boolean(
                duplicateWarning?.isExactCnic || duplicateWarning?.isExactPassport
              )}
              className="px-5 py-2 text-sm font-medium text-white bg-[#08775A] hover:bg-[#07664d] rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isEditMode ? 'Save Changes' : 'Register Patient'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
