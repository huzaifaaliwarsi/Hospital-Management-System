import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, Plus, X, Check, DollarSign, CheckCircle2, Clock, Receipt } from 'lucide-react';
import apiClient from '../services/apiClient';
import { formatPKR } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';
import { PharmacyDataTable, Column } from '../components/PharmacyDataTable';

const emptyForm = {
  category: '',
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  paymentMethod: 'CASH',
  payeeOrVendor: '',
  description: '',
};

export const ExpensesPage: React.FC<{ canApprove: boolean }> = ({ canApprove }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const toast = useToast();

  const load = () => {
    setLoading(true);
    apiClient
      .get('/expenses')
      .then((r) => setRows(r.data.data))
      .catch(() => toast.error('Failed to load expenses.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Calculations for KPIs
  const totalExpense = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const approvedTotal = rows.filter((r) => r.approvedById).reduce((s, r) => s + Number(r.amount || 0), 0);
  const pendingTotal = rows.filter((r) => !r.approvedById).reduce((s, r) => s + Number(r.amount || 0), 0);

  const kpis: KpiItem[] = [
    {
      label: 'Gross Expenses',
      value: formatPKR(totalExpense),
      icon: DollarSign,
      subtitle: `${rows.length} recorded vouchers`,
      tone: 'default',
    },
    {
      label: 'Approved & Settled',
      value: formatPKR(approvedTotal),
      icon: CheckCircle2,
      subtitle: 'Verified by management',
      tone: 'success',
    },
    {
      label: 'Pending Approval',
      value: formatPKR(pendingTotal),
      icon: Clock,
      subtitle: 'Awaiting admin review',
      tone: pendingTotal > 0 ? 'warning' : 'success',
    },
    {
      label: 'Total Entries',
      value: rows.length,
      icon: Receipt,
      subtitle: 'Operational disbursement logs',
      tone: 'info',
    },
  ];

  // Filtered dataset
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === 'APPROVED' && !r.approvedById) return false;
      if (statusFilter === 'PENDING' && r.approvedById) return false;
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
      return true;
    });
  }, [rows, statusFilter, categoryFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category.trim() || !form.description.trim() || !Number(form.amount)) {
      toast.error('Category, Amount and Description are required.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/expenses', {
        ...form,
        amount: Number(form.amount),
        payeeOrVendor: form.payeeOrVendor || undefined,
      });
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

  const columns: Column<any>[] = [
    {
      key: 'date',
      header: 'Date',
      width: '120px',
      render: (ex) => (
        <span className="text-[11.5px] text-slate-700 whitespace-nowrap">
          {new Date(ex.date).toLocaleDateString('en-GB')}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: '150px',
      render: (ex) => (
        <span className="text-xs font-medium text-slate-800 whitespace-nowrap">
          {ex.category}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description & Payee',
      render: (ex) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="font-semibold text-slate-900 text-xs">{ex.description}</span>
          {ex.payeeOrVendor && (
            <span className="text-xs text-slate-500 font-normal whitespace-nowrap">
              • Payee: {ex.payeeOrVendor}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'enteredBy',
      header: 'Entered By',
      width: '150px',
      render: (ex) => (
        <span className="text-xs text-slate-700 whitespace-nowrap">
          {ex.enteredByUser?.fullName || ex.enteredByUser?.username || 'Staff'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount (PKR)',
      align: 'right',
      width: '140px',
      render: (ex) => (
        <span className="font-bold text-xs text-slate-900 whitespace-nowrap">
          {formatPKR(ex.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '130px',
      render: (ex) =>
        ex.approvedById ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0e7d5a] whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-[#0e7d5a] shrink-0" /> Approved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-amber-600 shrink-0" /> Pending
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'center',
      width: '100px',
      render: (ex) =>
        canApprove && !ex.approvedById ? (
          <button
            type="button"
            onClick={() => approve(ex.id)}
            className="px-2 py-0.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            title="Approve Expense Voucher"
          >
            <Check className="h-3 w-3" /> Approve
          </button>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-[1700px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Operational Expenses
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              Cash Vouchers
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Store disbursements, vendor incidentals, petty cash reconciliation, and supervisor approvals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Record New Expense
        </button>
      </div>

      {/* KPI Header */}
      <PharmacyKpiHeader items={kpis} />

      {/* Main Table */}
      <PharmacyDataTable
        columns={columns}
        data={filteredRows}
        loading={loading}
        title="Expense Voucher Register"
        badge="Active Disbursements"
        exportFileName="operational_expenses"
        searchPlaceholder="Search expense category, description, payee, or user…"
        searchFilter={(ex, q) =>
          ex.category.toLowerCase().includes(q) ||
          ex.description.toLowerCase().includes(q) ||
          (ex.payeeOrVendor && ex.payeeOrVendor.toLowerCase().includes(q)) ||
          (ex.enteredByUser?.fullName && ex.enteredByUser.fullName.toLowerCase().includes(q))
        }
        onRefresh={load}
        onApplyFilters={load}
        onResetFilters={() => {
          setStatusFilter('ALL');
          setCategoryFilter('ALL');
          load();
        }}
        filterControls={
          <>
            <div className="w-40">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-8.5 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-36">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-8.5 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </>
        }
        emptyTitle="No Expenses Found"
        emptyDescription="No expense records match your search or filter criteria."
      />

      {/* Add Expense Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-400" /> Record Expense Voucher
              </h3>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category *">
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. Utility, Transport"
                    className="w-full h-8.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </Field>
                <Field label="Date *">
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full h-8.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (PKR) *">
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0"
                    className="w-full h-8.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </Field>
                <Field label="Payment Method">
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full h-8.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="ONLINE">Online Bank</option>
                  </select>
                </Field>
              </div>
              <Field label="Payee / Vendor Name">
                <input
                  value={form.payeeOrVendor}
                  onChange={(e) => setForm({ ...form, payeeOrVendor: e.target.value })}
                  placeholder="e.g. Electric Company, Water Supplier"
                  className="w-full h-8.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                />
              </Field>
              <Field label="Description *">
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Reason / voucher description"
                  className="w-full h-8.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-lg disabled:opacity-60 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
    {children}
  </div>
);
