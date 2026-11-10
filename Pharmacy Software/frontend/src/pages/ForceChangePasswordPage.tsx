import React, { useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/** pharmacy.md §13 — a Super-Admin-issued or Admin-issued temporary password must be changed on first login. */
export const ForceChangePasswordPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { changePassword, logout } = useAuth();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password updated — welcome to Pharmacy Software.');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to change password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f8f7] p-4">
      <div className="bg-white rounded-xl shadow-xl border border-[#e2eae5] w-full max-w-sm p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-9 w-9 rounded-lg bg-[#effaf5] border border-[#c2e7db] flex items-center justify-center"><ShieldCheck className="h-4.5 w-4.5 text-[#129b70]" /></div>
          <div>
            <h2 className="text-sm font-bold text-[#111827]">Set a New Password</h2>
            <p className="text-[11px] text-[#52665e]">Required before you can continue.</p>
          </div>
        </div>

        {error && <div className="mb-4 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#52665e] mb-1">Current (Temporary) Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input" autoComplete="current-password" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#52665e] mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" autoComplete="new-password" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#52665e] mb-1">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" autoComplete="new-password" />
          </div>
          <button type="submit" disabled={submitting} className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-[#129b70] hover:bg-[#0e7d5a] text-white text-sm font-semibold disabled:opacity-60">
            {submitting ? 'Updating…' : 'Update Password'} {!submitting && <ArrowRight className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => logout()} className="w-full text-center text-[11px] text-[#94a3b8] hover:text-[#52665e]">Cancel and sign out</button>
        </form>
      </div>
      <style>{`.input { width: 100%; height: 2.25rem; padding: 0 0.75rem; font-size: 0.875rem; background: white; border: 1px solid #e2eae5; border-radius: 0.5rem; } .input:focus { outline: none; box-shadow: 0 0 0 2px rgba(18,155,112,0.2); border-color: #129b70; }`}</style>
    </div>
  );
};
