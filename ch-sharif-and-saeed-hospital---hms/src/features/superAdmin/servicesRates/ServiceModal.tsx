import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, Shield, Info } from 'lucide-react';
import { HospitalService, ServiceFormValues } from '../../../types/serviceRates';
import { Department } from '../../../types/department';
import {
  ServiceRatesService,
  VALID_SERVICE_CATEGORIES,
  VALID_BILLING_UNITS,
} from '../../../services/serviceRatesService';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: ServiceFormValues) => void;
  service?: HospitalService | null;
  departments: Department[];
}

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  service,
  departments,
}) => {
  const isEditing = !!service;

  const [formValues, setFormValues] = useState<ServiceFormValues>({
    code: '',
    name: '',
    description: '',
    departmentId: departments[0]?.id || '',
    category: 'Consultation',
    standardRate: 1500,
    billingUnit: 'Per Consultation',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    encounterType: 'NONE',
    isDefaultEncounterService: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [codeValidating, setCodeValidating] = useState<boolean>(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (service) {
      setFormValues({
        code: service.code,
        name: service.name,
        description: service.description || '',
        departmentId: service.departmentId,
        category: service.category,
        standardRate: service.standardRate,
        billingUnit: service.billingUnit,
        panelEligible: service.panelEligible,
        manualRateOverrideAllowed: service.manualRateOverrideAllowed,
        discountAllowed: service.discountAllowed,
        status: service.status,
        encounterType: service.encounterType || 'NONE',
        isDefaultEncounterService: !!service.isDefaultEncounterService,
      });
      setCodeError(null);
      setErrors({});
    } else {
      setFormValues({
        code: '',
        name: '',
        description: '',
        departmentId: departments.find((d) => d.status === 'Active')?.id || departments[0]?.id || '',
        category: 'Consultation',
        standardRate: 1500,
        billingUnit: 'Per Consultation',
        panelEligible: true,
        manualRateOverrideAllowed: false,
        discountAllowed: true,
        status: 'Active',
        encounterType: 'NONE',
        isDefaultEncounterService: false,
      });
      setCodeError(null);
      setErrors({});
    }
  }, [service, isOpen, departments]);

  if (!isOpen) return null;

  const handleCodeChange = (val: string) => {
    const upper = val.toUpperCase().replace(/\s+/g, '-');
    setFormValues((prev) => ({ ...prev, code: upper }));

    // Code is optional — left blank, the backend auto-generates a unique one.
    if (!upper) {
      setCodeError(null);
      return;
    }

    const check = ServiceRatesService.validateServiceCode(upper, service?.id);
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
      const check = ServiceRatesService.validateServiceCode(formValues.code, service?.id);
      if (!check.isValid) {
        newErrors.code = check.message || 'Duplicate or invalid code.';
      }
    }

    if (!formValues.name.trim()) {
      newErrors.name = 'Service name is required.';
    }

    if (!formValues.departmentId) {
      newErrors.departmentId = 'Department is required.';
    }

    if (formValues.standardRate < 0 || isNaN(formValues.standardRate)) {
      newErrors.standardRate = 'Rate cannot be negative.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formValues);
  };

  return (
    <div
      id="service-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="service-modal-content"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {isEditing ? 'Edit Charge Master Service' : 'Add New Billable Service'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure hospital tariff, clinical classification, and panel coverage rules
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Service Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Service Code
              </label>
              <input
                id="service-form-code"
                type="text"
                value={formValues.code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="e.g. SRV-OPD-001 (optional — auto-generated if blank)"
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

            {/* Service Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Service Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="service-form-name"
                type="text"
                value={formValues.name}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. Executive Cardiology Consultation"
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
                id="service-form-dept"
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

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                id="service-form-category"
                value={formValues.category}
                onChange={(e) =>
                  setFormValues((prev) => ({
                    ...prev,
                    category: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              >
                {VALID_SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Clinical Specification (Optional)
            </label>
            <textarea
              id="service-form-description"
              rows={2}
              value={formValues.description}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Clinical indications, equipment used, or billing instructions..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Standard Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Standard Rate (PKR) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  PKR
                </span>
                <input
                  id="service-form-rate"
                  type="number"
                  min="0"
                  step="10"
                  value={formValues.standardRate}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      standardRate: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full pl-12 pr-3 py-2 text-xs font-bold text-slate-900 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                />
              </div>
              {errors.standardRate && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.standardRate}
                </p>
              )}
            </div>

            {/* Billing Unit */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Billing Unit <span className="text-rose-500">*</span>
              </label>
              <select
                id="service-form-unit"
                value={formValues.billingUnit}
                onChange={(e) =>
                  setFormValues((prev) => ({
                    ...prev,
                    billingUnit: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
              >
                {VALID_BILLING_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Toggles Panel */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Billing & Panel Policies
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Panel Eligible */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  id="service-form-panel"
                  type="checkbox"
                  checked={formValues.panelEligible}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      panelEligible: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded text-[#08775A] focus:ring-[#08775A]"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-700 block">
                    Panel Eligible
                  </span>
                  <span className="text-[11px] text-slate-500 block leading-tight">
                    Corporate & Insurance tariffs apply
                  </span>
                </div>
              </label>

              {/* Discount Allowed */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  id="service-form-discount"
                  type="checkbox"
                  checked={formValues.discountAllowed}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      discountAllowed: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded text-[#08775A] focus:ring-[#08775A]"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-700 block">
                    Discount Allowed
                  </span>
                  <span className="text-[11px] text-slate-500 block leading-tight">
                    Concessions allowed at counter
                  </span>
                </div>
              </label>

              {/* Manual Override Allowed */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  id="service-form-override"
                  type="checkbox"
                  checked={formValues.manualRateOverrideAllowed}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      manualRateOverrideAllowed: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded text-[#08775A] focus:ring-[#08775A]"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-700 block">
                    Manual Override
                  </span>
                  <span className="text-[11px] text-slate-500 block leading-tight">
                    Authorizes manual rate edits
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Encounter Mapping (V7.2) */}
          <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/80 space-y-3">
            <span className="text-[11px] font-bold text-[#08775A] uppercase tracking-wider block">
              Encounter Service Mapping (Front Desk)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Encounter Type
                </label>
                <select
                  value={formValues.encounterType || 'NONE'}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      encounterType: e.target.value as any,
                      isDefaultEncounterService: e.target.value === 'NONE' ? false : prev.isDefaultEncounterService,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                >
                  <option value="NONE">None (General Service)</option>
                  <option value="OPD">OPD Consultation</option>
                  <option value="OBSERVATION">Observation Care</option>
                  <option value="EMERGENCY">Emergency Care</option>
                </select>
              </div>

              {formValues.encounterType && formValues.encounterType !== 'NONE' && (
                <div className="pt-3 sm:pt-4">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formValues.isDefaultEncounterService || false}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          isDefaultEncounterService: e.target.checked,
                        }))
                      }
                      className="mt-0.5 rounded text-[#08775A] focus:ring-[#08775A]"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Default {formValues.encounterType} Service
                      </span>
                      <span className="text-[11px] text-slate-500 block leading-tight">
                        Auto-charged at Front Desk walk-in intake
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Status Selection */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-semibold text-slate-700">Service Status</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="serviceStatus"
                  value="Active"
                  checked={formValues.status === 'Active'}
                  onChange={() =>
                    setFormValues((prev) => ({ ...prev, status: 'Active' }))
                  }
                  className="text-[#08775A] focus:ring-[#08775A]"
                />
                <span className="text-xs text-slate-700 font-medium">Active (Billable)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="serviceStatus"
                  value="Inactive"
                  checked={formValues.status === 'Inactive'}
                  onChange={() =>
                    setFormValues((prev) => ({ ...prev, status: 'Inactive' }))
                  }
                  className="text-slate-500 focus:ring-slate-400"
                />
                <span className="text-xs text-slate-600 font-medium">Inactive (Hidden)</span>
              </label>
            </div>
          </div>

          {/* Audit Trail for Editing */}
          {isEditing && service && (
            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex flex-wrap justify-between gap-2">
              <span>Created by: {service.createdBy} • {service.createdAt}</span>
              <span>Updated by: {service.updatedBy} • {service.updatedAt}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              id="service-modal-cancel-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="service-modal-submit-btn"
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors"
            >
              {isEditing ? 'Update Service' : 'Save Service Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
