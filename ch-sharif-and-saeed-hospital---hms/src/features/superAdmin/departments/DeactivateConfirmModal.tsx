import React from 'react';
import { AlertTriangle, Power, CheckCircle2 } from 'lucide-react';
import { Department } from '../../../types/department';

interface DeactivateConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  department: Department | null;
}

export const DeactivateConfirmModal: React.FC<DeactivateConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  department,
}) => {
  if (!isOpen || !department) return null;

  const isDeactivating = department.status === 'Active';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 overflow-hidden">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isDeactivating
                ? 'bg-amber-100 text-amber-600'
                : 'bg-emerald-100 text-emerald-600'
            }`}
          >
            {isDeactivating ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <CheckCircle2 className="h-6 w-6" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isDeactivating
                ? 'Deactivate this department?'
                : `Activate Department "${department.name}"?`}
            </h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              {isDeactivating
                ? 'New operational transactions should no longer use this department. Existing historical records will remain preserved.'
                : 'This department will immediately become available for outpatient tokens, ward admissions, clinical ordering, and staff roster allocation.'}
            </p>

            <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700 block">
                {department.code} — {department.name}
              </span>
              <span className="text-slate-500 text-[11px]">
                Type: {department.type} • Current Status: {department.status}
              </span>
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
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors ${
              isDeactivating
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-[#08775A] hover:bg-[#0e7d5a]'
            }`}
          >
            {isDeactivating ? 'Deactivate Department' : 'Activate Department'}
          </button>
        </div>
      </div>
    </div>
  );
};
