import React, { useEffect, useState } from 'react';
import { Loader2, Plus, X, KeyRound, Ban, CheckCircle } from 'lucide-react';
import apiClient from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const emptyForm = { username: '', email: '', fullName: '', phone: '', password: '' };

export const UsersPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const targetRole = currentUser?.role === 'SUPER_ADMIN' ? 'ADMIN' : 'SALES_DISPENSING';
  const targetLabel = targetRole === 'ADMIN' ? 'Admin' : 'Sales';

  const load = () => {
    setLoading(true);
    apiClient.get('/users').then((r) => setRows(r.data.data)).catch(() => toast.error('Failed to load accounts.')).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.fullName.trim() || form.password.length < 8) {
      toast.error('Username, Full Name and an 8+ character Password are required.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/users', { ...form, email: form.email || undefined, phone: form.phone || undefined, role: targetRole });
      toast.success(`${targetLabel} account created.`);
      setShowAdd(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to create account.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u: any) => {
    const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiClient.post(`/users/${u.id}/status`, { status: nextStatus });
      toast.success(`Account ${nextStatus === 'ACTIVE' ? 'reactivated' : 'suspended'}.`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update status.');
    }
  };

  const resetPassword = async (u: any) => {
    const newPassword = prompt(`New temporary password for ${u.username} (min 8 chars):`);
    if (!newPassword) return;
    try {
      await apiClient.post(`/users/${u.id}/reset-password`, { newPassword });
      toast.success('Password reset — user must change it on next login.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to reset password.');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#111827]">Account Management</h2>
          <p className="text-xs text-[#52665e]">pharmacy.md §13 — {currentUser?.role === 'SUPER_ADMIN' ? 'Super Admin creates Admin accounts only.' : 'Admin creates Sales accounts only.'}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg shadow-xs">
          <Plus className="h-3.5 w-3.5" /> Add {targetLabel}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#e2eae5] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f6faf8]">
            <tr className="text-[11px] font-bold uppercase tracking-wide text-[#52665e]">
              <th className="py-2.5 px-3 text-left">Username</th>
              <th className="py-2.5 px-3 text-left">Full Name</th>
              <th className="py-2.5 px-3 text-left">Email</th>
              <th className="py-2.5 px-3 text-center">Last Login</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-[#52665e]"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-[#94a3b8]">No {targetLabel.toLowerCase()} accounts yet.</td></tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="border-t border-[#f0f4f2]">
                  <td className="py-2 px-3 font-mono text-xs">{u.username}</td>
                  <td className="py-2 px-3 font-semibold text-[#111827]">{u.fullName}</td>
                  <td className="py-2 px-3 text-[#52665e]">{u.email || '—'}</td>
                  <td className="py-2 px-3 text-center text-xs text-[#94a3b8]">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-GB') : 'Never'}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${u.status === 'ACTIVE' ? 'bg-[#effaf5] text-[#0e7d5a] border-[#c2e7db]' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{u.status}</span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => resetPassword(u)} title="Reset Password" className="text-[#52665e] hover:text-[#129b70]"><KeyRound className="h-4 w-4" /></button>
                      <button onClick={() => toggleStatus(u)} title={u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'} className={u.status === 'ACTIVE' ? 'text-rose-500 hover:text-rose-700' : 'text-[#129b70] hover:text-[#0e7d5a]'}>
                        {u.status === 'ACTIVE' ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl border border-[#e2eae5]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2eae5]">
              <h3 className="text-sm font-bold text-[#111827]">Add {targetLabel}</h3>
              <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-[#94a3b8]" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <Field label="Full Name *"><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Username *"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="input" /></Field>
                <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
              </div>
              <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></Field>
              <Field label="Temporary Password * (min 8 chars)"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" /></Field>
              <p className="text-[10.5px] text-[#94a3b8]">User must change this password on first login.</p>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs font-semibold text-[#52665e] border border-[#e2eae5] rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg disabled:opacity-60">{saving ? 'Saving…' : `Create ${targetLabel}`}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`.input { width: 100%; height: 2.25rem; padding: 0 0.75rem; font-size: 0.875rem; background: white; border: 1px solid #e2eae5; border-radius: 0.5rem; } .input:focus { outline: none; box-shadow: 0 0 0 2px rgba(18,155,112,0.2); border-color: #129b70; }`}</style>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-semibold text-[#52665e] mb-1">{label}</label>
    {children}
  </div>
);
