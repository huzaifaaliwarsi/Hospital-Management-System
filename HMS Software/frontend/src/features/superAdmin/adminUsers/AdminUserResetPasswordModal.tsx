import React, { useState } from 'react';
import { X, Key, Eye, EyeOff, Lock, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { AdminUser } from '../../../types/adminUser';
import { AdminUserService } from '../../../services/adminUserService';
import { User } from '../../../types';

interface AdminUserResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
  currentUser: User | null;
  onResetSuccess: (newPassword: string, requireChange: boolean) => void;
}

export const AdminUserResetPasswordModal: React.FC<AdminUserResetPasswordModalProps> = ({
  isOpen,
  onClose,
  user,
  currentUser,
  onResetSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requireChange, setRequireChange] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const isActorSuperAdmin = AdminUserService.isActorSuperAdmin(currentUser);

  // Security Check: If target is Super Admin and actor is Admin, block action
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

  const handleGenerateStrong = () => {
    const pass = AdminUserService.generateTemporaryPassword();
    setNewPassword(pass);
    setConfirmPassword(pass);
    setShowPassword(true);
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const val = AdminUserService.validatePassword(newPassword);
    if (!val.isValid) {
      setErrorMessage(val.message || 'Invalid password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    onResetSuccess(newPassword, requireChange);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="admin-reset-password-modal"
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden transition-all"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#08775A]/20 text-[#2dd4bf]">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Reset Administrator Password
              </h2>
              <p className="text-[11px] text-slate-300">
                Issue temporary credentials for {user.fullName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* User info card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">{user.fullName}</div>
              <div className="text-[11px] text-slate-500 font-mono">@{user.username}</div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                user.role === 'SUPER_ADMIN'
                  ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
            </span>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                New Temporary Password <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateStrong}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#08775A] hover:text-[#065e46]"
              >
                <Sparkles className="h-3 w-3" />
                <span>Suggest Strong</span>
              </button>
            </div>

            <div className="relative">
              <input
                id="reset-password-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 8 characters (letters + numbers)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-xs px-3 py-2 pr-8 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75] bg-white font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Temporary Password <span className="text-rose-500">*</span>
              </label>
              <input
                id="reset-confirmpassword-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter temporary password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75] bg-white font-mono"
                required
              />
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={requireChange}
                  onChange={(e) => setRequireChange(e.target.checked)}
                  className="rounded border-slate-300 text-[#08775A] focus:ring-[#149E75]"
                />
                <span>Force password change on user&apos;s next sign-in</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              id="reset-password-cancel-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="reset-password-submit-btn"
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065e46] rounded-xl shadow-xs transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Update Password</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
