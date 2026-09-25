import React, { useState, useEffect } from 'react';
import { X, AlertCircle, User, Briefcase, Stethoscope, ShieldQuestion, CheckCircle2, Clock, Wallet } from 'lucide-react';
import {
  StaffUser,
  StaffUserFormValues,
  StaffStatus,
  StaffCategory,
  STAFF_CATEGORIES,
  SalaryBasis,
  SALARY_BASIS_OPTIONS,
} from '../../../types/staffUser';
import { Department } from '../../../types/department';
import { HospitalService } from '../../../types/serviceRates';
import { Shift } from '../../../types/shift';
import { StaffUserService } from '../../../services/staffUserService';
import { formatCnicInput } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';

interface StaffUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: StaffUserFormValues) => void;
  editingStaff?: StaffUser | null;
  departments: Department[];
  services: HospitalService[];
  shifts: Shift[];
}

const emptyForm = (): StaffUserFormValues => ({
  fullName: '',
  employeeCode: StaffUserService.getNextNumericEmployeeCode(),
  fatherGuardianName: '',
  cnic: '',
  dateOfBirth: '',
  phone: '',
  alternatePhone: '',
  email: '',
  designation: '',
  staffCategory: 'Nurse',
  status: 'ACTIVE',
  departmentIds: [],
  serviceIds: [],
  assignedShiftId: '',
  salaryEnabled: false,
  salaryBasis: 'MONTHLY',
  baseSalary: '',
  salaryTaxMethod: '',
  salaryTaxValue: '',
  salaryEffectiveFrom: new Date().toISOString().slice(0, 10),
});

