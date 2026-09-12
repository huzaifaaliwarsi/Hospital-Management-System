import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  User,
  Briefcase,
  KeyRound,
  Building,
  AlertTriangle,
} from 'lucide-react';
import {
  StaffUser,
  StaffUserFormValues,
  StaffAccessType,
  StaffPortalKey,
  StaffRole,
  StaffStatus,
  StaffCategory,
  STAFF_PORTAL_ROLES,
  STAFF_CATEGORIES,
  STAFF_PORTALS,
} from '../../../types/staffUser';
import { Department } from '../../../types/department';
import { StaffUserService } from '../../../services/staffUserService';

interface StaffUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: StaffUserFormValues) => void;
  editingStaff?: StaffUser | null;
  departments: Department[];
}

export const StaffUserModal: React.FC<StaffUserModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingStaff,
  departments,
}) => {
  const isEdit = Boolean(editingStaff);

  // Filter for active departments for selection
  const activeDepartments = departments.filter((d) => d.status === 'Active');

  // Form state
  const [formData, setFormData] = useState<StaffUserFormValues>({
    fullName: '',
    employeeCode: '',
    fatherGuardianName: '',
    cnic: '',
    phone: '',
    alternatePhone: '',
    email: '',
    designation: '',
    departmentId: '',
    departmentName: '',
    staffCategory: 'Front Desk / Reception',
    status: 'ACTIVE',
    accessType: 'PORTAL_USER',
    assignedPortal: 'front-desk',
    staffRole: 'Front Desk Officer',
    username: '',
    password: '',
    confirmPassword: '',
    requirePasswordChange: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Confirmation dialogs for significant changes in edit mode
  const [confirmPortalChange, setConfirmPortalChange] = useState<boolean>(false);
  const [confirmAccessTypeChange, setConfirmAccessTypeChange] = useState<boolean>(false);
  const [pendingValues, setPendingValues] = useState<StaffUserFormValues | null>(null);

  // Initialize form when opened
  useEffect(() => {
    if (editingStaff) {
      setFormData({
        fullName: editingStaff.fullName,
        employeeCode: editingStaff.employeeCode,
        fatherGuardianName: editingStaff.fatherGuardianName || '',
        cnic: editingStaff.cnic || '',
        phone: editingStaff.phone,
        alternatePhone: editingStaff.alternatePhone || '',
        email: editingStaff.email,
        designation: editingStaff.designation,
        departmentId: editingStaff.departmentId,
        departmentName: editingStaff.departmentName,
        staffCategory: editingStaff.staffCategory,
        status: editingStaff.status,
        accessType: editingStaff.accessType,
        assignedPortal: editingStaff.assignedPortal || '',
        staffRole: (editingStaff.staffRole as string) || '',
        username: editingStaff.username || '',
        password: '',
        confirmPassword: '',
        requirePasswordChange: editingStaff.requirePasswordChange || false,
      });
    } else {
      const defaultDept = activeDepartments[0] || departments[0];
      setFormData({
        fullName: '',
        employeeCode: '',
        fatherGuardianName: '',
        cnic: '',
        phone: '',
        alternatePhone: '',
        email: '',
        designation: '',
        departmentId: defaultDept ? defaultDept.id : '',
        departmentName: defaultDept ? defaultDept.name : '',
        staffCategory: 'Front Desk / Reception',
        status: 'ACTIVE',
        accessType: 'PORTAL_USER',
        assignedPortal: 'front-desk',
        staffRole: 'Front Desk Officer',
        username: '',
        password: '',
        confirmPassword: '',
        requirePasswordChange: true,
      });
    }
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setConfirmPortalChange(false);
    setConfirmAccessTypeChange(false);
    setPendingValues(null);
  }, [isOpen, editingStaff, departments]);

  if (!isOpen) return null;

  // Handle department change
  const handleDepartmentChange = (deptId: string) => {
    const dept = departments.find((d) => d.id === deptId);
    setFormData((prev) => ({
      ...prev,
      departmentId: deptId,
      departmentName: dept ? dept.name : '',
    }));
  };

  // Handle portal change -> auto-select first matching role
  const handlePortalChange = (portalKey: StaffPortalKey | '') => {
    let defaultRole = '';
    if (portalKey && STAFF_PORTAL_ROLES[portalKey]) {
      defaultRole = STAFF_PORTAL_ROLES[portalKey][0];
    }
    setFormData((prev) => ({
      ...prev,
      assignedPortal: portalKey,
      staffRole: defaultRole,
    }));
  };

  // Auto-generate username from name if adding
  const handleNameBlur = () => {
    if (!isEdit && formData.accessType === 'PORTAL_USER' && !formData.username && formData.fullName) {
      const parts = formData.fullName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);
      if (parts.length > 1) {
        setFormData((prev) => ({ ...prev, username: `${parts[0]}.${parts[parts.length - 1]}` }));
      } else if (parts.length === 1) {
        setFormData((prev) => ({ ...prev, username: parts[0] }));
      }
    }
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full Name is required.';
    }

    if (!formData.employeeCode.trim()) {
      newErrors.employeeCode = 'Employee Code is required.';
    } else if (StaffUserService.isEmployeeCodeDuplicate(formData.employeeCode, editingStaff?.id)) {
      newErrors.employeeCode = 'This Employee Code is already in use.';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required.';
    }

    if (formData.cnic.trim() && !StaffUserService.isValidCNIC(formData.cnic)) {
      newErrors.cnic = 'CNIC must follow format xxxxx-xxxxxxx-x.';
    }

    if (!formData.designation.trim()) {
      newErrors.designation = 'Designation is required.';
    }

    if (!formData.departmentId) {
      newErrors.departmentId = 'Department selection is required.';
    }

    // Portal User Validations
    if (formData.accessType === 'PORTAL_USER') {
      if (!formData.assignedPortal) {
        newErrors.assignedPortal = 'Assigned Portal is required.';
      }
      if (!formData.staffRole) {
        newErrors.staffRole = 'Staff Role is required.';
      } else if (formData.assignedPortal) {
        const allowedRoles = STAFF_PORTAL_ROLES[formData.assignedPortal as StaffPortalKey] || [];
        if (!allowedRoles.includes(formData.staffRole as StaffRole)) {
          newErrors.staffRole = `Role "${formData.staffRole}" is incompatible with portal "${formData.assignedPortal}".`;
        }
      }
      if (!formData.username.trim()) {
        newErrors.username = 'Username is required.';
      } else if (StaffUserService.isUsernameDuplicate(formData.username, editingStaff?.id)) {
        newErrors.username = 'This username is already taken.';
      }

      // Password checks if adding OR converting from STAFF_RECORD_ONLY
      const isConvertingToPortal = isEdit && editingStaff?.accessType === 'STAFF_RECORD_ONLY';
      if (!isEdit || isConvertingToPortal) {
        if (!formData.password) {
          newErrors.password = 'Temporary password is required.';
        } else {
          const passCheck = StaffUserService.isValidPassword(formData.password);
          if (!passCheck.valid) {
            newErrors.password = passCheck.message || 'Invalid password.';
          }
        }

        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match.';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Check if critical attributes changed in edit mode:
    if (isEdit && editingStaff) {
      // 1. Check if changing from Portal User to Staff Record Only
      if (
        editingStaff.accessType === 'PORTAL_USER' &&
        formData.accessType === 'STAFF_RECORD_ONLY' &&
        !confirmAccessTypeChange
      ) {
        setPendingValues(formData);
        setConfirmAccessTypeChange(true);
        return;
      }

      // 2. Check if changing assigned portal
      if (
        editingStaff.accessType === 'PORTAL_USER' &&
        formData.accessType === 'PORTAL_USER' &&
        editingStaff.assignedPortal &&
        editingStaff.assignedPortal !== formData.assignedPortal &&
        !confirmPortalChange
      ) {
        setPendingValues(formData);
        setConfirmPortalChange(true);
        return;
      }
    }

    onSave(formData);
  };

  const handleConfirmPortalChange = () => {
    if (pendingValues) {
      onSave(pendingValues);
    }
  };

  const handleConfirmAccessTypeChange = () => {
    if (pendingValues) {
      onSave(pendingValues);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[#e2eae5] overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-[#f6f8f7] border-b border-[#e2eae5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#e7f6f1] text-[#129b70] flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#111827] text-base">
                {isEdit ? 'Edit Hospital Staff User' : 'Add New Hospital Staff User'}
              </h3>
              <p className="text-xs text-[#52665e]">
                {isEdit
                  ? `Editing staff record: ${editingStaff?.employeeCode}`
                  : 'Register staff member with departmental assignments and optional portal access.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8b9e95] hover:text-[#111827] hover:bg-[#e2eae5] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* SECTION 1: PERSONAL INFORMATION */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-[#e2eae5]">
              <User className="h-4 w-4 text-[#129b70]" />
              <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                1. Personal Information
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  onBlur={handleNameBlur}
                  placeholder="e.g. Dr. Ahmed Raza"
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.fullName ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                />
                {errors.fullName && <p className="text-[10px] text-red-500 mt-1">{errors.fullName}</p>}
              </div>

              {/* Employee Code */}
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Employee Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.employeeCode}
                  onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                  placeholder="e.g. EMP-FD-05"
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs font-mono uppercase text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.employeeCode ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                />
                {errors.employeeCode && (
                  <p className="text-[10px] text-red-500 mt-1">{errors.employeeCode}</p>
                )}
              </div>

              {/* Father / Guardian Name */}
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Father / Guardian Name
                </label>
                <input
                  type="text"
                  value={formData.fatherGuardianName}
                  onChange={(e) => setFormData({ ...formData, fatherGuardianName: e.target.value })}
                  placeholder="e.g. Muhammad Raza"
                  className="w-full px-3 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
                />
              </div>

              {/* CNIC */}
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  CNIC <span className="text-[#8b9e95] font-normal">(xxxxx-xxxxxxx-x)</span>
                </label>
                <input
                  type="text"
                  value={formData.cnic}
                  onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  placeholder="35201-1234567-1"
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs font-mono text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.cnic ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                />
                {errors.cnic && <p className="text-[10px] text-red-500 mt-1">{errors.cnic}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Primary Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+92 300 1234567"
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.phone ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                />
                {errors.phone && <p className="text-[10px] text-red-500 mt-1">{errors.phone}</p>}
              </div>

              {/* Alternate Phone */}
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Alternate Phone
                </label>
                <input
                  type="text"
                  value={formData.alternatePhone}
                  onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                  placeholder="+92 321 7654321"
                  className="w-full px-3 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
                />
              </div>

              {/* Email */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. staff.member@sharif-saeed.hospital"
                  className="w-full px-3 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: EMPLOYMENT INFORMATION */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-[#e2eae5]">
              <Briefcase className="h-4 w-4 text-[#129b70]" />
              <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                2. Employment & Department Information
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Designation */}
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Designation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g. Senior Billing Officer"
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.designation ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                />
                {errors.designation && (
                  <p className="text-[10px] text-red-500 mt-1">{errors.designation}</p>
                )}
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.departmentId ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                >
                  <option value="">Select Hospital Department</option>
                  {activeDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
                {errors.departmentId && (
                  <p className="text-[10px] text-red-500 mt-1">{errors.departmentId}</p>
                )}
              </div>

              {/* Staff Category */}
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Staff Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.staffCategory}
                  onChange={(e) =>
                    setFormData({ ...formData, staffCategory: e.target.value as StaffCategory })
                  }
                  className="w-full px-3 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
                >
                  {STAFF_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as StaffStatus })
                  }
                  className="w-full px-3 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
                >
                  <option value="ACTIVE">Active (In Good Standing)</option>
                  <option value="INACTIVE">Inactive (Disabled)</option>
                  <option value="SUSPENDED">Suspended (Revoked)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: SYSTEM ACCESS */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-[#e2eae5]">
              <KeyRound className="h-4 w-4 text-[#129b70]" />
              <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                3. System Access & Workstation Credentials
              </h4>
            </div>

            {/* Access Type Radio Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                  formData.accessType === 'PORTAL_USER'
                    ? 'border-[#129b70] bg-[#e7f6f1]/40 ring-1 ring-[#129b70]'
                    : 'border-[#e2eae5] bg-[#f6f8f7] hover:border-[#c2e7db]'
                }`}
              >
                <input
                  type="radio"
                  name="accessType"
                  value="PORTAL_USER"
                  checked={formData.accessType === 'PORTAL_USER'}
                  onChange={() => setFormData({ ...formData, accessType: 'PORTAL_USER' })}
                  className="mt-0.5 text-[#129b70] focus:ring-[#129b70]"
                />
                <div>
                  <div className="text-xs font-bold text-[#111827]">Portal User</div>
                  <div className="text-[11px] text-[#52665e] mt-0.5 leading-relaxed">
                    Receives username, credentials and workstation portal login access.
                  </div>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                  formData.accessType === 'STAFF_RECORD_ONLY'
                    ? 'border-[#129b70] bg-[#e7f6f1]/40 ring-1 ring-[#129b70]'
                    : 'border-[#e2eae5] bg-[#f6f8f7] hover:border-[#c2e7db]'
                }`}
              >
                <input
                  type="radio"
                  name="accessType"
                  value="STAFF_RECORD_ONLY"
                  checked={formData.accessType === 'STAFF_RECORD_ONLY'}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      accessType: 'STAFF_RECORD_ONLY',
                      assignedPortal: '',
                      staffRole: '',
                      username: '',
                    })
                  }
                  className="mt-0.5 text-[#129b70] focus:ring-[#129b70]"
                />
                <div>
                  <div className="text-xs font-bold text-[#111827]">Staff Record Only</div>
                  <div className="text-[11px] text-[#52665e] mt-0.5 leading-relaxed">
                    Directory record only (doctors/nurses without dedicated workstations). No credentials.
                  </div>
                </div>
              </label>
            </div>

            {/* Portal User Detail Form Fields */}
            {formData.accessType === 'PORTAL_USER' && (
              <div className="p-4 bg-[#f6f8f7] border border-[#e2eae5] rounded-xl space-y-3.5 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Assigned Portal */}
                  <div>
                    <label className="block text-xs font-semibold text-[#52665e] mb-1">
                      Assigned Portal <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.assignedPortal}
                      onChange={(e) =>
                        handlePortalChange(e.target.value as StaffPortalKey | '')
                      }
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                        errors.assignedPortal ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                      }`}
                    >
                      <option value="">Select Operational Workstation</option>
                      {STAFF_PORTALS.map((portal) => (
                        <option key={portal.key} value={portal.key}>
                          {portal.label} Portal
                        </option>
                      ))}
                    </select>
                    {errors.assignedPortal && (
                      <p className="text-[10px] text-red-500 mt-1">{errors.assignedPortal}</p>
                    )}
                  </div>

                  {/* Staff Role (Portal-Dependent) */}
                  <div>
                    <label className="block text-xs font-semibold text-[#52665e] mb-1">
                      Staff Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.staffRole}
                      onChange={(e) => setFormData({ ...formData, staffRole: e.target.value })}
                      disabled={!formData.assignedPortal}
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        errors.staffRole ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                      }`}
                    >
                      <option value="">
                        {formData.assignedPortal
                          ? 'Select Role for Portal'
                          : 'First select a portal above'}
                      </option>
                      {formData.assignedPortal &&
                        STAFF_PORTAL_ROLES[formData.assignedPortal as StaffPortalKey]?.map(
                          (role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          )
                        )}
                    </select>
                    {errors.staffRole && (
                      <p className="text-[10px] text-red-500 mt-1">{errors.staffRole}</p>
                    )}
                  </div>

                  {/* Username */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#52665e] mb-1">
                      Workstation Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value.toLowerCase() })
                      }
                      placeholder="e.g. ahmed.raza"
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-mono text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                        errors.username ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                      }`}
                    />
                    {errors.username && (
                      <p className="text-[10px] text-red-500 mt-1">{errors.username}</p>
                    )}
                  </div>

                  {/* Password fields (required when adding or converting to Portal User) */}
                  {(!isEdit || editingStaff?.accessType === 'STAFF_RECORD_ONLY') && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-[#52665e] mb-1">
                          Temporary Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={(e) =>
                              setFormData({ ...formData, password: e.target.value })
                            }
                            placeholder="Min 8 chars, 1 letter, 1 number"
                            className={`w-full pl-3 pr-8 py-2 bg-white border rounded-lg text-xs font-mono text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                              errors.password
                                ? 'border-red-500'
                                : 'border-[#e2eae5] focus:border-[#129b70]'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b9e95] hover:text-[#111827] cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {errors.password && (
                          <p className="text-[10px] text-red-500 mt-1">{errors.password}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#52665e] mb-1">
                          Confirm Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={formData.confirmPassword}
                            onChange={(e) =>
                              setFormData({ ...formData, confirmPassword: e.target.value })
                            }
                            placeholder="Re-enter password"
                            className={`w-full pl-3 pr-8 py-2 bg-white border rounded-lg text-xs font-mono text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                              errors.confirmPassword
                                ? 'border-red-500'
                                : 'border-[#e2eae5] focus:border-[#129b70]'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b9e95] hover:text-[#111827] cursor-pointer"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {errors.confirmPassword && (
                          <p className="text-[10px] text-red-500 mt-1">
                            {errors.confirmPassword}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Require password change checkbox */}
                <div className="pt-2 border-t border-[#e2eae5]/80">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.requirePasswordChange}
                      onChange={(e) =>
                        setFormData({ ...formData, requirePasswordChange: e.target.checked })
                      }
                      className="rounded text-[#129b70] focus:ring-[#129b70] h-4 w-4"
                    />
                    <span className="text-xs text-[#52665e] font-medium">
                      Require password change on first login
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[#e2eae5] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#52665e] hover:text-[#111827] bg-[#f6f8f7] hover:bg-[#e2eae5] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              {isEdit ? 'Save Staff Changes' : 'Create Staff Record'}
            </button>
          </div>
        </form>

        {/* Portal Change Confirmation Sub-Dialog */}
        {confirmPortalChange && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-amber-200 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#111827]">Change Assigned Portal?</h4>
                  <p className="text-xs text-[#52665e] mt-1 leading-relaxed">
                    The user will lose access to the previous portal and will only be able to sign
                    in to the newly assigned portal (
                    <strong className="text-[#111827]">
                      {pendingValues?.assignedPortal?.toUpperCase()}
                    </strong>
                    ).
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e2eae5]">
                <button
                  type="button"
                  onClick={() => setConfirmPortalChange(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#52665e] hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPortalChange}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
                >
                  Confirm Portal Change
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Access Type Conversion to Staff Record Only Sub-Dialog */}
        {confirmAccessTypeChange && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-red-200 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-50 text-red-600 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#111827]">
                    Convert to Staff Record Only?
                  </h4>
                  <p className="text-xs text-[#52665e] mt-1 leading-relaxed">
                    This staff account will be converted into a directory-only record. Workstation
                    sign-in access and credentials will be removed. Historical activity records
                    will remain intact.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e2eae5]">
                <button
                  type="button"
                  onClick={() => setConfirmAccessTypeChange(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#52665e] hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAccessTypeChange}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                >
                  Confirm Access Removal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
