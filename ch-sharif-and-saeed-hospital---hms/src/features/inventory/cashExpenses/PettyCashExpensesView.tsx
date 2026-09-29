import React, { useEffect, useState, useMemo } from 'react';
import {
  Lock,
  Wallet,
  Receipt,
  Coins,
  TrendingUp,
  Search,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  X,
  Plus,
} from 'lucide-react';
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
type DateFilter = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH';
type PettyCashTypeFilter = 'ALL' | 'OPENING_FLOAT' | 'TOP_UP' | 'OTHER';

/**
 * Petty Cash & Expenses (inventory.md §6.1, §9 step 13) — one screen, two
 * tabs, so the navigation stays small without mixing the two accounting
 * records.
 * Features:
 * - Top green KPI summary cards (Total Received, Incurred Expenses, Available Float, Breakdown)
 * - Real-time keyword search, type filter, and date-preset filter bar
 * - Formatted ID badges (#PC-XXXXXXXX and #EXP-XX)
 * - Beautiful date/time splitting and user authority avatars
 * - Smart note parser rendering Opening Float / Top-Up pills and clear descriptions
 */
export const PettyCashExpensesView: React.FC = () => {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('petty_cash');

  // Filters
  const [search, setSearch] = useState('');
  const [pettyCashTypeFilter, setPettyCashTypeFilter] = useState<PettyCashTypeFilter>('ALL');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');

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

  // Summary Metrics
  const totalFloatReceived = useMemo(
    () => pettyCashRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
    [pettyCashRows]
  );

  const openingFloatTotal = useMemo(
    () =>
      pettyCashRows
        .filter((r) => (r.note || '').toUpperCase().includes('OPENING FLOAT'))
        .reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
    [pettyCashRows]
  );

  const topUpTotal = useMemo(
    () =>
      pettyCashRows
        .filter(
          (r) =>
            (r.note || '').toUpperCase().includes('TOP-UP') ||
            (r.note || '').toUpperCase().includes('TOP UP')
        )
        .reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
    [pettyCashRows]
  );

  const totalExpenses = useMemo(
    () => expenseRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
    [expenseRows]
  );

  const cashExpenses = useMemo(
    () =>
      expenseRows
        .filter((r) => r.paymentMethod === 'CASH')
        .reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
    [expenseRows]
  );

  const netFloatInHand = totalFloatReceived - cashExpenses;

  // Filtered Rows
  const filteredPettyCashRows = useMemo(() => {
    return pettyCashRows.filter((r) => {
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const refMatch =
          `#pc-${r.id.slice(0, 8)}`.includes(q) ||
          r.id.toLowerCase().includes(q);
        const issuerMatch = (
          r.issuedByUser?.displayName ||
          r.issuedByUser?.username ||
          ''
        )
          .toLowerCase()
          .includes(q);
        const noteMatch = (r.note || '').toLowerCase().includes(q);
        const amountMatch = String(r.amount).includes(q);
        if (!refMatch && !issuerMatch && !noteMatch && !amountMatch) return false;
      }

      // Type filter
      if (pettyCashTypeFilter !== 'ALL') {
        const noteUpper = (r.note || '').toUpperCase();
        if (
          pettyCashTypeFilter === 'OPENING_FLOAT' &&
          !noteUpper.includes('OPENING FLOAT')
        )
          return false;
        if (
          pettyCashTypeFilter === 'TOP_UP' &&
          !noteUpper.includes('TOP-UP') &&
          !noteUpper.includes('TOP UP')
        )
          return false;
        if (
          pettyCashTypeFilter === 'OTHER' &&
          (noteUpper.includes('OPENING FLOAT') ||
            noteUpper.includes('TOP-UP') ||
            noteUpper.includes('TOP UP'))
        )
          return false;
      }

      // Date filter
      if (dateFilter !== 'ALL') {
        const rowDate = new Date(r.occurredAt);
        if (!isNaN(rowDate.getTime())) {
          const today = new Date();
          const isSameDay = (d1: Date, d2: Date) =>
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();

          if (dateFilter === 'TODAY' && !isSameDay(rowDate, today)) return false;
          if (dateFilter === 'YESTERDAY') {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            if (!isSameDay(rowDate, yesterday)) return false;
          }
          if (dateFilter === 'THIS_WEEK') {
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);
            if (rowDate < sevenDaysAgo) return false;
          }
          if (dateFilter === 'THIS_MONTH') {
            if (
              rowDate.getFullYear() !== today.getFullYear() ||
              rowDate.getMonth() !== today.getMonth()
            )
              return false;
          }
        }
      }

      return true;
    });
  }, [pettyCashRows, search, pettyCashTypeFilter, dateFilter]);

  const filteredExpenseRows = useMemo(() => {
    return expenseRows.filter((r) => {
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const refMatch =
          (r.reference || '').toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q);
        const payeeMatch = (r.payee || '').toLowerCase().includes(q);
        const descMatch = (r.description || '').toLowerCase().includes(q);
        const catMatch = (r.category || '').toLowerCase().includes(q);
        const amountMatch = String(r.amount).includes(q);
        if (!refMatch && !payeeMatch && !descMatch && !catMatch && !amountMatch)
          return false;
      }

      // Category filter
      if (expenseCategoryFilter !== 'ALL') {
        if (r.category !== expenseCategoryFilter) return false;
      }

      // Date filter
      if (dateFilter !== 'ALL') {
        const rowDate = new Date(r.expenseDate || r.createdAt);
        if (!isNaN(rowDate.getTime())) {
          const today = new Date();
          const isSameDay = (d1: Date, d2: Date) =>
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();

          if (dateFilter === 'TODAY' && !isSameDay(rowDate, today)) return false;
          if (dateFilter === 'YESTERDAY') {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            if (!isSameDay(rowDate, yesterday)) return false;
          }
          if (dateFilter === 'THIS_WEEK') {
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);
            if (rowDate < sevenDaysAgo) return false;
          }
          if (dateFilter === 'THIS_MONTH') {
            if (
              rowDate.getFullYear() !== today.getFullYear() ||
              rowDate.getMonth() !== today.getMonth()
            )
              return false;
          }
        }
      }

      return true;
    });
  }, [expenseRows, search, expenseCategoryFilter, dateFilter]);

  const hasActiveFilters =
    search.trim() !== '' ||
    dateFilter !== 'ALL' ||
    (tab === 'petty_cash' && pettyCashTypeFilter !== 'ALL') ||
    (tab === 'expenses' && expenseCategoryFilter !== 'ALL');

  const clearFilters = () => {
    setSearch('');
    setPettyCashTypeFilter('ALL');
    setExpenseCategoryFilter('ALL');
    setDateFilter('ALL');
  };

  // Columns with professional styling
  const pettyCashColumns: TableColumn<any>[] = [
    {
      key: 'id',
      header: 'Voucher Ref',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 shadow-2xs">
          #PC-{r.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'occurredAt',
      header: 'Date & Time',
      render: (r) => {
        const dateStr = formatDateTimeDDMMYYYY(r.occurredAt);
        const [d, t] = dateStr.includes(',') ? dateStr.split(', ') : [dateStr, ''];
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 text-xs">{d}</span>
            {t && (
              <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3 text-slate-400" />
                {t}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'issuedBy',
      header: 'Authorized By',
      render: (r) => {
        const name =
          r.issuedByUser?.displayName ||
          r.issuedByUser?.username ||
          'Super Admin';
        const initial = (name.charAt(0) || 'A').toUpperCase();
        return (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-200 uppercase shrink-0">
              {initial}
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-xs capitalize">
                {name}
              </div>
              <div className="text-[10px] text-slate-400">Finance & Admin</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Credit Amount',
      align: 'right',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 inline-flex items-center gap-1 shadow-2xs">
          <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
          + {formatPKR(r.amount)}
        </span>
      ),
    },
    {
      key: 'receivedBy',
      header: 'Recipient Custody',
      render: () => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <User className="h-3 w-3 text-slate-500" />
          <span className="capitalize">
            {currentUser?.name || currentUser?.username || 'Inventory Store'}
          </span>
        </span>
      ),
    },
    {
      key: 'note',
      header: 'Type & Purpose / Note',
      render: (r) => {
        const raw = (r.note || '').trim();
        if (!raw) return <span className="text-slate-400 text-xs">—</span>;

        // Smart parse: matches tags like [Opening Float] or [Top-Up]
        const match = raw.match(/^\[(.*?)\]\s*(.*)$/);
        if (match) {
          const badgeType = match[1].trim();
          const description = match[2].trim();
          const isOpening = badgeType.toLowerCase().includes('opening');
          const isTopUp = badgeType.toLowerCase().includes('top');

          return (
            <div className="flex flex-col gap-1 items-start py-0.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs',
                  isOpening
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : isTopUp
                    ? 'bg-sky-100 text-sky-900 border-sky-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isOpening
                      ? 'bg-amber-500'
                      : isTopUp
                      ? 'bg-sky-500'
                      : 'bg-emerald-500'
                  )}
                />
                {badgeType}
              </span>
              {description ? (
                <span className="text-xs text-slate-700 font-medium">
                  {description}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  No additional note
                </span>
              )}
            </div>
          );
        }

        return <span className="text-xs text-slate-800 font-medium">{raw}</span>;
      },
    },
  ];

  const expenseColumns: TableColumn<any>[] = [
    {
      key: 'reference',
      header: 'Voucher Ref',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-rose-800 bg-rose-50 px-2.5 py-1 rounded border border-rose-200 shadow-2xs">
          {formatShortRef(r.reference, r.id, 'EXP')}
        </span>
      ),
    },
    {
      key: 'expenseDate',
      header: 'Date & Time',
      render: (r) => {
        const dateStr = formatDateTimeDDMMYYYY(r.expenseDate || r.createdAt);
        const [d, t] = dateStr.includes(',') ? dateStr.split(', ') : [dateStr, ''];
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 text-xs">{d}</span>
            {t && (
              <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3 text-slate-400" />
                {t}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {r.category.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Disbursed Amount',
      align: 'right',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-rose-700 bg-rose-50 px-2.5 py-1 rounded border border-rose-200 inline-flex items-center gap-1 shadow-2xs">
          <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />
          - {formatPKR(r.amount)}
        </span>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Method',
      render: (r) => (
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border',
            r.paymentMethod === 'CASH'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          )}
        >
          {r.paymentMethod}
        </span>
      ),
    },
    {
      key: 'payee',
      header: 'Payee / Supplier',
      render: (r) => r.payee || <span className="text-slate-400 text-xs">—</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (r) =>
        r.description || <span className="text-slate-400 text-xs">—</span>,
    },
    {
      key: 'createdBy',
      header: 'Entered By',
      render: (r) => {
        const name =
          r.createdByUser?.displayName ||
          r.createdByUser?.username ||
          'Store Staff';
        return (
          <span className="inline-flex items-center gap-1 text-xs text-slate-700 font-medium">
            <User className="h-3 w-3 text-slate-400" />
            <span className="capitalize">{name}</span>
          </span>
        );
      },
    },
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
    if (!(Number(form.amount) > 0))
      return toast.error('Enter an amount greater than zero.', 'Missing Field');
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

  // Custom filter bar component passed to DataTable
  const filterToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search Input */}
      <div className="relative">
        <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            tab === 'petty_cash'
              ? 'Search ref, note, issuer...'
              : 'Search ref, payee, note...'
          }
          className="pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 w-48 sm:w-56 focus:outline-none focus:border-[#129b70] shadow-2xs"
        />
      </div>

      {/* Type / Category Filter */}
      {tab === 'petty_cash' ? (
        <select
          value={pettyCashTypeFilter}
          onChange={(e) => setPettyCashTypeFilter(e.target.value as any)}
          className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-[#129b70] shadow-2xs"
        >
          <option value="ALL">All Issuance Types</option>
          <option value="OPENING_FLOAT">Opening Float</option>
          <option value="TOP_UP">Top-Up</option>
          <option value="OTHER">Other Fund Issues</option>
        </select>
      ) : (
        <select
          value={expenseCategoryFilter}
          onChange={(e) => setExpenseCategoryFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-[#129b70] shadow-2xs"
        >
          <option value="ALL">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      )}

      {/* Date Filter */}
      <select
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value as any)}
        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-[#129b70] shadow-2xs"
      >
        <option value="ALL">All Time</option>
        <option value="TODAY">Today</option>
        <option value="YESTERDAY">Yesterday</option>
        <option value="THIS_WEEK">Last 7 Days</option>
        <option value="THIS_MONTH">This Month</option>
      </select>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-slate-50 flex items-center gap-1 transition-colors shadow-2xs"
          title="Reset active filters"
        >
          <X className="h-3 w-3" />
          <span>Clear Filters</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Top Green KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Total Float Received */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
              Total Float Received
            </div>
            <div className="text-xl font-bold text-emerald-800 mt-0.5 font-mono">
              {formatPKR(totalFloatReceived)}
            </div>
            <div className="text-[10px] text-slate-400">
              {pettyCashRows.length} cash inflows credited
            </div>
          </div>
        </div>

        {/* Card 2: Total Operating Expenses */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-rose-800 uppercase tracking-tight">
              Total Expenses Incurred
            </div>
            <div className="text-xl font-bold text-rose-700 mt-0.5 font-mono">
              {formatPKR(totalExpenses)}
            </div>
            <div className="text-[10px] text-rose-500">
              {expenseRows.length} expense vouchers logged
            </div>
          </div>
        </div>

        {/* Card 3: Available Float / Net Balance */}
        <div className="bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-200 shadow-xs flex items-center gap-3 relative overflow-hidden">
          <div className="p-2.5 rounded-lg bg-emerald-600 text-white shadow-xs">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight">
              Available Float Balance
            </div>
            <div className="text-xl font-bold text-emerald-900 mt-0.5 font-mono">
              {formatPKR(netFloatInHand)}
            </div>
            <div className="text-[10px] text-emerald-700 font-medium">
              Physical cash in till custody
            </div>
          </div>
        </div>

        {/* Card 4: Breakdown / Float Composition */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
              Float Composition
            </div>
            <div className="text-xs font-bold text-slate-900 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-mono">
                {formatPKR(openingFloatTotal)}
              </span>
              <span className="text-slate-400 text-[10px]">Float</span>
              <span className="text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 font-mono">
                {formatPKR(topUpTotal)}
              </span>
              <span className="text-slate-400 text-[10px]">Top-Up</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Opening Float vs Top-Up
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200 shadow-xs w-fit">
        {[
          {
            id: 'petty_cash' as Tab,
            label: 'Petty Cash Received',
            count: pettyCashRows.length,
          },
          {
            id: 'expenses' as Tab,
            label: 'Inventory Expenses',
            count: expenseRows.length,
          },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              clearFilters();
            }}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-2',
              tab === t.id
                ? 'bg-[#129b70] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            <span>{t.label}</span>
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                tab === t.id
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content 1: Petty Cash Received */}
      {tab === 'petty_cash' && (
        <DataTable
          data={filteredPettyCashRows}
          columns={pettyCashColumns}
          keyExtractor={(r) => r.id}
          title="Petty Cash Inflow Ledger"
          description="Cash float disbursements issued to your store custody by Hospital Finance / Super Admin."
          isLoading={pettyCashLoading}
          isError={!!pettyCashError}
          errorMessage={pettyCashError || undefined}
          onRefresh={loadPettyCash}
          enableSelection={false}
          enableImport={false}
          dateFilterEnabled={false}
          customFilterComponent={filterToolbar}
        />
      )}

      {/* Tab Content 2: Inventory Operating Expenses */}
      {tab === 'expenses' && (
        <>
          <DataTable
            data={filteredExpenseRows}
            columns={expenseColumns}
            keyExtractor={(r) => r.id}
            title="Store Operating Expenses"
            description="Store-related operating expenses — reduces your expected cash balance when disbursed via physical cash."
            isLoading={expenseLoading}
            isError={!!expenseError}
            errorMessage={expenseError || undefined}
            onRefresh={loadExpenses}
            onAddNew={openExpenseForm}
            addNewLabel="+ New Expense"
            enableSelection={false}
            enableImport={false}
            dateFilterEnabled={false}
            customFilterComponent={filterToolbar}
          />

          <Modal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            title="New Inventory Expense Voucher"
            maxWidth="md"
            footer={
              <>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
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
                <button
                  type="button"
                  onClick={() => handleSaveExpense(false)}
                  disabled={saving}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Expense'}
                </button>
              </>
            }
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  label="Date"
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expenseDate: e.target.value }))
                  }
                />
                <Select
                  label="Category"
                  required
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  options={EXPENSE_CATEGORIES.map((c) => ({
                    value: c,
                    label: c.replace(/_/g, ' '),
                  }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Amount"
                  required
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
                <Select
                  label="Payment Method"
                  required
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      paymentMethod: e.target.value as any,
                    }))
                  }
                  options={[
                    { value: 'CASH', label: 'Cash' },
                    { value: 'CARD', label: 'Card' },
                    { value: 'BANK', label: 'Bank' },
                    { value: 'ONLINE', label: 'Online' },
                  ]}
                />
              </div>
              <TextInput
                label="Payee / Supplier (optional)"
                value={form.payee}
                onChange={(e) =>
                  setForm((f) => ({ ...f, payee: e.target.value }))
                }
              />
              <TextInput
                label="Description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
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

