import React from 'react';
import {
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  PowerOff,
  Power,
} from 'lucide-react';
import { HospitalService } from '../../../types/serviceRates';

interface ServicesTableProps {
  services: HospitalService[];
  onView: (service: HospitalService) => void;
  onEdit: (service: HospitalService) => void;
  onToggleStatus: (service: HospitalService) => void;
  onDelete: (service: HospitalService) => void;
  onResetFilters: () => void;
}

export const ServicesTable: React.FC<ServicesTableProps> = ({
  services,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
  onResetFilters,
}) => {
  if (services.length === 0) {
    return (
      <div
        id="services-empty-state"
        className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#08775A] flex items-center justify-center mx-auto mb-3">
          <FileCheck className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">No Services Found</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
          No services match the selected filters.
        </p>
        <button
          onClick={onResetFilters}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#08775A] bg-[#effaf5] border border-[#c2e7db] rounded-lg hover:bg-[#e2f6ee] transition-colors"
        >
          Reset All Filters
        </button>
      </div>
    );
  }

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Consultation':
      case 'Emergency':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Observation':
      case 'Admission':
      case 'Room / Bed':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Laboratory':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Radiology':
      case 'Diagnostic':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Procedure':
      case 'Surgery':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Nursing':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div
      id="services-table-container"
      className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table id="services-master-table" className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Service Code</th>
              <th className="py-3 px-4">Service Name</th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-right">Standard Rate</th>
              <th className="py-3 px-4">Billing Unit</th>
              <th className="py-3 px-4 text-center">Panel Eligible</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {services.map((service) => {
              const isLinked = (service.linkedInvoiceCount ?? 0) > 0;

              return (
                <tr
                  key={service.id}
                  id={`service-row-${service.id}`}
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  {/* Service Code */}
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 tracking-tight whitespace-nowrap">
                    {service.code}
                  </td>

                  {/* Service Name */}
                  <td className="py-3 px-4 max-w-[260px]">
                    <div className="font-semibold text-slate-800">{service.name}</div>
                    {service.description && (
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {service.description}
                      </div>
                    )}
                  </td>

                  {/* Department */}
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                    {service.departmentName}
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${getCategoryBadgeClass(
                        service.category
                      )}`}
                    >
                      {service.category}
                    </span>
                  </td>

                  {/* Standard Rate */}
                  <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                    {service.currency} {(service.standardRate ?? 0).toLocaleString('en-PK')}
                  </td>

                  {/* Billing Unit */}
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                    {service.billingUnit}
                  </td>

                  {/* Panel Eligible */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {service.panelEligible ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck className="w-3 h-3" />
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        No
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {service.status === 'Active' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-[#effaf5] px-2.5 py-0.5 rounded-full border border-[#c2e7db]">
                        <CheckCircle2 className="w-3 h-3 text-[#08775A]" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                        <XCircle className="w-3 h-3 text-slate-400" />
                        Inactive
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {/* View Details */}
                      <button
                        id={`service-view-btn-${service.id}`}
                        onClick={() => onView(service)}
                        title="View Full Service Details"
                        className="p-1.5 text-slate-500 hover:text-[#08775A] hover:bg-[#effaf5] rounded-md transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Edit */}
                      <button
                        id={`service-edit-btn-${service.id}`}
                        onClick={() => onEdit(service)}
                        title="Edit Service Record"
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Toggle Status */}
                      <button
                        id={`service-toggle-status-btn-${service.id}`}
                        onClick={() => onToggleStatus(service)}
                        title={
                          service.status === 'Active'
                            ? 'Deactivate Service'
                            : 'Activate Service'
                        }
                        className={`p-1.5 rounded-md transition-colors ${
                          service.status === 'Active'
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {service.status === 'Active' ? (
                          <PowerOff className="w-4 h-4" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                      </button>

                      {/* Delete (with guardrail) */}
                      <button
                        id={`service-delete-btn-${service.id}`}
                        onClick={() => onDelete(service)}
                        title={
                          isLinked
                            ? `Cannot delete: linked to ${service.linkedInvoiceCount ?? 0} invoice(s)`
                            : 'Delete Service'
                        }
                        className={`p-1.5 rounded-md transition-colors ${
                          isLinked
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
