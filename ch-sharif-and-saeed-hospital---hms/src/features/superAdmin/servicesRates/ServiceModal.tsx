import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle2,
  Shield,
  Info,
  Stethoscope,
  FlaskConical,
  Scan,
  Pill,
  ExternalLink,
} from 'lucide-react';
import { HospitalService, ServiceFormValues, ServiceCategory } from '../../../types/serviceRates';
import { Department } from '../../../types/department';
import {
  ServiceRatesService,
  VALID_SERVICE_CATEGORIES,
  VALID_BILLING_UNITS,
} from '../../../services/serviceRatesService';
import { DepartmentService, fetchDepartments } from '../../../services/departmentService';
import { useRouter } from '../../../context/RouterContext';

export type ServiceStreamType = 'HOSPITAL' | 'LAB' | 'RADIOLOGY' | 'PHARMACY';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: ServiceFormValues) => void;
  service?: HospitalService | null;
  departments: Department[];
}

const HOSPITAL_CATEGORIES: ServiceCategory[] = [
  'Consultation',
  'Emergency',
  'Observation',
  'Admission',
  'Room / Bed',
  'Procedure',
  'Surgery',
  'Nursing',
  'Miscellaneous',
  'Other',
];

const LAB_CATEGORIES: ServiceCategory[] = [
  'Laboratory',
  'Diagnostic',
  'Other',
];

