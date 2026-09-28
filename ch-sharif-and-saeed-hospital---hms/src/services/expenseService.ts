import apiClient from './apiClient';
import { toErrorMessage } from '../utils/apiErrors';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/formatters';
import type { ReportDatePreset } from '../components/reports/GenericReportView';

/**
 * Expense Management — `/api/v1/expenses` (`hms-backend/src/modules/expenses`).
 * Super Admin and Admin only. Entries are voided, never deleted.
 */

export type ExpenseCategory =
  | 'UTILITIES'
  | 'RENT'
  | 'MAINTENANCE_REPAIRS'
  | 'MEDICAL_SUPPLIES'
  | 'OFFICE_SUPPLIES'
  | 'EQUIPMENT'
  | 'CLEANING_SANITATION'
  | 'FOOD_REFRESHMENTS'
  | 'TRANSPORT'
  | 'MARKETING'
  | 'PROFESSIONAL_FEES'
  | 'MISCELLANEOUS';

export type ExpensePaymentMethod = 'CASH' | 'CARD' | 'BANK' | 'ONLINE';
export type ExpenseStatus = 'ACTIVE' | 'VOID';

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  UTILITIES: 'Utilities (Electricity / Gas / Water)',
  RENT: 'Rent',
  MAINTENANCE_REPAIRS: 'Maintenance & Repairs',
  MEDICAL_SUPPLIES: 'Medical Supplies',
  OFFICE_SUPPLIES: 'Office Supplies & Stationery',
  EQUIPMENT: 'Equipment',
  CLEANING_SANITATION: 'Cleaning & Sanitation',
  FOOD_REFRESHMENTS: 'Food & Refreshments',
  TRANSPORT: 'Transport & Fuel',
  MARKETING: 'Marketing & Advertising',
  PROFESSIONAL_FEES: 'Professional / Consultancy Fees',
  MISCELLANEOUS: 'Miscellaneous',
};

export const PAYMENT_METHOD_LABEL: Record<ExpensePaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK: 'Bank Transfer',
  ONLINE: 'Online',
};

/** Dropdown options (value / label) for filters and the expense form. */
export const EXPENSE_CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABEL).map(([value, label]) => ({ value, label }));
export const EXPENSE_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label }));

export interface ExpenseRecord {
  id: string;
  expenseNumber: string;
  /** YYYY-MM-DD (for the edit form). */
  expenseDate: string;
  /** DD/MM/YYYY (for display / export). */
  expenseDateLabel: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  paidTo: string;
  reference: string | null;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  status: ExpenseStatus;
  voidReason: string | null;
  voidedBy: string | null;
  enteredBy: string;
  enteredAt: string;
}

export interface ExpenseInput {
  expenseDate: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  paidTo: string;
  reference?: string;
  description?: string;
  departmentId?: string | null;
}

export type ExpenseFilters = Partial<Record<'category' | 'paymentMethod' | 'createdById' | 'departmentId' | 'status', string>>;

const userName = (u: any) => (u ? u.displayName || u.username : null);

function toRecord(r: any): ExpenseRecord {
  const iso = String(r.expenseDate).slice(0, 10);
  return {
    id: r.id,
    expenseNumber: r.expenseNumber,
    expenseDate: iso,
    expenseDateLabel: formatDateDDMMYYYY(iso),
    category: r.category,
    amount: Number(r.amount),
    paymentMethod: r.paymentMethod,
    paidTo: r.paidTo,
    reference: r.reference,
    description: r.description,
    departmentId: r.departmentId,
    departmentName: r.department?.name ?? null,
    status: r.status,
    voidReason: r.voidReason,
    voidedBy: userName(r.voidedByUser),
    enteredBy: userName(r.createdByUser) ?? '—',
    enteredAt: formatDateTimeDDMMYYYY(r.createdAt),
  };
}

async function call<T>(fn: () => Promise<{ data: { data: T } }>): Promise<T> {
  try {
    return (await fn()).data.data;
  } catch (err) {
    throw new Error(toErrorMessage(err));
  }
}

export async function fetchExpenses(
  range: { preset: ReportDatePreset; fromDate?: string; toDate?: string },
  filters: ExpenseFilters = {},
): Promise<{ periodLabel: string; rows: ExpenseRecord[] }> {
  const params = {
    preset: range.preset,
    ...(range.preset === 'custom' ? { fromDate: range.fromDate, toDate: range.toDate } : {}),
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  };
  const d = await call<any>(() => apiClient.get('/expenses', { params }));
  return { periodLabel: d.period.label, rows: d.rows.map(toRecord) };
}

export const createExpense = async (input: ExpenseInput) => toRecord(await call<any>(() => apiClient.post('/expenses', input)));

export const updateExpense = async (id: string, input: ExpenseInput) =>
  toRecord(await call<any>(() => apiClient.put(`/expenses/${id}`, input)));

export const voidExpense = async (id: string, reason: string) =>
  toRecord(await call<any>(() => apiClient.post(`/expenses/${id}/void`, { reason })));
