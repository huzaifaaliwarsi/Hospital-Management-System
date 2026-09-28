import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../../utils/formatters';
import { DataTable } from '../../../components/tables/DataTable';
import { TableColumn } from '../../../types';
import { Modal } from '../../../components/common/Modal';
import { TextInput, NumberInput, Select } from '../../../components/forms/FormControls';
import { inventoryApiService } from '../../../services/inventoryApiService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { toErrorMessage } from '../../../utils/apiErrors';
import { formatPKR, formatDateTimeDDMMYYYY, formatShortRef } from '../../../utils/formatters';

const EXPENSE_CATEGORIES = [
  'UTILITIES',
  'RENT',
  'MAINTENANCE_REPAIRS',
  'MEDICAL_SUPPLIES',
  'OFFICE_SUPPLIES',
  'EQUIPMENT',
  'CLEANING_SANITATION',
  'FOOD_REFRESHMENTS',
  'TRANSPORT',
  'MARKETING',
  'PROFESSIONAL_FEES',
  'MISCELLANEOUS',
];

type Tab = 'petty_cash' | 'expenses';

/**
 * Petty Cash & Expenses (inventory.md §6.1, §9 step 13) — one screen, two
 * tabs, so the navigation stays small without mixing the two accounting
 * records. Separate file from My Balance Sheet / My Account Settlement
 * (§9 step 13's own note: three distinct screens, not one page).
 */
