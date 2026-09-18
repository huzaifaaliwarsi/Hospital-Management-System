import React from 'react';
import { Trash2, AlertTriangle, Power, X, Loader2, ShieldCheck } from 'lucide-react';
import { Department } from '../../../types/department';

interface DeleteSafeguardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
  onDeactivateInstead: () => void;
  department: Department | null;
  isDeleting?: boolean;
}

export const DeleteSafeguardModal: React.FC<DeleteSafeguardModalProps> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  onDeactivateInstead,
  department,
  isDeleting = false,
}) => {
  if (!isOpen || !department) return null;

  const hasLinkedRecords =
    department.doctorCount > 0 ||
    department.staffCount > 0 ||
    department.serviceCount > 0 ||
    department.wardCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 border border-rose-200">
            <Trash2 className="h-6 w-6" />
          </div>
          <div className="pr-4">
            <h3 className="text-base font-bold text-slate-900">
              Delete Department
            </h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900 font-semibold">{department.name}</strong>{' '}
              <span className="font-mono text-slate-500 font-medium">({department.code})</span>?
            </p>
          </div>
        </div>

        {/* Linked Records Notice */}
        {hasLinkedRecords ? (
          <div className="mt-4 rounded-xl bg-emerald-50/80 border border-emerald-200 p-3 text-xs text-emerald-950">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Staff & Doctor Protection Guarantee</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed mb-2">
              Doctors and staff will <strong>not</strong> be deleted. Any assigned personnel will safely remain in the hospital workforce and be preserved.
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-white/90 p-2 rounded-lg border border-emerald-100 font-medium">
              <div className="flex justify-between text-slate-600">
                <span>Doctors:</span>
                <span className="font-bold text-emerald-800">{department.doctorCount} (Preserved)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Staff:</span>
                <span className="font-bold text-emerald-800">{department.staffCount} (Preserved)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Services:</span>
                <span className="font-bold text-slate-900">{department.serviceCount}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Wards:</span>
                <span className="font-bold text-slate-900">{department.wardCount}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 leading-relaxed">
            This action cannot be undone. All non-transactional metadata for this department will be removed.
          </div>
        )}

        {/* Actions Footer */}
        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          {department.status === 'Active' && (
            <button
              type="button"
              onClick={onDeactivateInstead}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              <Power className="h-3.5 w-3.5 text-amber-600" />
              Deactivate Instead
            </button>
          )}

          <button
            type="button"
            onClick={onConfirmDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 active:bg-rose-800 transition-colors shadow-xs disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Delete Department
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
