import React from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Shift } from '../../../types/shift';

interface ShiftStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  shift: Shift | null;
}

export const ShiftStatusModal: React.FC<ShiftStatusModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  shift,
}) => {
  if (!isOpen || !shift) return null;

  const isDeactivating = shift.status === 'ACTIVE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                isDeactivating
                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}
            >
              {isDeactivating ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                {isDeactivating
                  ? `Deactivate Shift: ${shift.name}?`
                  : `Reactivate Shift: ${shift.name}?`}
              </h3>

              <div className="text-xs text-slate-600 leading-relaxed">
                {isDeactivating ? (
                  <p>
                    Deactivate this shift? It will no longer be available for new
                    Staff assignments. Existing historical references will remain
                    preserved.
                  </p>
                ) : (
                  <p>
                    Reactivate this shift and make it available for Staff
                    assignment?
                  </p>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-500 font-mono">
                Code: <span className="font-bold text-slate-800">{shift.code}</span> |
                Dept: <span className="text-slate-800">{shift.departmentName}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-xs transition-colors cursor-pointer ${
                isDeactivating
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-[#08775A] hover:bg-[#065f46]'
              }`}
            >
              {isDeactivating ? 'Deactivate Shift' : 'Reactivate Shift'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
