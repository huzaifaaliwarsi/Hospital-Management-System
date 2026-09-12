import React from 'react';
import { ShieldAlert, AlertTriangle, Trash2, Power, X } from 'lucide-react';
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

  const isBlocked =
    department.doctorCount > 0 ||
    department.staffCount > 0 ||
    department.serviceCount > 0 ||
    department.wardCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 overflow-hidden">
        {isBlocked ? (
          // BLOCKED: Linked records safeguard
          <div>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Deletion Safeguard Blocked
                </h3>
                <p className="mt-1 text-xs text-rose-800 font-medium bg-rose-50 border border-rose-200 p-2.5 rounded-lg leading-relaxed">
                  This department is linked to hospital records and cannot be deleted. Deactivate it instead.
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  Permanent deletion of active clinical or administrative departments with operational links is strictly blocked to maintain data integrity.
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
        ) : (
          // ALLOWED: No linked records, standard confirmation required
          <div>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Department?
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <span className="font-bold text-slate-800">
                    "{department.name}" ({department.code})
                  </span>
                  ? This action is permanent and cannot be undone.
                </p>
                <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  ✓ Verified: No doctors, staff, services, or wards are currently linked to this department.
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-xs"
              >
                Delete Department
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