export const PettyCashExpensesView: React.FC = () => {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('petty_cash');

  // Petty Cash Received (read-only)
  const [pettyCashRows, setPettyCashRows] = useState<any[]>([]);
  const [pettyCashLoading, setPettyCashLoading] = useState(true);
  const [pettyCashError, setPettyCashError] = useState<string | null>(null);

  const loadPettyCash = () => {
    setPettyCashLoading(true);
    setPettyCashError(null);
    inventoryApiService
      .listPettyCash()
      .then(setPettyCashRows)
      .catch((e) => setPettyCashError(toErrorMessage(e)))
      .finally(() => setPettyCashLoading(false));
  };
  useEffect(loadPettyCash, []);

  const pettyCashColumns: TableColumn<any>[] = [
    { key: 'id', header: 'Ref', render: (r) => r.id.slice(0, 8) },
    { key: 'occurredAt', header: 'Date/Time', render: (r) => formatDateTimeDDMMYYYY(r.occurredAt) },
    { key: 'issuedBy', header: 'Issued By', render: (r) => r.issuedByUser?.displayName || r.issuedByUser?.username || '—' },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => formatPKR(r.amount) },
    { key: 'receivedBy', header: 'Received By', render: () => currentUser?.name || '—' },
    { key: 'note', header: 'Purpose', render: (r) => r.note || '—' },
  ];

  // Inventory Expenses
  const [expenseRows, setExpenseRows] = useState<any[]>([]);
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    expenseDate: new Date().toISOString().slice(0, 10),
    category: 'MISCELLANEOUS',
    amount: '',
    paymentMethod: 'CASH' as 'CASH' | 'CARD' | 'BANK' | 'ONLINE',
    payee: '',
    description: '',
    reference: '',
  });

  const loadExpenses = () => {
    setExpenseLoading(true);
    setExpenseError(null);
    inventoryApiService
      .listInventoryExpenses()
      .then(setExpenseRows)
      .catch((e) => setExpenseError(toErrorMessage(e)))
      .finally(() => setExpenseLoading(false));
  };
  useEffect(loadExpenses, []);

  const expenseColumns: TableColumn<any>[] = [
    {
      key: 'reference',
      header: 'Voucher Ref',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
          {formatShortRef(r.reference, r.id, 'EXP')}
        </span>
      ),
    },
    { key: 'expenseDate', header: 'Date', render: (r) => formatDateTimeDDMMYYYY(r.expenseDate) },
    { key: 'category', header: 'Category' },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => formatPKR(r.amount) },
    { key: 'paymentMethod', header: 'Method' },
    { key: 'payee', header: 'Payee/Supplier', render: (r) => r.payee || '—' },
    { key: 'description', header: 'Description', render: (r) => r.description || '—' },
    { key: 'createdBy', header: 'Entered By', render: (r) => r.createdByUser?.displayName || r.createdByUser?.username || '—' },
  ];

  const openExpenseForm = () => {
    const nextExp = ((expenseRows.length + 1) % 100) || 1;
    const autoRef = `EXP-${String(nextExp).padStart(2, '0')}`;
    setForm({
      expenseDate: new Date().toISOString().slice(0, 10),
      category: 'MISCELLANEOUS',
      amount: '',
      paymentMethod: 'CASH',
      payee: '',
      description: '',
      reference: autoRef,
    });
    setIsFormOpen(true);
  };

  const handleSaveExpense = async (addAnother: boolean) => {
    if (!(Number(form.amount) > 0)) return toast.error('Enter an amount greater than zero.', 'Missing Field');
    setSaving(true);
    try {
      await inventoryApiService.createInventoryExpense({
        expenseDate: form.expenseDate,
        category: form.category,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        payee: form.payee.trim() || undefined,
        description: form.description.trim() || undefined,
        reference: form.reference.trim() || undefined,
      });
      toast.success('Expense recorded.', 'Expense Saved');
      loadExpenses();
      if (addAnother) {
        setForm((f) => ({ ...f, amount: '', description: '', reference: '' }));
      } else {
        setIsFormOpen(false);
      }
    } catch (e) {
      toast.error(toErrorMessage(e), 'Save Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200 shadow-xs w-fit">
        {[
          { id: 'petty_cash' as Tab, label: 'Petty Cash Received' },
          { id: 'expenses' as Tab, label: 'Inventory Expenses' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
              tab === t.id ? 'bg-[#129b70] text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'petty_cash' && (
        <DataTable
          data={pettyCashRows}
          columns={pettyCashColumns}
          keyExtractor={(r) => r.id}
          title="Petty Cash Received"
          description="Petty cash credited to you by Admin/Super Admin."
          isLoading={pettyCashLoading}
          isError={!!pettyCashError}
          errorMessage={pettyCashError || undefined}
          onRefresh={loadPettyCash}
          enableSelection={false}
          enableImport={false}
          dateFilterEnabled={false}
        />
      )}

      {tab === 'expenses' && (
        <>
          <DataTable
            data={expenseRows}
            columns={expenseColumns}
            keyExtractor={(r) => r.id}
            title="Inventory Expenses"
            description="Store-related operating expenses — reduces your own expected cash when paid by cash."
            isLoading={expenseLoading}
            isError={!!expenseError}
            errorMessage={expenseError || undefined}
            onRefresh={loadExpenses}
            onAddNew={openExpenseForm}
            addNewLabel="+ New Expense"
            enableSelection={false}
            enableImport={false}
            dateFilterEnabled={false}
          />

          <Modal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            title="New Inventory Expense"
            footer={
              <>
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveExpense(true)}
                  disabled={saving}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Save & Add Another
                </button>
                <button type="button" onClick={() => handleSaveExpense(false)} disabled={saving} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Expense'}
                </button>
              </>
            }
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Date" type="date" value={form.expenseDate} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} />
                <Select
                  label="Category"
                  required
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, ' ') }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Amount" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                <Select
                  label="Payment Method"
                  required
                  value={form.paymentMethod}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as any }))}
                  options={[
                    { value: 'CASH', label: 'Cash' },
                    { value: 'CARD', label: 'Card' },
                    { value: 'BANK', label: 'Bank' },
                    { value: 'ONLINE', label: 'Online' },
                  ]}
                />
              </div>
              <TextInput label="Payee / Supplier (optional)" value={form.payee} onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))} />
              <TextInput label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Expense Voucher No. (Auto-Generated)
                  </label>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Lock className="h-2.5 w-2.5" /> Auto-Generated
                  </span>
                </div>
                <input
                  type="text"
                  value={form.reference}
                  readOnly
                  disabled
                  className="w-full px-2.5 py-2 bg-slate-100 border border-slate-300 rounded text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none"
                />
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
};
