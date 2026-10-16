import React, { useState } from 'react';
import { TrendingDown, Plus, Pencil, Ban, Loader2 } from 'lucide-react';
import { GenericReportView } from '../../../components/reports/GenericReportView';
import { Modal } from '../../../components/common/Modal';
import { TextInput, NumberInput, Select, Textarea, DatePicker } from '../../../components/forms/FormControls';
import { useReportFilters, useFilterOptions, FilterSelect, opts } from '../../../components/reports/reportFilters';
import { useToast } from '../../../context/ToastContext';
import { formatAmount, formatPKR } from '../../../utils/formatters';
import { formatDateISO, getHospitalCurrentDate } from '../../../utils/dateConstants';
import { fetchManagementFilterOptions, EMPTY_MANAGEMENT_OPTIONS } from '../../../services/managementReportsService';
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  voidExpense,
  EXPENSE_CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_METHOD_OPTIONS,
  ExpenseRecord,
  ExpenseInput,
  ExpenseCategory,
  ExpensePaymentMethod,
} from '../../../services/expenseService';

const STATUS_OPTIONS = opts(['VOID', 'Voided'], ['ALL', 'All (incl. voided)']);

const EMPTY_FORM = (): ExpenseInput => ({
  expenseDate: formatDateISO(getHospitalCurrentDate()),
  category: 'UTILITIES',
  amount: 0,
  paymentMethod: 'CASH',
  paidTo: '',
  reference: '',
  description: '',
  departmentId: null,
});

/**
 * Expense Management (Super Admin / Admin) — record hospital operating
 * expenses. Same filter-row + table pattern as the reports. A wrong entry is
 * voided with a reason, never deleted.
 */
