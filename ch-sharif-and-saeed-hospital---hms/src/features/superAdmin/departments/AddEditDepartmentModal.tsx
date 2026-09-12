import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Search,
  User,
  ShieldCheck,
  Stethoscope,
  Info,
} from 'lucide-react';
import {
  Department,
  DepartmentFormValues,
  DepartmentHeadOption,
  DepartmentType,
} from '../../../types/department';
import { VALID_DEPARTMENT_TYPES } from '../../../services/departmentService';

interface AddEditDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: DepartmentFormValues) => void;
  departmentToEdit?: Department | null;
  existingDepartments: Department[];
  headOptions: DepartmentHeadOption[];
}

export const AddEditDepartmentModal: React.FC<AddEditDepartmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  departmentToEdit,
  existingDepartments,
  headOptions,
}) => {
  const isEditMode = !!departmentToEdit;

  const [formData, setFormData] = useState<DepartmentFormValues>({
    code: '',
    name: '',
    type: 'Clinical',
    description: '',
    headUserId: '',
    headName: 'Not Assigned',
    contactExtension: '',
    location: '',
    opdEnabled: true,
    observationEnabled: false,
    emergencyEnabled: false,
    admissionEnabled: true,
    pharmacyRelated: false,
    status: 'Active',
  });

  const [headSearch, setHeadSearch] = useState('');
  const [isHeadDropdownOpen, setIsHeadDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (departmentToEdit) {
      setFormData({
        code: departmentToEdit.code,
        name: departmentToEdit.name,
        type: departmentToEdit.type,
        description: departmentToEdit.description || '',
        headUserId: departmentToEdit.headUserId || '',
        headName: departmentToEdit.headName || 'Not Assigned',
        contactExtension: departmentToEdit.contactExtension === '—' ? '' : departmentToEdit.contactExtension,
        location: departmentToEdit.location === '—' ? '' : departmentToEdit.location,
        opdEnabled: departmentToEdit.opdEnabled,
        observationEnabled: departmentToEdit.observationEnabled,
        emergencyEnabled: departmentToEdit.emergencyEnabled,
        admissionEnabled: departmentToEdit.admissionEnabled,
        pharmacyRelated: departmentToEdit.pharmacyRelated,
        status: departmentToEdit.status,
      });
    } else {
      setFormData({
        code: '',
        name: '',
        type: 'Clinical',
        description: '',
        headUserId: '',
        headName: 'Not Assigned',
        contactExtension: '',
        location: '',
        opdEnabled: true,
        observationEnabled: false,
        emergencyEnabled: false,
        admissionEnabled: true,
        pharmacyRelated: false,
        status: 'Active',
      });
    }
    setErrors({});
    setHeadSearch('');
    setIsHeadDropdownOpen(false);
  }, [departmentToEdit, isOpen]);

  const filteredHeads = useMemo(() => {
    if (!headSearch.trim()) return headOptions;
    const q = headSearch.toLowerCase();
    return headOptions.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.designation.toLowerCase().includes(q) ||
        h.department.toLowerCase().includes(q) ||
        h.userId.toLowerCase().includes(q)
    );
  }, [headOptions, headSearch]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const trimmedCode = formData.code.trim().toUpperCase();
    if (!trimmedCode) {
      newErrors.code = 'Department Code is required.';
    } else {
      const codeRegex = /^[A-Z0-9-]+$/;
      if (!codeRegex.test(trimmedCode)) {
        newErrors.code = 'Department Code must contain only uppercase letters, numbers, and hyphens (e.g. DEP-MED).';
      } else {
        const isDuplicate = existingDepartments.some((d) => {
          if (isEditMode && departmentToEdit && d.id === departmentToEdit.id) {
            return false;
          }
          return d.code.toUpperCase() === trimmedCode;
        });
        if (isDuplicate) {
          newErrors.code = `Department Code "${trimmedCode}" is already in use. Codes must be unique.`;
        }
      }
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Department Name is required.';
    }

    if (!formData.type) {
      newErrors.type = 'Department Type is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      ...formData,
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#effaf5] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#08775A] text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEditMode ? 'Edit Hospital Department' : 'Add New Department'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditMode
                  ? `Update configuration and capabilities for ${departmentToEdit.code}`
                  : 'Register a primary hospital clinical or administrative department'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[calc(85vh-130px)] overflow-y-auto">
          {/* Edit Mode Code Warning */}
          {isEditMode && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-amber-900 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Important System Warning</span>
                <span>Changing the department code may affect linked records in the final system. Proceed with caution.</span>
              </div>
            </div>
          )}

          {/* Section 1: Basic Identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Department Code <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => {
                  setFormData({ ...formData, code: e.target.value.toUpperCase() });
                  if (errors.code) setErrors({ ...errors, code: '' });
                }}
                placeholder="e.g. DEP-MED"
                className={`w-full rounded-lg border px-3 py-2 text-xs font-mono font-bold uppercase transition-colors focus:outline-hidden focus:ring-2 ${
                  errors.code
                    ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:ring-rose-200'
                    : 'border-slate-300 bg-white text-slate-900 focus:border-[#08775A] focus:ring-[#08775A]/20'
                }`}
              />
              {errors.code ? (
                <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.code}</p>
              ) : (
                <p className="mt-1 text-[10px] text-slate-400">Unique uppercase code (e.g. DEP-MED, DEP-SURG)</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Department Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: '' });
                }}
                placeholder="e.g. General Medicine"
                className={`w-full rounded-lg border px-3 py-2 text-xs transition-colors focus:outline-hidden focus:ring-2 ${
                  errors.name
                    ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:ring-rose-200'
                    : 'border-slate-300 bg-white text-slate-900 focus:border-[#08775A] focus:ring-[#08775A]/20'
                }`}
              />
              {errors.name && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Department Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as DepartmentType })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#08775A] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20"
              >
                {VALID_DEPARTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status <span className="text-rose-600">*</span>
              </label>
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="radio"
                    name="status"
                    value="Active"
                    checked={formData.status === 'Active'}
                    onChange={() => setFormData({ ...formData, status: 'Active' })}
                    className="h-4 w-4 text-[#08775A] focus:ring-[#08775A]"
                  />
                  <span>Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="radio"
                    name="status"
                    value="Inactive"
                    checked={formData.status === 'Inactive'}
                    onChange={() => setFormData({ ...formData, status: 'Inactive' })}
                    className="h-4 w-4 text-slate-500 focus:ring-slate-400"
                  />
                  <span>Inactive</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description / Scope
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Clinical or operational mandate of this hospital department..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#08775A] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20"
            />
          </div>

          {/* Section 2: Head & Contact */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#08775A] mb-3">
              Department Leadership &amp; Physical Location
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Searchable Head Selector */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Head / In-charge
                </label>
                <div
                  onClick={() => setIsHeadDropdownOpen(!isHeadDropdownOpen)}
                  className="flex items-center justify-between w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs cursor-pointer hover:border-slate-400 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className={formData.headName === 'Not Assigned' ? 'text-slate-400 italic' : 'font-medium text-slate-800'}>
                      {formData.headName}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#08775A] font-semibold uppercase">Change</span>
                </div>

                {isHeadDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in duration-100">
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={headSearch}
                        onChange={(e) => setHeadSearch(e.target.value)}
                        placeholder="Search doctor or staff head..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-[#08775A]"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            headUserId: '',
                            headName: 'Not Assigned',
                          });
                          setIsHeadDropdownOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-slate-100 flex items-center justify-between text-slate-500 italic"
                      >
                        <span>— Not Assigned</span>
                        {formData.headName === 'Not Assigned' && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#08775A]" />
                        )}
                      </button>

                      {filteredHeads.map((h) => (
                        <button
                          key={h.userId}
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              headUserId: h.userId,
                              headName: h.name,
                            });
                            setIsHeadDropdownOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-[#effaf5] flex items-center justify-between group transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-[#08775A]">
                              {h.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {h.designation} • {h.userId}
                            </div>
                          </div>
                          {formData.headUserId === h.userId && (
                            <CheckCircle2 className="h-4 w-4 text-[#08775A]" />
                          )}
                        </button>
                      ))}

                      {filteredHeads.length === 0 && (
                        <p className="p-3 text-center text-xs text-slate-400">No matching doctors or staff found.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact / Extension
                </label>
                <input
                  type="text"
                  value={formData.contactExtension}
                  onChange={(e) => setFormData({ ...formData, contactExtension: e.target.value })}
                  placeholder="e.g. Ext. 101 / 102"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#08775A] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Location / Floor
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Ground Floor, Block A"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#08775A] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20"
              />
            </div>
          </div>

          {/* Section 3: Operational Capabilities */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#08775A]">
                Operational Capabilities &amp; Workflows
              </h4>
              <span className="text-[10px] text-slate-400">Select active hospital touchpoints</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 text-xs">
              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200 hover:border-[#c2e7db] cursor-pointer transition-colors select-none">
                <input
                  type="checkbox"
                  checked={formData.opdEnabled}
                  onChange={(e) => setFormData({ ...formData, opdEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-[#08775A] focus:ring-[#08775A] mt-0.5"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">OPD Enabled</span>
                  <span className="text-[11px] text-slate-500">Outpatient clinics, consultations, tokens</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200 hover:border-[#c2e7db] cursor-pointer transition-colors select-none">
                <input
                  type="checkbox"
                  checked={formData.observationEnabled}
                  onChange={(e) => setFormData({ ...formData, observationEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-[#08775A] focus:ring-[#08775A] mt-0.5"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">Observation Enabled</span>
                  <span className="text-[11px] text-slate-500">Short-stay holding bays, daycare infusions</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200 hover:border-[#c2e7db] cursor-pointer transition-colors select-none">
                <input
                  type="checkbox"
                  checked={formData.emergencyEnabled}
                  onChange={(e) => setFormData({ ...formData, emergencyEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-[#08775A] focus:ring-[#08775A] mt-0.5"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">Emergency Enabled</span>
                  <span className="text-[11px] text-slate-500">24/7 casualty intake, triage &amp; trauma code</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200 hover:border-[#c2e7db] cursor-pointer transition-colors select-none">
                <input
                  type="checkbox"
                  checked={formData.admissionEnabled}
                  onChange={(e) => setFormData({ ...formData, admissionEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-[#08775A] focus:ring-[#08775A] mt-0.5"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">Admission Enabled</span>
                  <span className="text-[11px] text-slate-500">Inpatient ward bed allocation &amp; IPD stay</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200 hover:border-[#c2e7db] cursor-pointer transition-colors select-none sm:col-span-2">
                <input
                  type="checkbox"
                  checked={formData.pharmacyRelated}
                  onChange={(e) => setFormData({ ...formData, pharmacyRelated: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-[#08775A] focus:ring-[#08775A] mt-0.5"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">Pharmacy Related</span>
                  <span className="text-[11px] text-slate-500">Direct dispensary link, formulary stocking &amp; medicine indenting</span>
                </div>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="border-t border-slate-200 pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#08775A] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0e7d5a] transition-colors shadow-sm"
            >
              {isEditMode ? 'Update Department' : 'Save Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