const RADIOLOGY_CATEGORIES: ServiceCategory[] = [
  'Radiology',
  'Diagnostic',
  'Other',
];

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  service,
  departments,
}) => {
  const { navigate } = useRouter();
  const isEditing = !!service;

  // Resilient internal departments state
  const [internalDepts, setInternalDepts] = useState<Department[]>(() => {
    return departments.length > 0 ? departments : DepartmentService.getDepartments();
  });

  useEffect(() => {
    if (departments.length > 0) {
      setInternalDepts(departments);
    } else if (isOpen) {
      fetchDepartments().then(setInternalDepts).catch(() => {});
    }
  }, [departments, isOpen]);

  const allDepartments = internalDepts.length > 0 ? internalDepts : departments;

  // Determine initial stream
  const determineInitialStream = (svc?: HospitalService | null): ServiceStreamType => {
    if (!svc) return 'HOSPITAL';
    const cat = (svc.category || '').toLowerCase();
    const deptName = (svc.departmentName || '').toLowerCase();
    const nameLower = (svc.name || '').toLowerCase();

    if (
      cat === 'radiology' ||
      deptName.includes('radiology') ||
      deptName.includes('imaging') ||
      nameLower.includes('x-ray') ||
      nameLower.includes('ultrasound') ||
      nameLower.includes('ct scan') ||
      nameLower.includes('mri')
    ) {
      return 'RADIOLOGY';
    }

    if (
      svc.serviceStream === 'LAB' ||
      cat === 'laboratory' ||
      cat === 'diagnostic' ||
      deptName.includes('lab') ||
      deptName.includes('pathology')
    ) {
      return 'LAB';
    }

    return 'HOSPITAL';
  };

  const [selectedStream, setSelectedStream] = useState<ServiceStreamType>('HOSPITAL');

  const [formValues, setFormValues] = useState<ServiceFormValues>({
    code: '',
    name: '',
    description: '',
    departmentId: allDepartments[0]?.id || '',
    category: 'Consultation',
    standardRate: 1500,
    billingUnit: 'Per Consultation',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    encounterType: 'NONE',
    isDefaultEncounterService: false,
    serviceStream: 'HOSPITAL',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (service) {
      const stream = determineInitialStream(service);
      setSelectedStream(stream);
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
        serviceStream: stream === 'LAB' ? 'LAB' : 'HOSPITAL',
      });
      setCodeError(null);
      setErrors({});
    } else {
      setSelectedStream('HOSPITAL');
      const clinicalDepts = allDepartments.filter(
        (d) => d.type !== 'Diagnostic' && d.type !== 'Pharmacy' && !d.pharmacyRelated && d.status === 'Active'
      );
      const defaultDept = clinicalDepts[0]?.id || allDepartments[0]?.id || '';

      setFormValues({
        code: '',
        name: '',
        description: '',
        departmentId: defaultDept,
        category: 'Consultation',
        standardRate: 1500,
        billingUnit: 'Per Consultation',
        panelEligible: true,
        manualRateOverrideAllowed: false,
        discountAllowed: true,
        status: 'Active',
        encounterType: 'NONE',
        isDefaultEncounterService: false,
        serviceStream: 'HOSPITAL',
      });
      setCodeError(null);
      setErrors({});
    }
  }, [service, isOpen, allDepartments]);

  // Filtered departments based on selectedStream
  const availableDepartments = useMemo(() => {
    const list = allDepartments;
    if (selectedStream === 'HOSPITAL') {
      const filtered = list.filter(
        (d) =>
          d.type !== 'Diagnostic' &&
          d.type !== 'Pharmacy' &&
          !d.pharmacyRelated &&
          !d.name.toLowerCase().includes('lab') &&
          !d.name.toLowerCase().includes('radiology') &&
          !d.name.toLowerCase().includes('imaging')
      );
      return filtered.length > 0 ? filtered : list;
    }
    if (selectedStream === 'LAB') {
      const filtered = list.filter(
        (d) =>
          d.name.toLowerCase().includes('lab') ||
          d.name.toLowerCase().includes('pathology') ||
          (d.type === 'Diagnostic' &&
            !d.name.toLowerCase().includes('radiology') &&
            !d.name.toLowerCase().includes('imaging'))
      );
      return filtered.length > 0 ? filtered : list;
    }
    if (selectedStream === 'RADIOLOGY') {
      const filtered = list.filter(
        (d) =>
          d.name.toLowerCase().includes('radiology') ||
          d.name.toLowerCase().includes('imaging') ||
          d.name.toLowerCase().includes('x-ray') ||
          d.name.toLowerCase().includes('ultrasound') ||
          d.type === 'Diagnostic'
      );
      return filtered.length > 0 ? filtered : list;
    }
    // Pharmacy
    const filtered = list.filter((d) => d.type === 'Pharmacy' || d.pharmacyRelated);
    return filtered.length > 0 ? filtered : list;
  }, [allDepartments, selectedStream]);

  // Auto-sync departmentId if currently empty or invalid
  useEffect(() => {
    if (availableDepartments.length > 0) {
      const isCurrentValid = availableDepartments.some((d) => d.id === formValues.departmentId);
      if (!isCurrentValid) {
        setFormValues((prev) => ({
          ...prev,
          departmentId: availableDepartments[0].id,
        }));
      }
    }
  }, [availableDepartments, formValues.departmentId]);

  // Handle switching streams via the Classification Selector
  const handleStreamChange = (newStream: ServiceStreamType) => {
    setSelectedStream(newStream);

    if (newStream === 'HOSPITAL') {
      const clinicalDepts = allDepartments.filter(
        (d) =>
          d.type !== 'Diagnostic' &&
          d.type !== 'Pharmacy' &&
          !d.pharmacyRelated &&
          !d.name.toLowerCase().includes('lab') &&
          !d.name.toLowerCase().includes('radiology')
      );
      const validDepts = clinicalDepts.length > 0 ? clinicalDepts : allDepartments;
      const isCurrentDeptValid = validDepts.some((d) => d.id === formValues.departmentId);
      const nextDeptId = isCurrentDeptValid ? formValues.departmentId : (validDepts[0]?.id || '');

      const isCurrentCatValid = HOSPITAL_CATEGORIES.includes(formValues.category);
      const nextCategory = isCurrentCatValid ? formValues.category : 'Consultation';

      setFormValues((prev) => ({
        ...prev,
        serviceStream: 'HOSPITAL',
        departmentId: nextDeptId,
        category: nextCategory,
        billingUnit: prev.billingUnit === 'Per Test' ? 'Per Consultation' : prev.billingUnit,
      }));
    } else if (newStream === 'LAB') {
      const labDepts = allDepartments.filter(
        (d) =>
          d.name.toLowerCase().includes('lab') ||
          d.name.toLowerCase().includes('pathology') ||
          (d.type === 'Diagnostic' && !d.name.toLowerCase().includes('radiology'))
      );
      const validDepts = labDepts.length > 0 ? labDepts : allDepartments;
      const isCurrentDeptValid = validDepts.some((d) => d.id === formValues.departmentId);
      const nextDeptId = isCurrentDeptValid ? formValues.departmentId : (validDepts[0]?.id || '');

      setFormValues((prev) => ({
        ...prev,
        serviceStream: 'LAB',
        departmentId: nextDeptId,
        category: 'Laboratory',
        billingUnit: prev.billingUnit === 'Per Consultation' ? 'Per Test' : prev.billingUnit,
      }));
    } else if (newStream === 'RADIOLOGY') {
      const radDepts = allDepartments.filter(
        (d) =>
          d.name.toLowerCase().includes('radiology') ||
          d.name.toLowerCase().includes('imaging') ||
          d.type === 'Diagnostic'
      );
      const validDepts = radDepts.length > 0 ? radDepts : allDepartments;
      const isCurrentDeptValid = validDepts.some((d) => d.id === formValues.departmentId);
      const nextDeptId = isCurrentDeptValid ? formValues.departmentId : (validDepts[0]?.id || '');

      setFormValues((prev) => ({
        ...prev,
        serviceStream: 'LAB',
        departmentId: nextDeptId,
        category: 'Radiology',
        billingUnit: prev.billingUnit === 'Per Consultation' ? 'Per Test' : prev.billingUnit,
      }));
    }
  };

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

    // Pharmacy Catalog can NEVER be saved into Charge Master!
    if (selectedStream === 'PHARMACY') {
      return;
    }

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

    onSave({
      ...formValues,
      serviceStream: selectedStream === 'LAB' || selectedStream === 'RADIOLOGY' ? 'LAB' : 'HOSPITAL',
    });
  };

  return (
    <div
      id="service-modal-backdrop"
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
    >
      <div
        id="service-modal-content"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden mt-8 mb-12 sm:mt-12 sm:mb-16 flex flex-col max-h-[calc(100vh-5rem)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/80 shrink-0">
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
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden grow">
          <div className="p-6 space-y-5 overflow-y-auto grow">
            {/* 4-Way Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Service Stream / Classification <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                {/* 1. Hospital Services */}
                <button
                  id="stream-select-hospital"
                  type="button"
                  onClick={() => handleStreamChange('HOSPITAL')}
                  className={`relative flex flex-col items-start p-2.5 text-left rounded-xl border transition-all ${
                    selectedStream === 'HOSPITAL'
                      ? 'border-[#08775A] bg-[#effaf5] shadow-xs ring-1 ring-[#08775A]'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Stethoscope
                        className={`w-3.5 h-3.5 ${
                          selectedStream === 'HOSPITAL' ? 'text-[#08775A]' : 'text-slate-500'
                        }`}
                      />
                      <span>Hospital</span>
                    </div>
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        selectedStream === 'HOSPITAL'
                          ? 'border-[#08775A] bg-[#08775A]'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedStream === 'HOSPITAL' && (
                        <div className="w-1 h-1 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    In-house care, ER, OBS, nursing
                  </p>
                </button>

                {/* 2. Outsourced Laboratory */}
                <button
                  id="stream-select-lab"
                  type="button"
                  onClick={() => handleStreamChange('LAB')}
                  className={`relative flex flex-col items-start p-2.5 text-left rounded-xl border transition-all ${
                    selectedStream === 'LAB'
                      ? 'border-indigo-600 bg-indigo-50/60 shadow-xs ring-1 ring-indigo-600'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <FlaskConical
                        className={`w-3.5 h-3.5 ${
                          selectedStream === 'LAB' ? 'text-indigo-600' : 'text-slate-500'
                        }`}
                      />
                      <span>Outsourced Lab</span>
                    </div>
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        selectedStream === 'LAB'
                          ? 'border-indigo-600 bg-indigo-600'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedStream === 'LAB' && (
                        <div className="w-1 h-1 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Pathology, CBC, urine, culture
                  </p>
                </button>

                {/* 3. Outsourced Radiology */}
                <button
                  id="stream-select-radiology"
                  type="button"
                  onClick={() => handleStreamChange('RADIOLOGY')}
                  className={`relative flex flex-col items-start p-2.5 text-left rounded-xl border transition-all ${
                    selectedStream === 'RADIOLOGY'
                      ? 'border-purple-600 bg-purple-50/60 shadow-xs ring-1 ring-purple-600'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Scan
                        className={`w-3.5 h-3.5 ${
                          selectedStream === 'RADIOLOGY' ? 'text-purple-600' : 'text-slate-500'
                        }`}
                      />
                      <span>Outsourced Rad</span>
                    </div>
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        selectedStream === 'RADIOLOGY'
                          ? 'border-purple-600 bg-purple-600'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedStream === 'RADIOLOGY' && (
                        <div className="w-1 h-1 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    X-Ray, Ultrasound, CT, MRI
                  </p>
                </button>

                {/* 4. Pharmacy Catalog */}
                <button
                  id="stream-select-pharmacy"
                  type="button"
                  onClick={() => handleStreamChange('PHARMACY')}
                  className={`relative flex flex-col items-start p-2.5 text-left rounded-xl border transition-all ${
                    selectedStream === 'PHARMACY'
                      ? 'border-amber-600 bg-amber-50/60 shadow-xs ring-1 ring-amber-600'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Pill
                        className={`w-3.5 h-3.5 ${
                          selectedStream === 'PHARMACY' ? 'text-amber-600' : 'text-slate-500'
                        }`}
                      />
                      <span>Pharmacy</span>
                    </div>
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        selectedStream === 'PHARMACY'
                          ? 'border-amber-600 bg-amber-600'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedStream === 'PHARMACY' && (
                        <div className="w-1 h-1 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Medicine &amp; consumables
                  </p>
                </button>
              </div>
            </div>

          {/* Conditional Display for PHARMACY stream */}
          {selectedStream === 'PHARMACY' ? (
            <div className="p-6 bg-gradient-to-br from-amber-50/80 via-emerald-50/30 to-slate-50 rounded-xl border border-amber-200/80 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-700 mt-0.5 shrink-0">
                  <Pill className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Medicines Are Managed Exclusively in the Central Pharmacy Catalog
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Medicines, injections, drips, tablets, and medical consumables require batch
                    numbers, expiry dates, formula/salts, and FEFO inventory stock ledger tracking.
                    To prevent phantom items, they are maintained in the{' '}
                    <strong className="text-slate-900">Pharmacy Catalog (MedicineMaster)</strong>{' '}
                    and cannot be created as flat Charge Master services.
                  </p>
                </div>
              </div>

              <div className="bg-white/80 p-3.5 rounded-lg border border-amber-200/60 text-xs text-slate-700 space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                  Revenue & Billing Stream Separation:
                </div>
                <p className="text-slate-600 pl-5">
                  Inpatient medicine requests from Admission route directly to Pharmacy. Front Desk
                  billing combines Pharmacy invoices with Hospital & Lab charges while preserving
                  isolated department revenue accounts.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  id="open-pharmacy-catalog-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/super-admin/pharmacy_integration');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs transition-colors"
                >
                  <Pill className="w-4 h-4" />
                  <span>Open Pharmacy Catalog</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Charge Master Service Form Fields */}
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
                    placeholder={
                      selectedStream === 'RADIOLOGY'
                        ? 'e.g. Chest X-Ray PA View, Abdominal Ultrasound, CT Scan'
                        : selectedStream === 'LAB'
                        ? 'e.g. Complete Blood Picture (CP / CBC)'
                        : 'e.g. Executive Cardiology Consultation'
                    }
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
                    {availableDepartments.map((d) => (
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
                    {(selectedStream === 'RADIOLOGY'
                      ? RADIOLOGY_CATEGORIES
                      : selectedStream === 'LAB'
                      ? LAB_CATEGORIES
                      : HOSPITAL_CATEGORIES
                    ).map((cat) => (
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
                  placeholder={
                    selectedStream === 'RADIOLOGY'
                      ? 'Imaging views, preparation, contrast instructions, turnaround time...'
                      : selectedStream === 'LAB'
                      ? 'Sample requirements, fasting status, turnaround time...'
                      : 'Clinical indications, equipment used, or billing instructions...'
                  }
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
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      id="service-toggle-panel"
                      type="checkbox"
                      checked={formValues.panelEligible}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, panelEligible: e.target.checked }))
                      }
                      className="mt-0.5 rounded text-[#08775A] focus:ring-[#08775A]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Panel Eligible
                      </span>
                      <span className="text-[11px] text-slate-500 block leading-tight">
                        Applies corporate tariff
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      id="service-toggle-discount"
                      type="checkbox"
                      checked={formValues.discountAllowed}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, discountAllowed: e.target.checked }))
                      }
                      className="mt-0.5 rounded text-[#08775A] focus:ring-[#08775A]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Discount Allowed
                      </span>
                      <span className="text-[11px] text-slate-500 block leading-tight">
                        Cashier concessions
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      id="service-toggle-override"
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
                      <span className="text-xs font-semibold text-slate-800 block">
                        Rate Override
                      </span>
                      <span className="text-[11px] text-slate-500 block leading-tight">
                        Manual cashier edit
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Encounter Type Mapping (Only for Hospital Services) */}
              {selectedStream === 'HOSPITAL' && (
                <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                        Front Desk Intake Mapping (V7.2)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Link this service to automatic fee charging at Front Desk walk-in intake.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Encounter Type Link
                      </label>
                      <select
                        id="service-form-encounter-type"
                        value={formValues.encounterType || 'NONE'}
                        onChange={(e) =>
                          setFormValues((prev) => ({
                            ...prev,
                            encounterType: e.target.value as any,
                            isDefaultEncounterService:
                              e.target.value === 'NONE' ? false : prev.isDefaultEncounterService,
                          }))
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
                      >
                        <option value="NONE">None (Regular Billable Service)</option>
                        <option value="OPD">OPD Consultation</option>
                        <option value="OBSERVATION">Observation Stay</option>
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
              )}

              {/* Status Selection */}
              <div className="flex items-center justify-between pt-1">
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
            </>
          )}

          {/* Audit Trail for Editing */}
          {isEditing && service && selectedStream !== 'PHARMACY' && (
            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex flex-wrap justify-between gap-2">
              <span>
                Created by: {service.createdBy} • {service.createdAt}
              </span>
              <span>
                Updated by: {service.updatedBy} • {service.updatedAt}
              </span>
            </div>
          )}

          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-200 bg-slate-50/70 shrink-0">
            <button
              id="service-modal-cancel-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            {selectedStream !== 'PHARMACY' && (
              <button
                id="service-modal-submit-btn"
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors"
              >
                {isEditing ? 'Update Service' : 'Save Service Record'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
