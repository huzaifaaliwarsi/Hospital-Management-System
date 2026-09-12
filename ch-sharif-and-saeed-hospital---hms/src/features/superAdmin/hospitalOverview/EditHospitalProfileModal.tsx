import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Building,
  Phone,
  MapPin,
  Sliders,
  Clock,
  FileText,
  Image as ImageIcon,
  RotateCcw,
  Save,
} from 'lucide-react';
import { HospitalProfile, DayWorkingHours } from '../../../types/hospital';
import { useToast } from '../../../context/ToastContext';

interface EditHospitalProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: HospitalProfile;
  onSave: (updatedProfile: HospitalProfile) => void;
}

type TabKey =
  | 'identity'
  | 'branding'
  | 'contact'
  | 'address'
  | 'operations'
  | 'working_hours'
  | 'billing';

const HOSPITAL_TYPES = [
  'General Hospital',
  'Specialty Hospital',
  'Teaching Hospital',
  'Clinic / Medical Center',
  'Other',
];

const WORKING_MODES = [
  'Standard OPD & 24/7 Emergency',
  '24/7 Multi-Specialty Facility',
  'Day Care & Outpatient Clinic',
  'Specialized Tertiary Care Centre',
];

const TIMEZONES = [
  'UTC+05:00 (Pakistan Standard Time)',
  'UTC+04:00 (Gulf Standard Time)',
  'UTC+00:00 (Coordinated Universal Time)',
];

const WEEK_START_DAYS = ['Monday', 'Sunday', 'Saturday'];

const DATE_FORMATS = ['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'];

const TIME_FORMATS = ['12-Hour (hh:mm A)', '24-Hour (HH:mm)'];

