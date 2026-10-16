import React from 'react';
import { X, Trash2, AlertTriangle, Lock, ShieldAlert, Ban } from 'lucide-react';
import { AdminUser } from '../../../types/adminUser';
import { AdminUserService } from '../../../services/adminUserService';
import { User } from '../../../types';

interface AdminUserDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
  currentUser: User | null;
  totalActiveSuperAdmins: number;
  onConfirmDelete: () => void;
}

export const AdminUserDeleteModal: React.FC<AdminUserDeleteModalProps> = ({
  isOpen,
  onClose,
  user,
  currentUser,
  totalActiveSuperAdmins,
  onConfirmDelete,
}) => {
  if (!isOpen || !user) return null;

  const isActorSuperAdmin = AdminUserService.isActorSuperAdmin(currentUser);

  // 1. Guard: Admin cannot delete Super Admin
  if (user.role === 'SUPER_ADMIN' && !isActorSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-xl border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            Protected Super Admin Account
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

  // 2. Guard: Cannot delete self
  const isSelf =
    (currentUser?.id && user.id === currentUser.id) ||
    (currentUser?.username &&
      user.username.toLowerCase() === currentUser.username.toLowerCase());

  if (isSelf) {
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
            You cannot delete your currently active account.
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

  // 3. Guard: Last active Super Admin
  if (user.role === 'SUPER_ADMIN' && totalActiveSuperAdmins <= 1 && user.status === 'ACTIVE') {
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

  // 4. Guard: Linked system activity
  if ((user.linkedActivityCount ?? 0) > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-xl border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <Ban className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            Cannot Delete Account
          </h3>
          <p className="text-xs text-slate-600 mb-2">
            This account has recorded system activity ({user.linkedActivityCount} audit logs) and cannot be permanently deleted.
          </p>
          <p className="text-xs font-semibold text-slate-700 mb-6">
            Deactivate it instead to preserve institutional audit trails.
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="admin-delete-modal"
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden transition-all"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="p-3 rounded-xl bg-rose-100 text-rose-600">
              <Trash2 className="h-6 w-6" />
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
            Delete Administrator Account
          </h3>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs">
            <div className="font-bold text-slate-900">{user.fullName}</div>
            <div className="text-slate-500 font-mono">@{user.username} • {user.email}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-slate-500">Role:</span>
              <span className="font-bold text-slate-800">{user.role}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">Status:</span>
              <span className="font-semibold text-slate-700">{user.status}</span>
            </div>
          </div>

          <p className="text-xs text-rose-700 leading-relaxed mb-6 font-medium">
            Are you sure you want to permanently delete this administrator account? This action cannot be undone.
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
              onClick={onConfirmDelete}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors"
            >
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
