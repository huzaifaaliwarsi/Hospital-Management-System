import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, AlertCircle, ShieldAlert } from 'lucide-react';
import { StaffUser } from '../../../types/staffUser';
import { StaffUserService } from '../../../services/staffUserService';
import { useAuth } from '../../../context/AuthContext';

interface StaffUserDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffUser | null;
  onSuccess: (deletedId: string) => void;
  onSwitchToDeactivate: (staff: StaffUser) => void;
}

export const StaffUserDeleteModal: React.FC<StaffUserDeleteModalProps> = ({
  isOpen,
  onClose,
  staff,
  onSuccess,
  onSwitchToDeactivate,
}) => {
  const { currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !staff) return null;

  const hasActivity = staff.linkedActivityCount > 0;

  const handleDelete = () => {
    setError(null);
    const res = StaffUserService.deleteStaffUser(staff.id, currentUser);
    if (!res.success) {
      setError(res.error || 'Failed to delete staff account.');
      return;
    }
    onSuccess(staff.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e2eae5] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#f6f8f7] border-b border-[#e2eae5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#111827] text-sm">Delete Staff Record</h3>
              <p className="text-xs text-[#52665e]">{staff.employeeCode} • {staff.fullName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8b9e95] hover:text-[#111827] hover:bg-[#e2eae5] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {hasActivity ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-amber-800">
                    Deletion Blocked — Historical Activity Safeguard
                  </h4>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    This staff account has recorded hospital activity ({staff.linkedActivityCount}{' '}
                    transactions) and cannot be permanently deleted. Deactivate it instead.
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#52665e] leading-relaxed">
                Hospital compliance and auditing standards mandate that accounts with patient
                records, cash receipts, or store activity remain permanently in the audit archive.
                You may safely deactivate this account to prevent future logins.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-semibold text-[#52665e] hover:bg-[#e2eae5] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSwitchToDeactivate(staff);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gray-800 hover:bg-gray-900 rounded-lg shadow-sm cursor-pointer"
                >
                  Deactivate Account Instead
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-xs">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Permanent Deletion Warning</span>
                  <span>
                    This staff member has no recorded transactions. Deletion will permanently erase
                    all personal details, contact data, and workstation credentials.
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#52665e] leading-relaxed">
                Permanently delete staff member <strong>{staff.fullName}</strong> (
                {staff.employeeCode})? This action cannot be undone.
              </p>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-semibold text-[#52665e] hover:bg-[#e2eae5] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm cursor-pointer"
                >
                  Permanently Delete Staff Record
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
