import React from 'react';
import { X, AlertTriangle, CheckCircle2, Lock, ShieldAlert, Power } from 'lucide-react';
import { AdminUser, AdminUserStatus } from '../../../types/adminUser';
import { AdminUserService } from '../../../services/adminUserService';
import { User } from '../../../types';

interface AdminUserStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
  newStatus: AdminUserStatus;
  currentUser: User | null;
  totalActiveSuperAdmins: number;
  onConfirm: () => void;
}

export const AdminUserStatusModal: React.FC<AdminUserStatusModalProps> = ({
  isOpen,
  onClose,
  user,
  newStatus,
  currentUser,
  totalActiveSuperAdmins,
  onConfirm,
}) => {
  if (!isOpen || !user) return null;

  const isActorSuperAdmin = AdminUserService.isActorSuperAdmin(currentUser);

  // Security Check: Target protection against Admin users
  if (user.role === 'SUPER_ADMIN' && !isActorSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-xl border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            Protected Account
          </h3>
          <p className="text-xs text-slate-600 mb-6">
            This Super Admin account is protected and cannot be modified by an Admin user.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Self-action safeguard
  const isSelf =
    (currentUser?.id && user.id === currentUser.id) ||
    (currentUser?.username &&
      user.username.toLowerCase() === currentUser.username.toLowerCase());

  if (isSelf && (newStatus === 'INACTIVE' || newStatus === 'SUSPENDED')) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-xl border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            Action Not Allowed
          </h3>
          <p className="text-xs text-slate-600 mb-6">
            You cannot disable your currently active account.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Last active Super Admin safeguard
  if (
    user.role === 'SUPER_ADMIN' &&
    user.status === 'ACTIVE' &&
    (newStatus === 'INACTIVE' || newStatus === 'SUSPENDED') &&
    totalActiveSuperAdmins <= 1
  ) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-xl border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            Root Super Admin Protected
          </h3>
          <p className="text-xs text-slate-600 mb-6">
            At least one active Super Admin account must remain in the system.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const actionTitle =
    newStatus === 'ACTIVE'
      ? 'Activate Administrator Account'
      : newStatus === 'SUSPENDED'
      ? 'Suspend Administrator Account'
      : 'Deactivate Administrator Account';

  const actionDescription =
    newStatus === 'ACTIVE'
      ? `Re-enabling access will allow ${user.fullName} to sign in to the hospital management system with administrative credentials.`
      : newStatus === 'SUSPENDED'
      ? `Suspending will immediately revoke active access and prevent login attempts by ${user.fullName}.`
      : `The user will no longer be able to sign in until the account is reactivated.`;

  const btnBg =
    newStatus === 'ACTIVE'
      ? 'bg-[#08775A] hover:bg-[#065e46] text-white'
      : newStatus === 'SUSPENDED'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : 'bg-amber-600 hover:bg-amber-700 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="admin-status-modal"
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden transition-all"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div
              className={`p-3 rounded-xl ${
                newStatus === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800'
                  : newStatus === 'SUSPENDED'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {newStatus === 'ACTIVE' ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : newStatus === 'SUSPENDED' ? (
                <ShieldAlert className="h-6 w-6" />
              ) : (
                <Power className="h-6 w-6" />
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <h3 className="text-base font-bold text-slate-900 mb-2">
            {actionTitle}
          </h3>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs">
            <div className="font-bold text-slate-900">{user.fullName}</div>
            <div className="text-slate-500 font-mono">@{user.username} • {user.email}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-slate-500">Current Status:</span>
              <span className="font-semibold text-slate-700">{user.status}</span>
              <span className="text-slate-400">→</span>
              <span className="font-bold text-[#08775A]">{newStatus}</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mb-6">
            {actionDescription}
          </p>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors ${btnBg}`}
            >
              Confirm {newStatus === 'ACTIVE' ? 'Activation' : newStatus === 'SUSPENDED' ? 'Suspension' : 'Deactivation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
