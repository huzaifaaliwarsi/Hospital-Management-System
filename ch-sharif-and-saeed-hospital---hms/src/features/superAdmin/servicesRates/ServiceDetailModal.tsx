import React from 'react';
import {
  X,
  FileCheck,
  Building2,
  Tag,
  Receipt,
  ShieldCheck,
  Percent,
  Clock,
  UserCheck,
  Edit2,
  PowerOff,
  Power,
  ShieldAlert,
} from 'lucide-react';
import { HospitalService } from '../../../types/serviceRates';

interface ServiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: HospitalService | null;
  onEdit: (service: HospitalService) => void;
  onToggleStatus: (service: HospitalService) => void;
}

export const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({
  isOpen,
  onClose,
  service,
  onEdit,
  onToggleStatus,
}) => {
  if (!isOpen || !service) return null;

  return (
    <div
      id="service-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="service-detail-modal-content"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#08775A] flex items-center justify-center font-bold">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  {service.code}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    service.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {service.status}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">{service.name}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          {/* Description */}
          {service.description ? (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Clinical Indication / Description
              </span>
              <p className="text-slate-700 leading-relaxed">{service.description}</p>
            </div>
          ) : (
            <div className="text-slate-400 italic">No description provided.</div>
          )}

          {/* Pricing & Billing Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                Standard Tariff
              </span>
              <div className="text-lg font-bold text-emerald-900 mt-1">
                {service.currency} {(service.standardRate ?? 0).toLocaleString('en-PK')}
              </div>
              <span className="text-[11px] text-emerald-700 block mt-0.5">
                {service.billingUnit}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Department
              </span>
              <div className="text-xs font-bold text-slate-800 mt-1 line-clamp-1">
                {service.departmentName}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Category: {service.category}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Panel Eligibility
              </span>
              <div className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                {service.panelEligible ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Eligible for Corporate Panels</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4 text-slate-400" />
                    <span>Non-Panel Private Only</span>
                  </>
                )}
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                {service.linkedPanelRuleCount ?? 0} linked panel agreements
              </span>
            </div>
          </div>

          {/* Billing Rules & Operational Flags */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Billing Control Policies
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Manual Rate Override Allowed:</span>
                <span
                  className={`font-semibold ${
                    service.manualRateOverrideAllowed ? 'text-amber-700' : 'text-slate-500'
                  }`}
                >
                  {service.manualRateOverrideAllowed ? 'Yes (Authorized Only)' : 'No (Strict Master Rate)'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Discount Concession Allowed:</span>
                <span
                  className={`font-semibold ${
                    service.discountAllowed ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  {service.discountAllowed ? 'Yes (Follows Discount Matrix)' : 'No (Non-Discountable)'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Linked Hospital Invoices:</span>
                <span className="font-bold text-slate-800">
                  {(service.linkedInvoiceCount ?? 0).toLocaleString()} invoices
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Current Orderability:</span>
                <span
                  className={`font-bold ${
                    service.status === 'Active' ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {service.status === 'Active' ? 'Available at Front Desk' : 'Suspended from Billing'}
                </span>
              </div>
            </div>
          </div>

          {/* Audit Trail */}
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5 space-y-1.5 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>Created By:</span>
              <span className="font-semibold text-slate-700">{service.createdBy}</span>
            </div>
            <div className="flex justify-between">
              <span>Created At:</span>
              <span className="font-medium text-slate-700">{service.createdAt}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated By:</span>
              <span className="font-semibold text-slate-700">{service.updatedBy}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated At:</span>
              <span className="font-medium text-slate-700">{service.updatedAt}</span>
            </div>
            {service.statusChangedBy && (
              <div className="flex justify-between pt-1 border-t border-slate-200/60">
                <span>Status Changed By:</span>
                <span className="font-semibold text-slate-700">
                  {service.statusChangedBy} ({service.statusChangedAt})
                </span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              onClick={() => onToggleStatus(service)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                service.status === 'Active'
                  ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {service.status === 'Active' ? (
                <>
                  <PowerOff className="w-3.5 h-3.5" />
                  Deactivate Service
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5" />
                  Activate Service
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onClose();
                  onEdit(service);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Service
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
