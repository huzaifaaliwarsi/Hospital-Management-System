import React, { useState, useEffect } from 'react';
import { X, Stethoscope, Eye, EyeOff, Wand2, AlertCircle, ShieldCheck, Power } from 'lucide-react';
import { StaffUser } from '../../../types/staffUser';
import { StaffUserService } from '../../../services/staffUserService';

interface ClinicalAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffUser | null;
  onSuccess: () => void;
}

/**
 * v7.2 Doctor Clinical Discharge Authorization (HMS_V7.2_NEW_REQUIREMENTS.md
 * §2.4) — a credential deliberately separate from portal login: it lets a
 * doctor re-authenticate at the discharge action so the system can store
 * exactly which doctor clinically closed an admission. Works even for a
 * "Staff Record Only" doctor with no portal account.
 */
export const ClinicalAuthModal: React.FC<ClinicalAuthModalProps> = ({ isOpen, onClose, staff, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && staff) {
      setUsername(staff.clinicalAuthUsername || '');
      setPassword('');
      setError(null);
    }
  }, [isOpen, staff]);

  if (!isOpen || !staff) return null;

  const isConfigured = !!staff.clinicalAuthUsername;

  const handleGeneratePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let generated = 'Dr';
    for (let i = 0; i < 8; i++) generated += chars.charAt(Math.floor(Math.random() * chars.length));
    generated += Math.floor(Math.random() * 90 + 10);
    setPassword(generated);
  };

  const handleSetOrReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSaving(true);
    const res = isConfigured && username === staff.clinicalAuthUsername
      ? await StaffUserService.resetClinicalAuthPassword(staff.id, password)
      : await StaffUserService.setClinicalAuth(staff.id, username, password);
    setIsSaving(false);

    if (!res.success) {
      setError(res.error || 'Failed to save clinical discharge credential.');
      return;
    }
    onSuccess();
    onClose();
  };

  const handleToggleActive = async () => {
    setIsSaving(true);
    const res = await StaffUserService.setClinicalAuthActive(staff.id, !staff.clinicalAuthActive);
    setIsSaving(false);
    if (!res.success) {
      setError(res.error || 'Failed to update authorization status.');
      return;
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e2eae5] overflow-hidden">
        <div className="px-6 py-4 bg-[#f6f8f7] border-b border-[#e2eae5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#111827] text-sm">Clinical Discharge Authorization</h3>
              <p className="text-xs text-[#52665e]">{staff.fullName} ({staff.employeeCode})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#8b9e95] hover:text-[#111827] hover:bg-[#e2eae5] transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-[11px] text-blue-900 leading-relaxed">
            Deliberately separate from portal login — this credential is what a doctor re-enters at the discharge action so the
            system records exactly which doctor clinically closed the case. Works even for a Staff Record Only doctor.
          </div>

          {isConfigured && (
            <div className="bg-[#f6f8f7] border border-[#e2eae5] rounded-xl p-3.5 flex items-center justify-between">
              <div className="text-xs">
                <span className="text-[#8b9e95] text-[10px] block uppercase">Current Status</span>
                <span className={`font-bold ${staff.clinicalAuthActive ? 'text-[#08775A]' : 'text-slate-500'}`}>
                  {staff.clinicalAuthActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={isSaving}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                  staff.clinicalAuthActive
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'bg-[#effaf5] text-[#08775A] hover:bg-[#dff5ea]'
                }`}
              >
                <Power className="h-3 w-3" />
                {staff.clinicalAuthActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSetOrReset} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#52665e] mb-1">
                Clinical Auth Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. dr.ayesha"
                className="w-full px-3 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs font-mono text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#52665e]">
                {isConfigured ? 'New Password' : 'Password'} <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="flex items-center gap-1 text-[11px] text-[#0e7d5a] font-semibold hover:text-[#129b70] cursor-pointer"
              >
                <Wand2 className="h-3 w-3" />
                <span>Auto Generate</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full pl-3 pr-8 py-2 bg-[#f6f8f7] border border-[#e2eae5] rounded-lg text-xs font-mono text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b9e95] hover:text-[#111827] cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>

            <p className="text-[10px] text-[#8b9e95] leading-relaxed">
              Never shown again after saving — hand it to the doctor directly. Passwords are never printed in reports, exports or
              discharge records.
            </p>

            <div className="pt-3 border-t border-[#e2eae5] flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3.5 py-2 text-xs font-semibold text-[#52665e] hover:bg-[#e2eae5] rounded-lg cursor-pointer">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-sm cursor-pointer disabled:opacity-60"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {isSaving ? 'Saving…' : isConfigured ? 'Save Credential' : 'Set Up Authorization'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