export const EditHospitalProfileModal: React.FC<EditHospitalProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSave,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('identity');
  const [formData, setFormData] = useState<HospitalProfile>({ ...profile });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Confirmation Modals
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [showInactiveConfirm, setShowInactiveConfirm] = useState(false);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...profile,
        workingHours: profile.workingHours.map((wh) => ({ ...wh })),
      });
      setErrors({});
      setActiveTab('identity');
      setShowUnsavedConfirm(false);
      setShowInactiveConfirm(false);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  // Check if form is dirty
  const isFormDirty = () => {
    return JSON.stringify(formData) !== JSON.stringify(profile);
  };

  const handleRequestClose = () => {
    if (isFormDirty()) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  const handleReset = () => {
    setFormData({
      ...profile,
      workingHours: profile.workingHours.map((wh) => ({ ...wh })),
    });
    setErrors({});
    toast.info('Form changes reset to saved hospital profile.', 'Reset Completed');
  };

  // Field change helper
  const handleChange = (field: keyof HospitalProfile, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Working Hours change helper
  const handleWorkingHoursChange = (
    index: number,
    field: keyof DayWorkingHours,
    value: any
  ) => {
    setFormData((prev) => {
      const updated = [...prev.workingHours];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, workingHours: updated };
    });
  };

  // Logo file upload handler with validation
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid image format. Supported types: PNG, JPG, JPEG, WEBP.', 'Upload Error');
      return;
    }

    // Validate size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size exceeds the 2 MB mock upload limit.', 'Upload Error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      handleChange('logo', result);
      toast.success('Hospital logo loaded for preview.', 'Logo Preview Ready');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    handleChange('logo', null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.info('Logo removed. Default initials monogram (CSS) will be used.', 'Logo Cleared');
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 1. Hospital Name is required
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Hospital Name is mandatory and cannot be empty.';
    }

    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.primaryEmail && !emailRegex.test(formData.primaryEmail.trim())) {
      newErrors.primaryEmail = 'Please provide a valid administrative email format (e.g. name@domain.com).';
    }
    if (formData.secondaryEmail && !emailRegex.test(formData.secondaryEmail.trim())) {
      newErrors.secondaryEmail = 'Please provide a valid secondary email format.';
    }
    if (formData.invoiceEmail && !emailRegex.test(formData.invoiceEmail.trim())) {
      newErrors.invoiceEmail = 'Please provide a valid invoice billing email format.';
    }

    // 3. Website validation
    if (formData.website && formData.website.trim() !== '') {
      const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
      if (!urlPattern.test(formData.website.trim())) {
        newErrors.website = 'Please provide a valid website address (e.g. www.hospital.com or https://hospital.com).';
      }
    }

    // 4. Phone validation
    const phoneRegex = /^[\d\s\-+().]{7,25}$/;
    if (formData.primaryPhone && !phoneRegex.test(formData.primaryPhone.trim())) {
      newErrors.primaryPhone = 'Please enter a valid phone number (minimum 7 characters).';
    }
    if (formData.alternatePhone && !phoneRegex.test(formData.alternatePhone.trim())) {
      newErrors.alternatePhone = 'Please enter a valid phone number.';
    }
    if (formData.emergencyPhone && !phoneRegex.test(formData.emergencyPhone.trim())) {
      newErrors.emergencyPhone = 'Please enter a valid emergency contact number.';
    }
    if (formData.invoicePhone && !phoneRegex.test(formData.invoicePhone.trim())) {
      newErrors.invoicePhone = 'Please enter a valid invoice contact number.';
    }

    // 5. Prefix validations (uppercase letters/numbers only, short <= 6)
    const prefixRegex = /^[A-Z0-9]{1,6}$/;
    if (formData.invoicePrefix && !prefixRegex.test(formData.invoicePrefix.toUpperCase().trim())) {
      newErrors.invoicePrefix = 'Invoice prefix must be 1 to 6 alphanumeric characters (e.g. INV).';
    }
    if (formData.receiptPrefix && !prefixRegex.test(formData.receiptPrefix.toUpperCase().trim())) {
      newErrors.receiptPrefix = 'Receipt prefix must be 1 to 6 alphanumeric characters (e.g. REC).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!validateForm()) {
      toast.error('Please resolve the validation errors before saving.', 'Invalid Form');
      return;
    }

    // Safeguard: If status is being set to Inactive, trigger warning confirmation
    if (profile.status === 'Active' && formData.status === 'Inactive') {
      setShowInactiveConfirm(true);
      return;
    }

    executeSave();
  };

  const executeSave = () => {
    const updated: HospitalProfile = {
      ...formData,
      name: formData.name.trim(),
      invoicePrefix: (formData.invoicePrefix || 'INV').toUpperCase().trim(),
      receiptPrefix: (formData.receiptPrefix || 'REC').toUpperCase().trim(),
      updatedAt: 'Just now (08 Sep 2026)',
      updatedBy: 'Super Admin',
    };

    onSave(updated);
    toast.success('Hospital profile updated successfully.', 'Profile Saved');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2eae5] bg-gradient-to-r from-[#effaf5] via-white to-[#effaf5]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#111827]">
                Edit Hospital Profile & Governance
              </h3>
              <p className="text-xs text-[#52665e]">
                Update identity, contact details, operational settings, working hours, and billing configuration.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body with Left Navigation Tabs & Right Form Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Tabs Sidebar */}
          <div className="w-full md:w-56 bg-[#f8faf9] border-b md:border-b-0 md:border-r border-[#e2eae5] p-2 sm:p-3 overflow-x-auto md:overflow-y-auto shrink-0 flex md:flex-col gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('identity')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'identity'
                  ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Building className="h-4 w-4 shrink-0" />
              <span>Hospital Identity</span>
              {errors.name && <span className="h-2 w-2 rounded-full bg-rose-500 ml-auto" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('branding')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'branding'
                  ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <ImageIcon className="h-4 w-4 shrink-0" />
              <span>Logo & Branding</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('contact')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'contact'
                  ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Phone className="h-4 w-4 shrink-0" />
              <span>Contact Information</span>
              {(errors.primaryPhone || errors.primaryEmail || errors.website) && (
                <span className="h-2 w-2 rounded-full bg-rose-500 ml-auto" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('address')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'address'
                  ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <MapPin className="h-4 w-4 shrink-0" />
              <span>Address & Location</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('operations')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'operations'
                  ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Sliders className="h-4 w-4 shrink-0" />
              <span>Operational Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('working_hours')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'working_hours'
                  ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>Working Hours</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('billing')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'billing'
                  ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>Billing & Legal</span>
              {(errors.invoicePrefix || errors.receiptPrefix || errors.invoiceEmail) && (
                <span className="h-2 w-2 rounded-full bg-rose-500 ml-auto" />
              )}
            </button>
          </div>

          {/* Form Content Panel */}
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto">
            {/* TAB 1: HOSPITAL IDENTITY */}
            {activeTab === 'identity' && (
              <div className="space-y-4">
                <div className="border-b border-[#e2eae5] pb-3 mb-4">
                  <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                    Institutional Identity & Licensing
                  </h4>
                  <p className="text-[11px] text-[#52665e]">
                    Master nomenclature, hospital categorization, official registration, and status.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Hospital Name (Required) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Hospital Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="e.g. CH Sharif and Saeed Hospital"
                      className={`w-full rounded-lg border px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] ${
                        errors.name ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                      }`}
                    />
                    {errors.name && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.name}</p>
                    )}
                  </div>

                  {/* Short / Display Name */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Short Name / Display Name
                    </label>
                    <input
                      type="text"
                      value={formData.shortName}
                      onChange={(e) => handleChange('shortName', e.target.value)}
                      placeholder="e.g. CSS Hospital"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                    <span className="text-[10px] text-[#8b9e95] mt-1 block">Used in navigation and compact tokens.</span>
                  </div>

                  {/* Hospital Type */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Hospital Type
                    </label>
                    <select
                      value={formData.hospitalType}
                      onChange={(e) => handleChange('hospitalType', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    >
                      <option value="">Select Hospital Type...</option>
                      {HOSPITAL_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Registration Number */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={formData.registrationNumber}
                      onChange={(e) => handleChange('registrationNumber', e.target.value)}
                      placeholder="e.g. REG-2026-9901"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* License Number */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      License Number
                    </label>
                    <input
                      type="text"
                      value={formData.licenseNumber}
                      onChange={(e) => handleChange('licenseNumber', e.target.value)}
                      placeholder="e.g. LIC-HLTH-8821"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Accreditation Body */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Accreditation Body
                    </label>
                    <input
                      type="text"
                      value={formData.accreditationBody}
                      onChange={(e) => handleChange('accreditationBody', e.target.value)}
                      placeholder="e.g. Healthcare Commission"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Accreditation Number */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Accreditation Number
                    </label>
                    <input
                      type="text"
                      value={formData.accreditationNumber}
                      onChange={(e) => handleChange('accreditationNumber', e.target.value)}
                      placeholder="e.g. ACC-2026-4412"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Hospital Status */}
                  <div className="sm:col-span-2 p-3 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
                    <label className="block text-xs font-bold text-[#111827] mb-2">
                      Hospital Operational Status
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                        <input
                          type="radio"
                          name="hospitalStatus"
                          value="Active"
                          checked={formData.status === 'Active'}
                          onChange={() => handleChange('status', 'Active')}
                          className="h-4 w-4 text-[#08775A] focus:ring-[#08775A]"
                        />
                        <span className="text-[#08775A]">Active (Full System Operations)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-rose-700">
                        <input
                          type="radio"
                          name="hospitalStatus"
                          value="Inactive"
                          checked={formData.status === 'Inactive'}
                          onChange={() => handleChange('status', 'Inactive')}
                          className="h-4 w-4 text-rose-600 focus:ring-rose-500"
                        />
                        <span>Inactive (Restricted Access)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LOGO & BRANDING */}
            {activeTab === 'branding' && (
              <div className="space-y-4">
                <div className="border-b border-[#e2eae5] pb-3 mb-4">
                  <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                    Hospital Logo & Visual Identity
                  </h4>
                  <p className="text-[11px] text-[#52665e]">
                    Upload and preview the hospital emblem. Used across reports, invoice headers, and portal navigation.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-4 rounded-xl bg-[#f6faf8] border border-[#e2eae5]">
                  {/* Current Logo Preview */}
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-[#8b9e95]">
                      Current / Staged Logo
                    </span>
                    {formData.logo ? (
                      <div className="h-24 w-24 rounded-xl border border-[#c2e7db] bg-white p-2 shadow-xs flex items-center justify-center overflow-hidden">
                        <img
                          src={formData.logo}
                          alt="Hospital Logo Preview"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-24 w-24 rounded-xl bg-gradient-to-br from-[#effaf5] to-[#d6f0e4] border border-[#c2e7db] flex flex-col items-center justify-center text-[#08775A] shadow-xs">
                        <span className="text-2xl font-extrabold tracking-wider leading-none">CSS</span>
                        <span className="text-[10px] font-bold text-[#149e75] tracking-widest mt-1">HMS</span>
                      </div>
                    )}
                    <span className="text-[10px] text-[#52665e]">
                      {formData.logo ? 'Custom Logo' : 'Initials Placeholder'}
                    </span>
                  </div>

                  {/* Actions & File Input */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <h5 className="text-xs font-bold text-[#111827]">Upload Custom Hospital Emblem</h5>
                      <p className="text-[11px] text-[#52665e] mt-0.5">
                        Supported file formats: PNG, JPG, JPEG, WEBP. Maximum recommended file size: 2 MB.
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="hospital-logo-file-input"
                    />

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#129b70] hover:bg-[#08775A] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <Upload className="h-4 w-4" />
                        <span>{formData.logo ? 'Change Logo' : 'Upload Logo'}</span>
                      </button>

                      {formData.logo && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Remove Logo</span>
                        </button>
                      )}
                    </div>

                    <div className="p-3 rounded-lg bg-[#effaf5] border border-[#c2e7db] text-[11px] text-[#08775A]">
                      <strong>Note:</strong> When no image file is uploaded, the system generates a crisp, high-resolution monogram initials emblem (CSS) automatically.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CONTACT INFORMATION */}
            {activeTab === 'contact' && (
              <div className="space-y-4">
                <div className="border-b border-[#e2eae5] pb-3 mb-4">
                  <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                    Hospital Communication Channels
                  </h4>
                  <p className="text-[11px] text-[#52665e]">
                    Official telephone lines, casualty hotline, administrative emails, and web addresses.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Primary Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Primary Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.primaryPhone}
                      onChange={(e) => handleChange('primaryPhone', e.target.value)}
                      placeholder="e.g. +92 42 3588 9900"
                      className={`w-full rounded-lg border px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] ${
                        errors.primaryPhone ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                      }`}
                    />
                    {errors.primaryPhone && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.primaryPhone}</p>
                    )}
                  </div>

                  {/* Alternate Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Alternate Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.alternatePhone}
                      onChange={(e) => handleChange('alternatePhone', e.target.value)}
                      placeholder="e.g. +92 42 3588 9901"
                      className={`w-full rounded-lg border px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] ${
                        errors.alternatePhone ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                      }`}
                    />
                    {errors.alternatePhone && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.alternatePhone}</p>
                    )}
                  </div>

                  {/* Emergency Contact */}
                  <div>
                    <label className="block text-xs font-semibold text-rose-700 mb-1">
                      Emergency Contact Number
                    </label>
                    <input
                      type="tel"
                      value={formData.emergencyPhone}
                      onChange={(e) => handleChange('emergencyPhone', e.target.value)}
                      placeholder="e.g. 1122 or +92 42 3588 9911"
                      className={`w-full rounded-lg border px-3 py-2 text-xs font-bold text-rose-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 ${
                        errors.emergencyPhone ? 'border-rose-400 bg-rose-50/20' : 'border-rose-200 bg-rose-50/10'
                      }`}
                    />
                    {errors.emergencyPhone && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.emergencyPhone}</p>
                    )}
                  </div>

                  {/* Administrative Email */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Administrative Email
                    </label>
                    <input
                      type="email"
                      value={formData.primaryEmail}
                      onChange={(e) => handleChange('primaryEmail', e.target.value)}
                      placeholder="e.g. info@sharif-saeed.hospital"
                      className={`w-full rounded-lg border px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] ${
                        errors.primaryEmail ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                      }`}
                    />
                    {errors.primaryEmail && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.primaryEmail}</p>
                    )}
                  </div>

                  {/* Secondary Email */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Secondary Email
                    </label>
                    <input
                      type="email"
                      value={formData.secondaryEmail}
                      onChange={(e) => handleChange('secondaryEmail', e.target.value)}
                      placeholder="e.g. support@sharif-saeed.hospital"
                      className={`w-full rounded-lg border px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] ${
                        errors.secondaryEmail ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                      }`}
                    />
                    {errors.secondaryEmail && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.secondaryEmail}</p>
                    )}
                  </div>

                  {/* Website */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Website URL
                    </label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => handleChange('website', e.target.value)}
                      placeholder="e.g. www.sharif-saeed.hospital"
                      className={`w-full rounded-lg border px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] ${
                        errors.website ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                      }`}
                    />
                    {errors.website && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.website}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: ADDRESS & LOCATION */}
            {activeTab === 'address' && (
              <div className="space-y-4">
                <div className="border-b border-[#e2eae5] pb-3 mb-4">
                  <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                    Physical Campus & Location
                  </h4>
                  <p className="text-[11px] text-[#52665e]">
                    Postal address, geographical jurisdiction, city, province, and country designation.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Address Line 1 */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={formData.addressLine1}
                      onChange={(e) => handleChange('addressLine1', e.target.value)}
                      placeholder="e.g. Plot No. 12, Main Boulevard"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Address Line 2 */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.addressLine2}
                      onChange={(e) => handleChange('addressLine2', e.target.value)}
                      placeholder="e.g. Sector G-5, Near Civic Centre"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      placeholder="e.g. Islamabad"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Province / State */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Province / State
                    </label>
                    <input
                      type="text"
                      value={formData.province}
                      onChange={(e) => handleChange('province', e.target.value)}
                      placeholder="e.g. Punjab"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Postal Code */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => handleChange('postalCode', e.target.value)}
                      placeholder="e.g. 54000"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Country (Editable, default Pakistan) */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => handleChange('country', e.target.value)}
                      placeholder="Pakistan"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: OPERATIONAL SETTINGS */}
            {activeTab === 'operations' && (
              <div className="space-y-4">
                <div className="border-b border-[#e2eae5] pb-3 mb-4">
                  <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                    Operational Parameters & System Conventions
                  </h4>
                  <p className="text-[11px] text-[#52665e]">
                    Currency symbols, timezone configurations, week start conventions, and OPD hours.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Default Currency */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Default Currency
                    </label>
                    <input
                      type="text"
                      value={formData.currency}
                      onChange={(e) => handleChange('currency', e.target.value.toUpperCase())}
                      placeholder="PKR"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-[#08775A] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                    <span className="text-[10px] text-[#8b9e95] mt-1 block">Default currency for all invoices and tariffs.</span>
                  </div>

                  {/* Timezone */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      System Timezone
                    </label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => handleChange('timezone', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Week Start Day */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Week Start Day
                    </label>
                    <select
                      value={formData.weekStartDay}
                      onChange={(e) => handleChange('weekStartDay', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    >
                      {WEEK_START_DAYS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hospital Working Mode */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Hospital Working Mode
                    </label>
                    <select
                      value={formData.workingMode}
                      onChange={(e) => handleChange('workingMode', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    >
                      <option value="">Select Working Mode (Not configured)</option>
                      {WORKING_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* OPD Opening Time */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      OPD Opening Time
                    </label>
                    <input
                      type="text"
                      value={formData.opdOpenTime}
                      onChange={(e) => handleChange('opdOpenTime', e.target.value)}
                      placeholder="e.g. 08:00 AM"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* OPD Closing Time */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      OPD Closing Time
                    </label>
                    <input
                      type="text"
                      value={formData.opdCloseTime}
                      onChange={(e) => handleChange('opdCloseTime', e.target.value)}
                      placeholder="e.g. 08:00 PM"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Emergency Service Enabled */}
                  <div className="p-3 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#111827]">
                      <input
                        type="checkbox"
                        checked={formData.emergencyEnabled}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setFormData((prev) => ({
                            ...prev,
                            emergencyEnabled: enabled,
                            emergencyMode: enabled ? (prev.emergencyMode || '24/7') : '',
                          }));
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-[#08775A] focus:ring-[#08775A]"
                      />
                      <span>Emergency Department Enabled</span>
                    </label>
                    <span className="text-[10px] text-[#52665e] mt-1 block">
                      Enables casualty token generation and emergency triage admissions.
                    </span>
                  </div>

                  {/* Emergency Availability */}
                  <div className="p-3 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Emergency Availability Mode
                    </label>
                    <select
                      disabled={!formData.emergencyEnabled}
                      value={formData.emergencyMode}
                      onChange={(e) => handleChange('emergencyMode', e.target.value as any)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#111827] disabled:opacity-50 disabled:bg-slate-100"
                    >
                      <option value="">Select Emergency Mode...</option>
                      <option value="24/7">24/7 Continuous Casualty Service</option>
                      <option value="Custom Hours">Custom Hours (Specific Shifts)</option>
                    </select>
                  </div>

                  {/* Date Format */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Default Date Format
                    </label>
                    <select
                      value={formData.dateFormat}
                      onChange={(e) => handleChange('dateFormat', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    >
                      {DATE_FORMATS.map((df) => (
                        <option key={df} value={df}>
                          {df}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Time Format */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Default Time Format
                    </label>
                    <select
                      value={formData.timeFormat}
                      onChange={(e) => handleChange('timeFormat', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    >
                      {TIME_FORMATS.map((tf) => (
                        <option key={tf} value={tf}>
                          {tf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: WORKING HOURS */}
            {activeTab === 'working_hours' && (
              <div className="space-y-4">
                <div className="border-b border-[#e2eae5] pb-3 mb-4">
                  <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                    Weekly Working Schedule (OPD Consultation Clinics)
                  </h4>
                  <p className="text-[11px] text-[#52665e]">
                    Configure open/closed operational days and working hours for each day of the week.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {formData.workingHours.map((wh, idx) => (
                    <div
                      key={wh.day}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        wh.isOpen ? 'bg-white border-[#c2e7db]' : 'bg-[#f8faf9] border-[#e2eae5]'
                      }`}
                    >
                      {/* Day and Open/Closed Toggle */}
                      <div className="flex items-center gap-3 sm:w-44">
                        <input
                          type="checkbox"
                          id={`wh-toggle-${wh.day}`}
                          checked={wh.isOpen}
                          onChange={(e) =>
                            handleWorkingHoursChange(idx, 'isOpen', e.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 text-[#08775A] focus:ring-[#08775A] cursor-pointer"
                        />
                        <label
                          htmlFor={`wh-toggle-${wh.day}`}
                          className="text-xs font-bold text-[#111827] cursor-pointer"
                        >
                          {wh.day}
                        </label>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            wh.isOpen
                              ? 'bg-[#effaf5] text-[#08775A]'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {wh.isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>

                      {/* Hours Input */}
                      {wh.isOpen ? (
                        <div className="flex items-center gap-2 flex-1 sm:justify-end">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-[#52665e]">Open:</span>
                            <input
                              type="text"
                              value={wh.openTime}
                              onChange={(e) =>
                                handleWorkingHoursChange(idx, 'openTime', e.target.value)
                              }
                              placeholder="08:00 AM"
                              className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-[#111827] text-center"
                            />
                          </div>
                          <span className="text-slate-400 text-xs">to</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-[#52665e]">Close:</span>
                            <input
                              type="text"
                              value={wh.closeTime}
                              onChange={(e) =>
                                handleWorkingHoursChange(idx, 'closeTime', e.target.value)
                              }
                              placeholder="08:00 PM"
                              className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-[#111827] text-center"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-[#8b9e95] italic sm:text-right">
                          No OPD Clinics Scheduled (Emergency 24/7 continues)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: BILLING & LEGAL */}
            {activeTab === 'billing' && (
              <div className="space-y-4">
                <div className="border-b border-[#e2eae5] pb-3 mb-4">
                  <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                    Billing, Legal & Fiscal Identity
                  </h4>
                  <p className="text-[11px] text-[#52665e]">
                    Corporate legal name, tax identifiers, billing contact numbers, and sequence prefixes.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Legal Business Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Legal Business Name
                    </label>
                    <input
                      type="text"
                      value={formData.legalBusinessName}
                      onChange={(e) => handleChange('legalBusinessName', e.target.value)}
                      placeholder="e.g. CH Sharif and Saeed Hospital (Pvt) Ltd"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Tax / NTN Number */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Tax / NTN Number
                    </label>
                    <input
                      type="text"
                      value={formData.taxNumber}
                      onChange={(e) => handleChange('taxNumber', e.target.value)}
                      placeholder="e.g. 1234567-8"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Sales Tax / Registration Number */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Sales Tax / STRN Number
                    </label>
                    <input
                      type="text"
                      value={formData.salesTaxNumber}
                      onChange={(e) => handleChange('salesTaxNumber', e.target.value)}
                      placeholder="e.g. STRN-32-77-8899-001"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Official Billing Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Official Billing Address
                    </label>
                    <input
                      type="text"
                      value={formData.billingAddress}
                      onChange={(e) => handleChange('billingAddress', e.target.value)}
                      placeholder="e.g. Accounts Department, 2nd Floor, Executive Block"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                    />
                  </div>

                  {/* Invoice Contact Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Invoice Contact Number
                    </label>
                    <input
                      type="tel"
                      value={formData.invoicePhone}
                      onChange={(e) => handleChange('invoicePhone', e.target.value)}
                      placeholder="e.g. +92 42 3588 9920"
                      className={`w-full rounded-lg border px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] ${
                        errors.invoicePhone ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                      }`}
                    />
                    {errors.invoicePhone && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.invoicePhone}</p>
                    )}
                  </div>

                  {/* Invoice Email */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Invoice Email
                    </label>
                    <input
                      type="email"
                      value={formData.invoiceEmail}
                      onChange={(e) => handleChange('invoiceEmail', e.target.value)}
                      placeholder="e.g. billing@sharif-saeed.hospital"
                      className={`w-full rounded-lg border px-3 py-2 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] ${
                        errors.invoiceEmail ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                      }`}
                    />
                    {errors.invoiceEmail && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.invoiceEmail}</p>
                    )}
                  </div>

                  {/* Invoice Prefix */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Default Invoice Prefix (Max 6 chars)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={formData.invoicePrefix}
                      onChange={(e) => handleChange('invoicePrefix', e.target.value.toUpperCase())}
                      placeholder="INV"
                      className={`w-full rounded-lg border px-3 py-2 text-xs font-mono font-bold text-[#08775A] uppercase focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] ${
                        errors.invoicePrefix ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                      }`}
                    />
                    {errors.invoicePrefix && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.invoicePrefix}</p>
                    )}
                    <span className="text-[10px] text-[#8b9e95] mt-1 block">Output: {formData.invoicePrefix || 'INV'}-2026-0001</span>
                  </div>

                  {/* Receipt Prefix */}
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Default Receipt Prefix (Max 6 chars)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={formData.receiptPrefix}
                      onChange={(e) => handleChange('receiptPrefix', e.target.value.toUpperCase())}
                      placeholder="REC"
                      className={`w-full rounded-lg border px-3 py-2 text-xs font-mono font-bold text-[#08775A] uppercase focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] ${
                        errors.receiptPrefix ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                      }`}
                    />
                    {errors.receiptPrefix && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.receiptPrefix}</p>
                    )}
                    <span className="text-[10px] text-[#8b9e95] mt-1 block">Output: {formData.receiptPrefix || 'REC'}-2026-0001</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#e2eae5] bg-[#f8faf9] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isFormDirty() && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Changes</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-4 py-2 bg-white hover:bg-[#f6faf8] border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSave()}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#129b70] hover:bg-[#08775A] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Save Profile Changes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Dialog */}
      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Unsaved Changes</h4>
                <p className="text-xs text-slate-600 mt-1">
                  You have unsaved changes in the hospital profile form. If you exit now, these edits will be discarded.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowUnsavedConfirm(false)}
                className="px-3.5 py-1.5 bg-[#effaf5] text-[#08775A] hover:bg-[#d6f0e4] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  onClose();
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inactive Status Safeguard Dialog */}
      {showInactiveConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Hospital Status Safeguard</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Setting the hospital to <strong>Inactive</strong> may restrict operational access across clinical and cashiering portals. Are you sure you want to proceed?
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowInactiveConfirm(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInactiveConfirm(false);
                  executeSave();
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                Confirm Inactive Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
