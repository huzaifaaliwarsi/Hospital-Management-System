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

  const columns: Column<any>[] = [
    {
      key: 'username',
      header: 'Username',
      width: '150px',
      render: (u) => (
        <span className="font-bold text-slate-900 text-xs tracking-wider whitespace-nowrap">
          {u.username}
        </span>
      ),
    },
    {
      key: 'fullName',
      header: 'Full Name',
      render: (u) => (
        <span className="font-bold text-slate-900 text-xs whitespace-nowrap">
          {u.fullName}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email Address',
      render: (u) => (
        <span className="text-xs text-slate-600 whitespace-nowrap">
          {u.email || '—'}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      align: 'center',
      width: '160px',
      render: (u) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-GB') : 'Never'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '130px',
      render: (u) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              u.status === 'ACTIVE' ? 'bg-[#0e7d5a]' : 'bg-rose-500'
            }`}
          />
          <span className={u.status === 'ACTIVE' ? 'text-[#0e7d5a]' : 'text-rose-700'}>
            {u.status}
          </span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: '120px',
      render: (u) => (
        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => resetPassword(u)}
            title="Reset User Password"
            className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleStatus(u)}
            title={u.status === 'ACTIVE' ? 'Suspend Account' : 'Reactivate Account'}
            className={`p-1 rounded transition-colors cursor-pointer ${
              u.status === 'ACTIVE'
                ? 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            {u.status === 'ACTIVE' ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-[1700px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Account Management
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              Staff Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {currentUser?.role === 'SUPER_ADMIN'
              ? 'Super Admin provisioning of branch Admin personnel.'
              : 'Admin provisioning of dispensing Sales operators.'}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Add {targetLabel} Account
        </button>
      </div>

      {/* Main Table */}
      <PharmacyDataTable
        columns={columns}
        data={rows}
        loading={loading}
        title="Staff & Operator Directory"
        badge="Active Accounts"
        exportFileName="staff_accounts"
        searchPlaceholder="Search by username, full name, or email…"
        searchFilter={(u, q) =>
          u.username.toLowerCase().includes(q) ||
          u.fullName.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
        }
        onRefresh={load}
        emptyTitle="No Accounts Found"
        emptyDescription={`No ${targetLabel.toLowerCase()} accounts registered in the database.`}
      />

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
