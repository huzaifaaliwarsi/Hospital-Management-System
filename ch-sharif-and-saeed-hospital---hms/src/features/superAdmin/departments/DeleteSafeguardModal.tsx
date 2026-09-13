import React from 'react';
import { ShieldAlert, AlertTriangle, Power, X } from 'lucide-react';
import { Department } from '../../../types/department';

interface DeleteSafeguardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
  onDeactivateInstead: () => void;
  department: Department | null;
}

export const DeleteSafeguardModal: React.FC<DeleteSafeguardModalProps> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  onDeactivateInstead,
  department,
}) => {
  if (!isOpen || !department) return null;

  const hasLinkedRecords =
    department.doctorCount > 0 ||
    department.staffCount > 0 ||
    department.serviceCount > 0 ||
    department.wardCount > 0;

  // The backend never permanently deletes a department (same data-integrity
  // stance as Staff) — always show the safeguarded state, regardless of
  // linked-record counts, rather than offering a "Delete" action that would
  // only fail against the real API.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 overflow-hidden">
        {(() => {
          return (
          <div>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Permanent Deletion Not Available
                </h3>
                <p className="mt-1 text-xs text-rose-800 font-medium bg-rose-50 border border-rose-200 p-2.5 rounded-lg leading-relaxed">
                  {hasLinkedRecords
                    ? 'This department is linked to hospital records and cannot be deleted. Deactivate it instead.'
                    : 'Departments cannot be permanently deleted for audit-trail and data-integrity reasons. Deactivate it instead.'}
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  Permanent deletion of departments is disabled hospital-wide to preserve historical reporting, even once every linked record is removed.
                </p>

                {/* Linked count breakdown */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="flex justify-between text-slate-700">
                    <span>Doctors:</span>
                    <span className="font-bold text-slate-900">{department.doctorCount}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Staff Members:</span>
                    <span className="font-bold text-slate-900">{department.staffCount}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Services / Tariffs:</span>
                    <span className="font-bold text-slate-900">{department.serviceCount}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Assigned Wards:</span>
                    <span className="font-bold text-slate-900">{department.wardCount}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              {department.status === 'Active' && (
                <button
                  type="button"
                  onClick={onDeactivateInstead}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-xs"
                >
                  <Power className="h-3.5 w-3.5" />
                  Deactivate Instead
                </button>
              )}
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
};
