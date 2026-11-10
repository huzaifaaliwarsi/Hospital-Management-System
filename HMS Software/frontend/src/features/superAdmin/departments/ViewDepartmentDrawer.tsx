import React from 'react';
import {
  X,
  Building2,
  UserCheck,
  MapPin,
  CreditCard,
  Stethoscope,
  Users,
  FileCheck,
  LayoutGrid,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { Department } from '../../../types/department';
import { useToast } from '../../../context/ToastContext';

interface ViewDepartmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  department: Department | null;
  onEdit?: (department: Department) => void;
}

export const ViewDepartmentDrawer: React.FC<ViewDepartmentDrawerProps> = ({
  isOpen,
  onClose,
  department,
  onEdit,
}) => {
  const toast = useToast();

  if (!isOpen || !department) return null;

  const handleRelatedNav = (target: 'Doctors' | 'Services' | 'Wards') => {
    toast.info(
      `Navigating to ${target} filtered by department "${department.name}" (${department.code}).`,
      `Linked ${target}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l border-slate-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#effaf5] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#08775A] text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#08775A] bg-white px-2 py-0.5 rounded border border-[#c2e7db]">
                  {department.code}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    department.status === 'Active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {department.status}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                {department.name}
              </h3>
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

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* Section 1: Overview & Scope */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Department Classification &amp; Mandate
            </span>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                Type: {department.type}
              </span>
            </div>
            <p className="text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed">
              {department.description || 'No specific clinical description documented for this department.'}
            </p>
          </div>

          {/* Section 2: Leadership, Location & Extension */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Leadership &amp; Physical Infrastructure
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <UserCheck className="h-3.5 w-3.5 text-[#08775A]" />
                  <span className="text-[10px] uppercase font-semibold">Head / In-charge</span>
                </div>
                <div className="font-bold text-slate-900 text-xs">
                  {department.headName}
                </div>
                {department.headUserId && (
                  <span className="text-[10px] text-slate-400 font-mono">ID: {department.headUserId}</span>
                )}
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <CreditCard className="h-3.5 w-3.5 text-[#08775A]" />
                  <span className="text-[10px] uppercase font-semibold">Fixed Pricing / Fee</span>
                </div>
                <div className="font-bold text-slate-900 text-xs">
                  {department.fixedPrice != null ? (
                    <span className="text-emerald-700 font-bold">
                      PKR {department.fixedPrice.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">(Fixed)</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 font-normal">Optional / Free</span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs sm:col-span-2">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-[#08775A]" />
                  <span className="text-[10px] uppercase font-semibold">Hospital Location / Floor</span>
                </div>
                <div className="font-bold text-slate-900 text-xs">
                  {department.floor || department.location || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Operational Capabilities */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Active Operational Capabilities
            </span>
            <div className="flex flex-wrap gap-2">
              {department.opdEnabled && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#08775A]" />
                  OPD Enabled
                </span>
              )}
              {department.observationEnabled && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#08775A]" />
                  Observation Enabled
                </span>
              )}
              {department.emergencyEnabled && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                  Emergency Enabled (24/7)
                </span>
              )}
              {department.admissionEnabled && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#08775A]" />
                  Admission Enabled (IPD)
                </span>
              )}
              {department.pharmacyRelated && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                  Pharmacy Related
                </span>
              )}
              {!department.opdEnabled &&
                !department.observationEnabled &&
                !department.emergencyEnabled &&
                !department.admissionEnabled &&
                !department.pharmacyRelated && (
                  <span className="text-slate-400 italic">No direct clinical workflows enabled (Support / Admin only).</span>
                )}
            </div>
          </div>

          {/* Section 4: Live Metric Counts & Linked Records */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Staffing &amp; Linked Hospital Records
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                <span className="text-[10px] font-medium text-slate-500 block">Doctors</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">{department.doctorCount}</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                <span className="text-[10px] font-medium text-slate-500 block">Staff</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">{department.staffCount}</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                <span className="text-[10px] font-medium text-slate-500 block">Services / Tariffs</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">{department.serviceCount}</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                <span className="text-[10px] font-medium text-slate-500 block">Linked Wards</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">{department.wardCount}</div>
              </div>
            </div>

            {/* Related Navigation Links */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRelatedNav('Doctors')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-[#effaf5] hover:text-[#08775A] hover:border-[#c2e7db] text-xs font-semibold transition-colors"
              >
                <Stethoscope className="h-3.5 w-3.5" />
                <span>View Doctors</span>
                <ArrowUpRight className="h-3 w-3 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => handleRelatedNav('Services')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-[#effaf5] hover:text-[#08775A] hover:border-[#c2e7db] text-xs font-semibold transition-colors"
              >
                <FileCheck className="h-3.5 w-3.5" />
                <span>View Services</span>
                <ArrowUpRight className="h-3 w-3 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => handleRelatedNav('Wards')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-[#effaf5] hover:text-[#08775A] hover:border-[#c2e7db] text-xs font-semibold transition-colors"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>View Wards</span>
                <ArrowUpRight className="h-3 w-3 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Section 5: Audit Trail & Accountability */}
          <div className="border-t border-slate-200 pt-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Audit Trace &amp; Accountability
            </span>
            <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-[11px]">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500">Created By:</span>
                <span className="font-semibold text-slate-800">{department.createdBy}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-t border-slate-200/60">
                <span className="text-slate-500">Created On:</span>
                <span className="text-slate-700">{department.createdAt}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-t border-slate-200/60">
                <span className="text-slate-500">Last Updated By:</span>
                <span className="font-semibold text-slate-800">{department.updatedBy}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-t border-slate-200/60">
                <span className="text-slate-500">Last Updated Date:</span>
                <span className="text-slate-700">{department.updatedAt}</span>
              </div>
              {department.statusChangedBy && (
                <div className="flex justify-between items-center py-0.5 border-t border-slate-200/60">
                  <span className="text-slate-500">Status Changed By:</span>
                  <span className="font-semibold text-slate-800">{department.statusChangedBy}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(department);
              }}
              className="rounded-lg bg-[#08775A] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0e7d5a] transition-colors shadow-xs"
            >
              Edit Department
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