export const ExpenseManagementView: React.FC = () => {
  const toast = useToast();
  const { departments, users } = useFilterOptions(fetchManagementFilterOptions, EMPTY_MANAGEMENT_OPTIONS);
  const { filters, bind, reset } = useReportFilters({ category: '', paymentMethod: '', createdById: '', status: '' });
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => setRefreshKey((k) => k + 1);

  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ExpenseInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [voidTarget, setVoidTarget] = useState<ExpenseRecord | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const set = <K extends keyof ExpenseInput>(key: K, value: ExpenseInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM());
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (e: ExpenseRecord) => {
    setEditing(e);
    setForm({
      expenseDate: e.expenseDate,
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      paidTo: e.paidTo,
      reference: e.reference ?? '',
      description: e.description ?? '',
      departmentId: e.departmentId,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.expenseDate) return setFormError('Expense date is required.');
    if (!(form.amount > 0)) return setFormError('Amount must be greater than zero.');
    if (!form.paidTo.trim()) return setFormError('Paid To is required.');
    setIsSaving(true);
    setFormError(null);
    try {
      const payload = { ...form, departmentId: form.departmentId || null };
      const saved = editing ? await updateExpense(editing.id, payload) : await createExpense(payload);
      toast.success(`${saved.expenseNumber} ${editing ? 'updated' : 'recorded'} — ${formatPKR(saved.amount)}.`);
      setIsFormOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save expense.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmVoid = async () => {
    if (!voidTarget) return;
    if (voidReason.trim().length < 3) {
      toast.error('Please enter a reason for voiding this expense.');
      return;
    }
    setIsVoiding(true);
    try {
      await voidExpense(voidTarget.id, voidReason.trim());
      toast.success(`${voidTarget.expenseNumber} voided.`);
      setVoidTarget(null);
      setVoidReason('');
      reload();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to void expense.');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <>
      <GenericReportView<ExpenseRecord>
        key={refreshKey}
        title="Expense Management"
        subtitle="Record hospital operating expenses. A wrong entry is voided with a reason — never deleted."
        icon={TrendingDown}
        filenamePrefix="Expenses"
        allTimeOption
        compact
        headerActions={
          <button
            type="button"
            onClick={openAdd}
            className="h-9 px-4 rounded-lg bg-[#08775A] hover:bg-[#065f46] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        }
        fetchReport={(range) => fetchExpenses(range, filters)}
        onResetExtraFilters={reset}
        extraFilters={
          <>
            <FilterSelect label="Category" options={EXPENSE_CATEGORY_OPTIONS} {...bind('category')} />
            <FilterSelect label="Payment Method" options={EXPENSE_METHOD_OPTIONS} {...bind('paymentMethod')} />
            <FilterSelect label="Entered By" options={users} {...bind('createdById')} />
            <FilterSelect label="Status" options={STATUS_OPTIONS} {...bind('status')} />
          </>
        }
        rowKey={(r) => r.id}
        emptyMessage="No expenses recorded for these filters."
        columns={[
          { header: 'Expense #', cell: (r) => r.expenseNumber },
          { header: 'Date', cell: (r) => r.expenseDateLabel },
          { header: 'Category', cell: (r) => EXPENSE_CATEGORY_LABEL[r.category] },
          { header: 'Paid To', cell: (r) => r.paidTo },
          { header: 'Details / Reference', cell: (r) => [r.description, r.reference].filter(Boolean).join(' · ') || '—' },
          { header: 'Department', cell: (r) => r.departmentName || '—' },
          { header: 'Payment Method', cell: (r) => PAYMENT_METHOD_LABEL[r.paymentMethod] },
          {
            header: 'Amount (PKR)',
            align: 'right',
            cell: (r) => formatAmount(r.amount),
            // Voided entries never count toward the totals row or exports.
            excelValue: (r) => (r.status === 'ACTIVE' ? r.amount : 0),
          },
          { header: 'Entered By', cell: (r) => r.enteredBy },
          { header: 'Status', cell: (r) => (r.status === 'VOID' ? `Voided — ${r.voidReason ?? ''}` : 'Active') },
          { header: 'Actions', cell: () => '' },
        ]}
        renderCell={(col, row) => {
          if (col.header === 'Status') {
            return row.status === 'VOID' ? (
              <span className="text-rose-700 text-[11px]" title={`Voided by ${row.voidedBy ?? '—'}`}>
                <span className="inline-block px-2 py-0.5 rounded-full font-bold border bg-rose-50 border-rose-200 mr-1">Voided</span>
                {row.voidReason}
              </span>
            ) : (
              <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">Active</span>
            );
          }
          if (col.header === 'Amount (PKR)' && row.status === 'VOID') {
            return <span className="line-through text-slate-400">{formatAmount(row.amount)}</span>;
          }
          if (col.header === 'Actions') {
            if (row.status === 'VOID') return <span className="text-slate-300">—</span>;
            return (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  title="Edit expense"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-[#effaf5] border border-slate-200 rounded transition-colors cursor-pointer"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setVoidTarget(row)}
                  title="Void expense"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors cursor-pointer"
                >
                  <Ban className="h-3 w-3" /> Void
                </button>
              </div>
            );
          }
          return col.cell(row);
        }}
      />

      {/* Add / Edit */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => !isSaving && setIsFormOpen(false)}
        title={editing ? `Edit Expense — ${editing.expenseNumber}` : 'Add Expense'}
        subtitle="All amounts in PKR."
        maxWidth="lg"
      >
        <form onSubmit={save} className="space-y-3">
          {formError && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DatePicker label="Expense Date" required value={form.expenseDate} onChange={(e) => set('expenseDate', e.target.value)} />
            <Select
              label="Category"
              required
              options={EXPENSE_CATEGORY_OPTIONS}
              value={form.category}
              onChange={(e) => set('category', e.target.value as ExpenseCategory)}
            />
            <NumberInput
              label="Amount (PKR)"
              required
              min={1}
              step="any"
              value={form.amount || ''}
              onChange={(e) => set('amount', Number(e.target.value) || 0)}
            />
            <Select
              label="Payment Method"
              required
              options={EXPENSE_METHOD_OPTIONS}
              value={form.paymentMethod}
              onChange={(e) => set('paymentMethod', e.target.value as ExpensePaymentMethod)}
            />
            <TextInput
              label="Paid To (Vendor / Payee)"
              required
              maxLength={150}
              placeholder="e.g. LESCO, ABC Traders"
              value={form.paidTo}
              onChange={(e) => set('paidTo', e.target.value)}
            />
            <TextInput
              label="Reference (optional)"
              maxLength={100}
              placeholder="Bill / cheque / transaction no."
              value={form.reference ?? ''}
              onChange={(e) => set('reference', e.target.value)}
            />
            <Select
              label="Department (optional)"
              options={[{ value: '', label: 'Hospital-wide' }, ...departments]}
              value={form.departmentId ?? ''}
              onChange={(e) => set('departmentId', e.target.value || null)}
            />
          </div>
          <Textarea
            label="Details (optional)"
            rows={2}
            maxLength={500}
            placeholder="What was this expense for?"
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs inline-flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? 'Save Changes' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Void */}
      <Modal
        isOpen={!!voidTarget}
        onClose={() => !isVoiding && setVoidTarget(null)}
        title={`Void Expense — ${voidTarget?.expenseNumber ?? ''}`}
        subtitle="The entry stays in the history as Voided and no longer counts in totals."
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setVoidTarget(null)}
              disabled={isVoiding}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmVoid}
              disabled={isVoiding}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs inline-flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {isVoiding && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm Void
            </button>
          </div>
        }
      >
        {voidTarget && (
          <div className="space-y-3 py-1">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
              {EXPENSE_CATEGORY_LABEL[voidTarget.category]} · {voidTarget.paidTo} ·{' '}
              <strong className="text-slate-900">{formatPKR(voidTarget.amount)}</strong>
            </div>
            <Textarea
              label="Void Reason"
              required
              rows={3}
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Why is this expense being voided?"
            />
          </div>
        )}
      </Modal>
    </>
  );
};
