import React from 'react';
import {
  X,
  Shield,
  UserCheck,
  Lock,
  Mail,
  Phone,
  Calendar,
  Clock,
  Key,
  Printer,
  Edit2,
  FileText,
  Activity,
} from 'lucide-react';
import { AdminUser } from '../../../types/adminUser';
import { AdminUserService } from '../../../services/adminUserService';
import { User } from '../../../types';

interface AdminUserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
  currentUser: User | null;
  onEdit: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onPrintDossier: (user: AdminUser) => void;
}

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  isOpen,
  onClose,
  user,
  currentUser,
  onEdit,
  onResetPassword,
  onPrintDossier,
}) => {
  if (!isOpen || !user) return null;

  const isActorSuperAdmin = AdminUserService.isActorSuperAdmin(currentUser);
  const canModify = AdminUserService.canActorModifyTarget(currentUser, user).allowed;

  // Extract initials
  const initials = user.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        id="admin-user-detail-modal"
        className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 transition-all"
      >
        {/* Header Band */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#08775A] to-[#0f766e] flex items-center justify-center text-white font-bold text-lg shadow-md border border-white/20">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  {user.fullName}
                </h2>
                {user.role === 'SUPER_ADMIN' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                    <Lock className="h-3 w-3" />
                    Protected Account
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300 font-mono mt-0.5">
                @{user.username} • {user.employeeCode || user.id}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status & Role Quick Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Role Tier
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                  user.role === 'SUPER_ADMIN'
                    ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {user.role === 'SUPER_ADMIN' ? (
                  <Shield className="h-3 w-3" />
                ) : (
                  <UserCheck className="h-3 w-3" />
                )}
                {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Account Status
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                  user.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : user.status === 'SUSPENDED'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {user.status}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Admin Code / ID
              </span>
              <span className="font-mono text-xs font-bold text-[#08775A] bg-[#effaf5] px-2 py-0.5 rounded border border-[#c2e7db] inline-block">
                {user.employeeCode || `ADM-${user.id.slice(0, 8).toUpperCase()}`}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block mt-1 truncate" title={user.id}>
                UUID: {user.id}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Activities Logged
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800">
                <Activity className="h-3.5 w-3.5 text-[#08775A]" />
                {user.linkedActivityCount ?? 0} Actions
              </span>
            </div>
          </div>

          {/* Contact & Access Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Contact & Authentication Credentials
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">Email Address</div>
                  <div className="font-medium text-slate-900">{user.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">Phone Number</div>
                  <div className="font-medium text-slate-900">{user.phone || 'Not recorded'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">Last Sign-in Activity</div>
                  <div className="font-medium text-slate-900">{user.lastLoginAt || 'Never signed in'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-700">
                <Key className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">Password Policy</div>
                  <div className="font-medium text-slate-900">
                    {user.requirePasswordChangeOnLogin
                      ? 'Change required on next sign-in'
                      : 'Standard active password'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Audit & Accountability Governance Trail */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-[#08775A]" />
              <span>Institutional Governance & Audit Trail</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block">Account Created By:</span>
                <span className="font-semibold text-slate-800">{user.createdBy || 'Initial System Initialization'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Account Created On:</span>
                <span className="font-semibold text-slate-800">{user.createdAt || 'System Setup'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Last Profile Update By:</span>
                <span className="font-semibold text-slate-800">{user.updatedBy || 'None'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Last Profile Update On:</span>
                <span className="font-semibold text-slate-800">{user.updatedAt || 'None'}</span>
              </div>
              {user.statusChangedBy && (
                <div>
                  <span className="text-[11px] text-slate-500 block">Status Transition By:</span>
                  <span className="font-semibold text-slate-800">{user.statusChangedBy}</span>
                </div>
              )}
              {user.statusChangedAt && (
                <div>
                  <span className="text-[11px] text-slate-500 block">Status Transition Date:</span>
                  <span className="font-semibold text-slate-800">{user.statusChangedAt}</span>
                </div>
              )}
              {user.passwordResetBy && (
                <div>
                  <span className="text-[11px] text-slate-500 block">Last Password Reset By:</span>
                  <span className="font-semibold text-slate-800">{user.passwordResetBy}</span>
                </div>
              )}
              {user.passwordResetAt && (
                <div>
                  <span className="text-[11px] text-slate-500 block">Last Password Reset Date:</span>
                  <span className="font-semibold text-slate-800">{user.passwordResetAt}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => onPrintDossier(user)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Printer className="h-3.5 w-3.5 text-[#08775A]" />
            <span>Print Dossier</span>
          </button>

          <div className="flex items-center gap-2">
            {canModify ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onResetPassword(user);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <Key className="h-3.5 w-3.5 text-[#08775A]" />
                  <span>Reset Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(user);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065e46] rounded-lg shadow-xs transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit Account</span>
                </button>
              </>
            ) : (
              <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 italic">
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                <span>Protected Account (View Only for Admin)</span>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
