import React, { useState } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { StaffUser, StaffStatus } from '../../../types/staffUser';
import { StaffUserService } from '../../../services/staffUserService';
import { useAuth } from '../../../context/AuthContext';

interface StaffUserStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffUser | null;
  targetStatus: StaffStatus | null;
  onSuccess: (updatedStaff: StaffUser) => void;
}

export const StaffUserStatusModal: React.FC<StaffUserStatusModalProps> = ({
  isOpen,
  onClose,
  staff,
  targetStatus,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !staff || !targetStatus) return null;

  const isPortalUser = staff.accessType === 'PORTAL_USER';

  const getModalConfig = () => {
    switch (targetStatus) {
      case 'ACTIVE':
        return {
          title: 'Reactivate Staff Member',
          icon: <CheckCircle className="h-5 w-5 text-[#0e7d5a]" />,
          iconBg: 'bg-[#e7f6f1]',
          buttonClass: 'bg-[#129b70] hover:bg-[#0e7d5a]',
          confirmText: 'Reactivate Account',
          description: isPortalUser
            ? `Reactivate staff member ${staff.fullName} (${staff.employeeCode})? Workstation access to ${staff.assignedPortal?.toUpperCase()} Portal will be restored.`
            : `Reactivate staff directory record for ${staff.fullName} (${staff.employeeCode})?`,
          isReasonRequired: false,
        };
      case 'INACTIVE':
        return {
          title: 'Deactivate Staff Member',
          icon: <XCircle className="h-5 w-5 text-gray-600" />,
          iconBg: 'bg-gray-100',
          buttonClass: 'bg-gray-800 hover:bg-gray-900',
          confirmText: 'Deactivate Account',
          description: isPortalUser
            ? `Deactivate staff member ${staff.fullName} (${staff.employeeCode})? They will not be able to sign in to ${staff.assignedPortal?.toUpperCase()} Portal until reactivated.`
            : `Mark ${staff.fullName} (${staff.employeeCode}) as inactive in the staff directory?`,
          isReasonRequired: false,
        };
      case 'SUSPENDED':
        return {
          title: 'Suspend Staff Member',
          icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
          iconBg: 'bg-amber-50',
          buttonClass: 'bg-amber-600 hover:bg-amber-700',
          confirmText: 'Suspend Account',
          description: isPortalUser
            ? `Suspend staff member ${staff.fullName} (${staff.employeeCode})? Portal access will be immediately revoked across all hospital workstations.`
            : `Suspend ${staff.fullName} (${staff.employeeCode})? Staff status will be flagged as suspended.`,
          isReasonRequired: true,
        };
    }
  };

  const config = getModalConfig();

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (config.isReasonRequired && !reason.trim()) {
      setError('Please provide a reason for suspension.');
      return;
    }

    const res = await StaffUserService.updateStaffStatus(staff.id, targetStatus, currentUser);
    if (!res.success) {
      setError(res.error || 'Failed to update status.');
      return;
    }

    onSuccess({ ...staff, status: targetStatus });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e2eae5] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#f6f8f7] border-b border-[#e2eae5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-xl ${config.iconBg} flex items-center justify-center`}>
              {config.icon}
            </div>
            <div>
              <h3 className="font-bold text-[#111827] text-sm">{config.title}</h3>
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

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          <p className="text-xs text-[#52665e] leading-relaxed">{config.description}</p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#52665e] mb-1">
              {config.isReasonRequired ? (
                <>
                  Reason for Suspension <span className="text-red-500">*</span>
                </>
              ) : (
                <>Optional Administrative Notes</>
              )}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                config.isReasonRequired
                  ? 'Specify cause for administrative suspension...'
                  : 'Add any relevant context for this status update...'
              }
              rows={3}
              className="w-full p-2.5 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
            />
          </div>

          <div className="pt-3 border-t border-[#e2eae5] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-[#52665e] hover:bg-[#e2eae5] rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm cursor-pointer ${config.buttonClass}`}
            >
              {config.confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
