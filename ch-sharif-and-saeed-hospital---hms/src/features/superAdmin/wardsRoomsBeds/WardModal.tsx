import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Ward, WardFormValues } from '../../../types/wardsRoomsBeds';
import { Department } from '../../../types/department';
import {
  WardsRoomsBedsService,
  VALID_WARD_TYPES,
} from '../../../services/wardsRoomsBedsService';

interface WardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: WardFormValues) => void;
  ward?: Ward | null;
  departments: Department[];
}

export const WardModal: React.FC<WardModalProps> = ({
  isOpen,
  onClose,
  onSave,
  ward,
  departments,
}) => {
  const isEditing = !!ward;

  const [formValues, setFormValues] = useState<WardFormValues>({
    code: '',
    name: '',
    departmentId: departments[0]?.id || '',
    wardType: 'General',
    floor: '1st Floor',
    location: '',
    genderPolicy: 'None',
    status: 'Active',
  });

  const [codeError, setCodeError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (ward) {
      setFormValues({
        code: ward.code,
        name: ward.name,
        departmentId: ward.departmentId,
        wardType: ward.wardType,
        floor: ward.floor || '1st Floor',
        location: ward.location || '',
        genderPolicy: ward.genderPolicy || 'None',
        status: ward.status,
      });
      setCodeError(null);
      setErrors({});
    } else {
      setFormValues({
        code: '',
        name: '',
        departmentId: departments.find((d) => d.status === 'Active')?.id || departments[0]?.id || '',
        wardType: 'General',
        floor: '1st Floor',
        location: '',
        genderPolicy: 'None',
        status: 'Active',
      });
      setCodeError(null);
      setErrors({});
    }
  }, [ward, isOpen, departments]);

  if (!isOpen) return null;

  const handleCodeChange = (val: string) => {
    const upper = val.toUpperCase().replace(/\s+/g, '-');
    setFormValues((prev) => ({ ...prev, code: upper }));

    // Code is optional — left blank, the backend auto-generates a unique one.
    if (!upper) {
      setCodeError(null);
      return;
    }
    const check = WardsRoomsBedsService.validateWardCode(upper, ward?.id);
    if (!check.isValid) {
      setCodeError(check.message || 'Invalid code.');
    } else {
      setCodeError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (formValues.code.trim()) {
      const check = WardsRoomsBedsService.validateWardCode(formValues.code, ward?.id);
      if (!check.isValid) {
        newErrors.code = check.message || 'Duplicate or invalid code.';
      }
    }

    if (!formValues.name.trim()) {
      newErrors.name = 'Ward name is required.';
    }

    if (!formValues.departmentId) {
      newErrors.departmentId = 'Department is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formValues);
  };

  return (
    <div
      id="ward-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="ward-modal-content"
        className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {isEditing ? 'Edit Inpatient Ward' : 'Add New Inpatient Ward'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure ward clinical department, floor location, and operational capacity
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ward Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ward Code
              </label>
              <input
                id="ward-form-code"
                type="text"
                value={formValues.code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="e.g. WRD-MED-01 (optional — auto-generated if blank)"
                className={`w-full px-3 py-2 text-xs font-mono font-medium rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-colors ${
                  codeError || errors.code
                    ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-500'
                    : 'border-slate-200 focus:ring-[#08775A]/20 focus:border-[#08775A]'
                }`}
              />
              {(codeError || errors.code) && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {codeError || errors.code}
                </p>
              )}
            </div>

            {/* Ward Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ward Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="ward-form-name"
                type="text"
                value={formValues.name}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. Male Medical Ward"
                className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-colors ${
                  errors.name
                    ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-500'
                    : 'border-slate-200 focus:ring-[#08775A]/20 focus:border-[#08775A]'
                }`}
              />
              {errors.name && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Department */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department <span className="text-rose-500">*</span>
              </label>
              <select
                id="ward-form-dept"
                value={formValues.departmentId}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, departmentId: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.status === 'Inactive' ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Ward Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ward Type <span className="text-rose-500">*</span>
              </label>
              <select
                id="ward-form-type"
                value={formValues.wardType}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, wardType: e.target.value as any }))
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              >
                {VALID_WARD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Floor */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Floor
              </label>
              <input
                id="ward-form-floor"
                type="text"
                value={formValues.floor}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, floor: e.target.value }))
                }
                placeholder="e.g. 2nd Floor"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              />
            </div>

            {/* Location / Wing */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Location / Wing
              </label>
              <input
                id="ward-form-location"
                type="text"
                value={formValues.location}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="e.g. East Wing"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              />
            </div>

            {/* Gender Policy */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gender Policy
              </label>
              <select
                id="ward-form-gender"
                value={formValues.genderPolicy}
                onChange={(e) =>
                  setFormValues((prev) => ({
                    ...prev,
                    genderPolicy: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              >
                <option value="None">None (Co-ed / All)</option>
                <option value="Male Only">Male Only</option>
                <option value="Female Only">Female Only</option>
                <option value="Pediatric">Pediatric</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-semibold text-slate-700">Ward Operational Status</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="wardStatus"
                  value="Active"
                  checked={formValues.status === 'Active'}
                  onChange={() => setFormValues((p) => ({ ...p, status: 'Active' }))}
                  className="text-[#08775A] focus:ring-[#08775A]"
                />
                <span className="text-xs text-slate-700 font-medium">Active (Operational)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="wardStatus"
                  value="Inactive"
                  checked={formValues.status === 'Inactive'}
                  onChange={() => setFormValues((p) => ({ ...p, status: 'Inactive' }))}
                  className="text-slate-500 focus:ring-slate-400"
                />
                <span className="text-xs text-slate-600 font-medium">Inactive (Suspended)</span>
              </label>
            </div>
          </div>

          {/* Audit trail if editing */}
          {isEditing && ward && (
            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex flex-wrap justify-between gap-2">
              <span>Created by: {ward.createdBy} • {ward.createdAt}</span>
              <span>Updated by: {ward.updatedBy} • {ward.updatedAt}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              id="ward-modal-cancel-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="ward-modal-submit-btn"
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors"
            >
              {isEditing ? 'Update Ward' : 'Save Ward'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