export const StaffUserModal: React.FC<StaffUserModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingStaff,
  departments,
  services,
  shifts,
}) => {
  const toast = useToast();
  const isEdit = Boolean(editingStaff);
  const activeDepartments = departments.filter((d) => d.status === 'Active');
  const activeServices = services.filter((s) => s.status === 'Active');
  const activeShifts = shifts.filter((s) => s.status === 'ACTIVE');

  const [formData, setFormData] = useState<StaffUserFormValues>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (editingStaff) {
      setFormData({
        fullName: editingStaff.fullName,
        employeeCode: editingStaff.employeeCode,
        fatherGuardianName: editingStaff.fatherGuardianName || '',
        cnic: editingStaff.cnic || '',
        dateOfBirth: editingStaff.dateOfBirth ? String(editingStaff.dateOfBirth).slice(0, 10) : '',
        phone: editingStaff.phone,
        alternatePhone: editingStaff.alternatePhone || '',
        email: editingStaff.email || '',
        designation: editingStaff.designation || '',
        staffCategory: editingStaff.staffCategory,
        status: editingStaff.status,
        departmentIds: editingStaff.departmentIds ?? [],
        serviceIds: editingStaff.assignedServiceIds ?? [],
        assignedShiftId: editingStaff.assignedShiftId || '',
        salaryEnabled: false,
        salaryBasis: 'MONTHLY',
        baseSalary: '',
        salaryTaxMethod: '',
        salaryTaxValue: '',
        salaryEffectiveFrom: new Date().toISOString().slice(0, 10),
      });

      // Prefill the current Salary Profile (if any) so re-saving doesn't blank it out.
      StaffUserService.fetchFullProfile(editingStaff.id)
        .then((profile) => {
          const current = profile?.salary?.current;
          if (!current) return;
          setFormData((prev) => ({
            ...prev,
            salaryEnabled: true,
            salaryBasis: current.salaryBasis === 'PER_DAY' ? 'PER_DAY' : 'MONTHLY',
            baseSalary: current.baseAmount != null ? Number(current.baseAmount) : '',
            salaryTaxMethod: (current.salaryTaxMethod as 'PERCENTAGE' | 'FIXED' | '') || '',
            salaryTaxValue: current.salaryTaxValue != null ? Number(current.salaryTaxValue) : '',
            salaryEffectiveFrom: current.effectiveFrom ? String(current.effectiveFrom).slice(0, 10) : new Date().toISOString().slice(0, 10),
          }));
        })
        .catch(() => {});
    } else {
      setFormData(emptyForm());
    }
    setErrors({});
  }, [isOpen, editingStaff]);

  if (!isOpen) return null;

  const isDoctor = formData.staffCategory === 'Doctor';
  const isPortalEligible = StaffUserService.isPortalEligible(formData.staffCategory);

  // staff.md §4/§7 — OPD/Observation/Emergency eligibility is derived from
  // the encounterType of the services actually selected, shown live so the
  // admin can see it without leaving this form.
  const derivedEncounterEligibility = Array.from(
    new Set(
      formData.serviceIds
        .map((id) => activeServices.find((s) => s.id === id)?.encounterType)
        .filter((t) => !!t && t !== 'NONE') as string[],
    ),
  );

  const toggleDepartment = (deptId: string) => {
    setFormData((prev) => {
      const current = prev.departmentIds;
      const updated = current.includes(deptId)
        ? current.filter((id) => id !== deptId)
        : [...current, deptId];
      return { ...prev, departmentIds: updated };
    });
  };

  const toggleService = (serviceId: string) => {
    setFormData((prev) => {
      const current = prev.serviceIds;
      const updated = current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId];
      return { ...prev, serviceIds: updated };
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full Name is required.';
    if (!formData.fatherGuardianName.trim()) newErrors.fatherGuardianName = 'Father / Guardian Name is required.';

    if (!formData.phone.trim()) {
      newErrors.phone = 'Mobile number is required.';
    } else if (!StaffUserService.isValidPhone(formData.phone)) {
      newErrors.phone = 'Mobile must be a valid Pakistani number (e.g. 0300-1234567).';
    }

    if (!formData.cnic.trim()) {
      newErrors.cnic = 'CNIC is required.';
    } else if (!StaffUserService.isValidCNIC(formData.cnic)) {
      newErrors.cnic = 'CNIC must follow format xxxxx-xxxxxxx-x.';
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of Birth is required.';
    } else if (!StaffUserService.isValidDateOfBirth(formData.dateOfBirth)) {
      newErrors.dateOfBirth = 'Date of Birth must be a valid past date.';
    }

    if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (isDoctor && formData.departmentIds.length === 0) {
      newErrors.departmentIds = 'Select at least one Clinical Department.';
    }
    if (isDoctor && formData.serviceIds.length === 0) {
      newErrors.serviceIds = 'Select at least one Assigned Service.';
    }

    setErrors(newErrors);
    const errKeys = Object.keys(newErrors);
    if (errKeys.length > 0) {
      toast.error(newErrors[errKeys[0]], 'Validation Error');
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#e2eae5] overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-[#f6f8f7] border-b border-[#e2eae5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#e7f6f1] text-[#129b70] flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#111827] text-base">
                {isEdit ? 'Edit Staff Record' : 'Add New Staff'}
              </h3>
              <p className="text-xs text-[#52665e]">
                {isEdit
                  ? `Editing: ${editingStaff?.employeeCode}`
                  : 'Core HR record only. Portal access, salary and commission are set up separately.'}
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
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-[#e2eae5]">
              <User className="h-4 w-4 text-[#129b70]" />
              <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">Basic Information</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Dr. Ahmed Raza"
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.fullName ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                />
                {errors.fullName && <p className="text-[10px] text-red-500 mt-1">{errors.fullName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Father / Guardian Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fatherGuardianName}
                  onChange={(e) => setFormData({ ...formData, fatherGuardianName: e.target.value })}
                  placeholder="e.g. Muhammad Raza"
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.fatherGuardianName ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                />
                {errors.fatherGuardianName && <p className="text-[10px] text-red-500 mt-1">{errors.fatherGuardianName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0300-1234567"
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.phone ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                />
                {errors.phone && <p className="text-[10px] text-red-500 mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  CNIC <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.cnic}
                  onChange={(e) => setFormData({ ...formData, cnic: formatCnicInput(e.target.value) })}
                  maxLength={15}
                  placeholder="35201-1234567-1"
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs font-mono text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.cnic ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                />
                {errors.cnic && <p className="text-[10px] text-red-500 mt-1">{errors.cnic}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  lang="en-GB"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.dateOfBirth ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                />
                {errors.dateOfBirth && <p className="text-[10px] text-red-500 mt-1">{errors.dateOfBirth}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Staff Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.staffCategory}
                  onChange={(e) => setFormData({ ...formData, staffCategory: e.target.value as StaffCategory })}
                  className="w-full px-3 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
                >
                  {STAFF_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#52665e]">Employee Code</label>
                  <span className="text-[10px] font-bold text-[#08775A] bg-[#effaf5] px-1.5 py-0.5 rounded border border-[#c2e7db]">
                    Auto-Generated
                  </span>
                </div>
                <input
                  type="text"
                  readOnly
                  value={formData.employeeCode}
                  className="w-full px-3 py-2 bg-slate-100 border border-[#e2eae5] rounded-lg text-xs font-mono font-bold text-[#08775A] cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as StaffStatus })}
                  className="w-full px-3 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Optional details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-[#e2eae5]">
              <Briefcase className="h-4 w-4 text-[#129b70]" />
              <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                Optional Details <span className="text-[10px] font-normal normal-case text-[#8b9e95]">(rest can be set later from Staff 360)</span>
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">Designation</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g. Senior Billing Officer"
                  className="w-full px-3 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1">Alternate Phone</label>
                <input
                  type="text"
                  value={formData.alternatePhone}
                  onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#52665e] mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-3 py-2 bg-[#f6f8f7] border rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 ${
                    errors.email ? 'border-red-500' : 'border-[#e2eae5] focus:border-[#129b70]'
                  }`}
                />
                {errors.email && <p className="text-[10px] text-red-500 mt-1">{errors.email}</p>}
              </div>
            </div>
          </div>

          {/* Shift & Salary Setup — optional Add Wizard steps (staff.md §2 steps 5/7), any category */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-[#e2eae5]">
              <Clock className="h-4 w-4 text-[#129b70]" />
              <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                Shift &amp; Salary Setup <span className="text-[10px] font-normal normal-case text-[#8b9e95]">(optional)</span>
              </h4>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#52665e] mb-1">Assigned Shift</label>
              <select
                value={formData.assignedShiftId}
                onChange={(e) => setFormData({ ...formData, assignedShiftId: e.target.value })}
                className="w-full px-3 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
              >
                <option value="">No shift assigned</option>
                {activeShifts.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                ))}
              </select>
              {activeShifts.length === 0 && (
                <p className="text-[10px] text-[#8b9e95] mt-1">No shifts configured yet in Shift Management.</p>
              )}
            </div>

            <div className="p-3.5 bg-[#f8faf9] border border-[#e2eae5] rounded-xl space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#111827] cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.salaryEnabled}
                  onChange={(e) => setFormData({ ...formData, salaryEnabled: e.target.checked, baseSalary: e.target.checked ? formData.baseSalary || 30000 : '' })}
                  className="rounded border-[#e2eae5] text-[#08775A] focus:ring-[#08775A]"
                />
                <Wallet className="h-3.5 w-3.5 text-[#08775A]" />
                Enable Salary Profile
              </label>

              {formData.salaryEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#52665e] mb-1">Salary Type</label>
                    <select
                      value={formData.salaryBasis}
                      onChange={(e) => setFormData({ ...formData, salaryBasis: e.target.value as SalaryBasis })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#e2eae5] rounded-lg text-xs text-[#111827]"
                    >
                      {SALARY_BASIS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#52665e] mb-1">Base Amount (PKR)</label>
                    <input
                      type="number"
                      onWheel={(e) => e.currentTarget.blur()}
                      min={0}
                      step={500}
                      value={formData.baseSalary}
                      onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#e2eae5] rounded-lg text-xs font-mono text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#52665e] mb-1">Tax Method</label>
                    <select
                      value={formData.salaryTaxMethod}
                      onChange={(e) => setFormData({ ...formData, salaryTaxMethod: e.target.value as 'PERCENTAGE' | 'FIXED' | '' })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#e2eae5] rounded-lg text-xs text-[#111827]"
                    >
                      <option value="">No Tax</option>
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FIXED">Fixed Amount</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#52665e] mb-1">
                      Tax Value {formData.salaryTaxMethod === 'PERCENTAGE' ? '(%)' : '(PKR)'}
                    </label>
                    <input
                      type="number"
                      onWheel={(e) => e.currentTarget.blur()}
                      min={0}
                      disabled={!formData.salaryTaxMethod}
                      value={formData.salaryTaxValue}
                      onChange={(e) => setFormData({ ...formData, salaryTaxValue: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#e2eae5] rounded-lg text-xs font-mono text-[#111827] disabled:opacity-50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#52665e] mb-1">Effective From</label>
                    <input
                      lang="en-GB"
                      type="date"
                      value={formData.salaryEffectiveFrom}
                      onChange={(e) => setFormData({ ...formData, salaryEffectiveFrom: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#e2eae5] rounded-lg text-xs text-[#111827]"
                    />
                    <p className="text-[10px] text-[#8b9e95] mt-1">Saving here starts a new effective-dated profile — history is kept, never overwritten. Commission (doctors) stays separate in Doctor Commission.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Doctor assignments */}
          {isDoctor && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-[#e2eae5]">
                <Stethoscope className="h-4 w-4 text-[#08775A]" />
                <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">Doctor Assignments</h4>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1.5">
                  Clinical Department(s) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activeDepartments.map((dept) => {
                    const checked = formData.departmentIds.includes(dept.id);
                    return (
                      <label
                        key={dept.id}
                        className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          checked
                            ? 'bg-[#effaf5] border-[#129b70] text-[#0a6b4d]'
                            : 'bg-[#f6f8f7] border-[#e2eae5] text-[#52665e] hover:border-[#129b70]/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDepartment(dept.id)}
                          className="mt-0.5 rounded border-[#e2eae5] text-[#129b70] focus:ring-[#129b70]"
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold leading-tight truncate">{dept.name}</div>
                          <div className="text-[10px] text-[#8b9e95] font-mono">{dept.code}</div>
                        </div>
                      </label>
                    );
                  })}
                  {activeDepartments.length === 0 && (
                    <p className="col-span-full text-[11px] text-[#8b9e95]">No active departments configured yet.</p>
                  )}
                </div>
                {errors.departmentIds && <p className="text-[10px] text-red-500 mt-1">{errors.departmentIds}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52665e] mb-1.5">
                  Assigned Services <span className="text-red-500">*</span>
                  <span className="ml-2 text-[10px] font-normal text-[#8b9e95]">Which services this doctor performs</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {activeServices.map((svc) => {
                    const checked = formData.serviceIds.includes(svc.id);
                    return (
                      <label
                        key={svc.id}
                        className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          checked
                            ? 'bg-[#effaf5] border-[#129b70] text-[#0a6b4d]'
                            : 'bg-[#f6f8f7] border-[#e2eae5] text-[#52665e] hover:border-[#129b70]/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleService(svc.id)}
                          className="mt-0.5 rounded border-[#e2eae5] text-[#129b70] focus:ring-[#129b70]"
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold leading-tight truncate">{svc.name}</div>
                          <div className="text-[10px] text-[#8b9e95] font-mono flex items-center gap-1.5">
                            {svc.code}
                            {svc.encounterType && svc.encounterType !== 'NONE' && (
                              <span className="text-[9px] font-bold text-[#08775A] bg-[#effaf5] px-1 py-0.5 rounded border border-[#c2e7db] normal-case">
                                {svc.encounterType}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                  {activeServices.length === 0 && (
                    <p className="col-span-full text-[11px] text-[#8b9e95]">No active services configured yet.</p>
                  )}
                </div>
                {errors.serviceIds && <p className="text-[10px] text-red-500 mt-1">{errors.serviceIds}</p>}
                <p className="text-[10px] text-[#8b9e95] mt-1.5">
                  Commission rate per service is configured separately in Doctor Commission.
                </p>
                {derivedEncounterEligibility.length > 0 && (
                  <p className="text-[10px] text-[#08775A] font-semibold mt-1">
                    Based on the services selected above, this doctor will appear in the {derivedEncounterEligibility.join(' / ')} consulting-doctor list{derivedEncounterEligibility.length > 1 ? 's' : ''}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Portal Access notice */}
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              editingStaff?.accessType === 'PORTAL_USER'
                ? 'bg-[#effaf5] border-[#c2e7db] text-[#08775A]'
                : isPortalEligible
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            {editingStaff?.accessType === 'PORTAL_USER' ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Portal Access Granted</span>
                  Manage this staff member's HMS login from the Portal Access action on the staff list — not from this form.
                </div>
              </>
            ) : isPortalEligible ? (
              <>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Portal Access Required</span>
                  This category typically needs HMS login access. Grant it after saving, from the Portal Access action on the staff list — never set up here.
                </div>
              </>
            ) : (
              <>
                <ShieldQuestion className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Staff Record Only</span>
                  No HMS login by default for this category. An Admin can still grant Portal Access later if needed.
                </div>
              </>
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
      </div>
    </div>
  );
};
