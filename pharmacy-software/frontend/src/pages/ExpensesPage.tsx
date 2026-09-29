import React, { useEffect, useState } from 'react';
import { Loader2, Plus, X, Check } from 'lucide-react';
import apiClient from '../services/apiClient';
import { formatPKR } from '../utils/format';
import { useToast } from '../context/ToastContext';

const emptyForm = { category: '', date: new Date().toISOString().slice(0, 10), amount: '', paymentMethod: 'CASH', payeeOrVendor: '', description: '' };

export const ExpensesPage: React.FC<{ canApprove: boolean }> = ({ canApprove }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    apiClient.get('/expenses').then((r) => setRows(r.data.data)).catch(() => toast.error('Failed to load expenses.')).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category.trim() || !form.description.trim() || !Number(form.amount)) {
      toast.error('Category, Amount and Description are required.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/expenses', { ...form, amount: Number(form.amount), payeeOrVendor: form.payeeOrVendor || undefined });
      toast.success('Expense recorded.');
      setShowAdd(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to record expense.');
    } finally {
      setSaving(false);
    }
  };

  const approve = async (id: string) => {
    try {
      await apiClient.post(`/expenses/${id}/approve`);
      toast.success('Expense approved.');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to approve.');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#111827]">Expenses</h2>
          <p className="text-xs text-[#52665e]">pharmacy.md §12 — a cash expense affects the entering user's expected physical cash.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg shadow-xs">
          <Plus className="h-3.5 w-3.5" /> New Expense
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#e2eae5] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f6faf8]">
            <tr className="text-[11px] font-bold uppercase tracking-wide text-[#52665e]">
              <th className="py-2.5 px-3 text-left">Date</th>
              <th className="py-2.5 px-3 text-left">Category</th>
              <th className="py-2.5 px-3 text-left">Description</th>
              <th className="py-2.5 px-3 text-left">Entered By</th>
              <th className="py-2.5 px-3 text-right">Amount</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              {canApprove && <th className="py-2.5 px-3 text-center">Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#52665e]"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#94a3b8]">No expenses yet.</td></tr>
            ) : (
              rows.map((ex) => (
                <tr key={ex.id} className="border-t border-[#f0f4f2]">
                  <td className="py-2 px-3 text-xs">{new Date(ex.date).toLocaleDateString('en-GB')}</td>
                  <td className="py-2 px-3">{ex.category}</td>
                  <td className="py-2 px-3 text-[#52665e]">{ex.description}</td>
                  <td className="py-2 px-3 text-[#52665e]">{ex.enteredByUser?.fullName}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{formatPKR(ex.amount)}</td>
                  <td className="py-2 px-3 text-center">
                    {ex.approvedById ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db]">Approved</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pending</span>}
                  </td>
                  {canApprove && <td className="py-2 px-3 text-center">{!ex.approvedById && <button onClick={() => approve(ex.id)} className="text-[#129b70] hover:text-[#0e7d5a]"><Check className="h-4 w-4" /></button>}</td>}
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
              <h3 className="text-sm font-bold text-[#111827]">New Expense</h3>
              <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-[#94a3b8]" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category *"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" /></Field>
                <Field label="Date *"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount *"><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" /></Field>
                <Field label="Payment Method">
                  <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="input">
                    <option value="CASH">Cash</option><option value="CARD">Card</option><option value="ONLINE">Online</option>
                  </select>
                </Field>
              </div>
              <Field label="Payee / Vendor"><input value={form.payeeOrVendor} onChange={(e) => setForm({ ...form, payeeOrVendor: e.target.value })} className="input" /></Field>
              <Field label="Description *"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" /></Field>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs font-semibold text-[#52665e] border border-[#e2eae5] rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg disabled:opacity-60">{saving ? 'Saving…' : 'Save Expense'}</button>
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
