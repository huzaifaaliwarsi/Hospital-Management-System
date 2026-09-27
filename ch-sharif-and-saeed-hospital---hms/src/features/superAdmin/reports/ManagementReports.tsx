import React, { useState } from 'react';
import { BarChart2, Receipt, AlertCircle, TrendingDown, FileSpreadsheet, Users, Boxes, Eye } from 'lucide-react';
import { GenericReportView } from '../../../components/reports/GenericReportView';
import { TextInput } from '../../../components/forms/FormControls';
import { useReportFilters, useFilterOptions, FilterSelect, opts } from '../../../components/reports/reportFilters';
import { InvoiceDetailModal } from '../../frontDesk/billing/InvoiceDetailModal';
import { AdmissionSummaryView } from '../../admission/AdmissionSimpleReports';
import {
  fetchExpenses,
  EXPENSE_CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_METHOD_OPTIONS,
  ExpenseRecord,
} from '../../../services/expenseService';
import { formatPKR, formatAmount } from '../../../utils/formatters';
import {
  fetchManagementFilterOptions,
  EMPTY_MANAGEMENT_OPTIONS,
  fetchManagementSummary,
  fetchBillingCollection,
  fetchOutstandingPanel,
  fetchBalanceSettlements,
  fetchStaffPayrollCommission,
  fetchInventoryPharmacy,
  SummaryRecord,
  BillingCollectionRow,
  OutstandingPanelRow,
  BalanceSettlementRow,
  StaffPayrollRow,
} from '../../../services/managementReportsService';

/**
 * Admin / Super Admin management reports (Super Admin_Admin Reporting.pdf,
 * reporting.md §8.3). Same UI as the Front Desk reports: GenericReportView +
 * one row of filters. No KPI cards — every figure is a table row, and every
 * table is `compact` so all money columns stay on screen.
 */

const useOptions = () => useFilterOptions(fetchManagementFilterOptions, EMPTY_MANAGEMENT_OPTIONS);

/** Money column: the currency lives in the header so every amount fits on screen. */
const money = <T,>(header: string, pick: (r: T) => number) => ({
  header: `${header} (PKR)`,
  align: 'right' as const,
  cell: (r: T) => formatAmount(pick(r)),
  excelValue: (r: T) => pick(r),
});
const count = <T,>(header: string, pick: (r: T) => number) => ({
  header,
  align: 'right' as const,
  cell: (r: T) => String(pick(r)),
  excelValue: (r: T) => pick(r),
});

const PAYMENT_METHOD = opts(['CASH', 'Cash'], ['CARD', 'Card'], ['BANK', 'Bank Transfer'], ['ONLINE', 'Online']);
const PAYMENT_STATUS = opts(['UNPAID', 'Unpaid'], ['PARTIALLY_PAID', 'Partially Paid'], ['PAID', 'Paid'], ['VOID', 'Void']);
const OUTSTANDING_STATUS = opts(['UNPAID', 'Unpaid'], ['PARTIALLY_PAID', 'Partially Paid'], ['PAID', 'Patient Paid — Panel Due']);
const PAYER_TYPE = opts(['SELF_PAY', 'Self-Pay'], ['PANEL', 'Panel']);
const CASH_PORTAL = opts(['BILLING', 'Front Desk / Billing'], ['INVENTORY', 'Inventory'], ['PHARMACY', 'Pharmacy']);
const SETTLEMENT_STATUS = opts(
  ['NONE', 'Not Settled'],
  ['SUBMITTED', 'Submitted'],
  ['ACCEPTED', 'Accepted'],
  ['PARTIALLY_ACCEPTED', 'Partially Accepted'],
  ['RETURNED', 'Returned'],
  ['REJECTED', 'Rejected'],
  ['REVERSED', 'Reversed'],
);
const PAYROLL_STATUS = opts(
  ['NOT_GENERATED', 'Not Generated'],
  ['DRAFT', 'Draft'],
  ['GENERATED', 'Generated'],
  ['APPROVED', 'Approved'],
  ['PARTIALLY_PAID', 'Partially Paid'],
  ['PAID', 'Paid'],
);
/** Readable label for a stored code (PAID → Paid), falling back to the code itself. */
const labelOf = (options: { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

const ALERT_STATUS =opts(['ALERTS', 'Alerts only (needs attention)']);

/** Columns for the summary reports, where each row is one figure. */
const SUMMARY_COLUMNS = [
  { header: 'Section', cell: (r: SummaryRecord) => r.section },
  { header: 'Metric', cell: (r: SummaryRecord) => r.metric },
  {
    header: 'Value',
    align: 'right' as const,
    cell: (r: SummaryRecord) => (r.isAmount ? formatPKR(r.value) : String(r.value)),
    excelValue: (r: SummaryRecord) => r.value,
  },
];

/** Row "View" action: the invoice number itself opens the invoice detail the Front Desk uses (saves a column on wide tables). */
const InvoiceLink: React.FC<{ number: string; onClick: () => void }> = ({ number, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title="View invoice"
    className="inline-flex items-center gap-1 font-semibold text-[#08775A] hover:underline text-left"
  >
    <Eye className="h-3 w-3 shrink-0" /> {number}
  </button>
);

// ── #1 Management Summary ─────────────────────────────────────────────────

export const ManagementSummaryReport: React.FC = () => {
  const options = useOptions();
  const { filters, bind, reset } = useReportFilters({ departmentId: '', portalUserId: '' });
  return (
    <GenericReportView<SummaryRecord>
      title="Management Summary"
      subtitle="Hospital overview — billing, collections, outstanding, expenses, admissions, beds and pending settlements."
      icon={BarChart2}
      filenamePrefix="Management_Summary"
      compact
      fetchReport={(range) => fetchManagementSummary(range, filters)}
      onResetExtraFilters={reset}
      extraFilters={
        <>
          <FilterSelect label="Department" options={options.departments} {...bind('departmentId')} />
          <FilterSelect label="Portal / User" options={options.users} {...bind('portalUserId')} />
        </>
      }
      rowKey={(r) => r.key}
      noTotalColumns={['Value']}
      emptyMessage="No billing or admissions in this period."
      columns={SUMMARY_COLUMNS}
    />
  );
};

// ── #2 Billing & Collection ───────────────────────────────────────────────

export const BillingCollectionReport: React.FC = () => {
  const options = useOptions();
  const { filters, bind, reset } = useReportFilters({ departmentId: '', collectedById: '', method: '', status: '', corporatePanelId: '' });
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  return (
    <>
      <GenericReportView<BillingCollectionRow>
        title="Billing & Collection"
        subtitle="Every Hospital invoice with its discount, collection, payment method and the user who collected it."
        icon={Receipt}
        filenamePrefix="Billing_Collection"
        compact
        fetchReport={(range) => fetchBillingCollection(range, filters)}
        onResetExtraFilters={reset}
        extraFilters={
          <>
            <FilterSelect label="Department" options={options.departments} {...bind('departmentId')} />
            <FilterSelect label="User / Cashier" options={options.cashiers} {...bind('collectedById')} />
            <FilterSelect label="Payment Method" options={PAYMENT_METHOD} {...bind('method')} />
            <FilterSelect label="Payment Status" options={PAYMENT_STATUS} {...bind('status')} />
            <FilterSelect label="Panel" options={options.panels} {...bind('corporatePanelId')} />
          </>
        }
        rowKey={(r) => r.id}
        emptyMessage="No invoices match these filters."
        columns={[
          { header: 'Invoice #', cell: (r) => r.invoiceNumber },
          { header: 'Date', cell: (r) => r.createdAt },
          { header: 'Patient / Payer', cell: (r) => `${r.patient} (${r.payer})` },
          { header: 'Department', cell: (r) => r.department || '—' },
          money('Gross', (r) => r.gross),
          money('Discount', (r) => r.discount),
          money('Net', (r) => r.net),
          money('Collected', (r) => r.collected),
          money('Outstanding', (r) => r.outstanding),
          {
            header: 'Payment Method',
            cell: (r) => (r.methods ? r.methods.split(', ').map((m) => labelOf(PAYMENT_METHOD, m)).join(', ') : '—'),
          },
          { header: 'Collected By', cell: (r) => r.collectedBy || '—' },
          { header: 'Status', cell: (r) => labelOf(PAYMENT_STATUS, r.status) },
        ]}
        renderCell={(col, row) => (col.header === 'Invoice #' ? <InvoiceLink number={row.invoiceNumber} onClick={() => setInvoiceId(row.id)} /> : col.cell(row))}
      />
      {invoiceId && <InvoiceDetailModal invoiceId={invoiceId} onClose={() => setInvoiceId(null)} onChanged={() => {}} />}
    </>
  );
};

// ── #3 Outstanding / Panel ────────────────────────────────────────────────

export const OutstandingPanelReport: React.FC = () => {
  const options = useOptions();
  const { filters, bind, reset } = useReportFilters({ payerType: '', corporatePanelId: '', departmentId: '', status: '' });
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  return (
    <>
      <GenericReportView<OutstandingPanelRow>
        title="Outstanding / Panel"
        subtitle="Every invoice with money still owed — Self-Pay patient dues and Panel / company receivables."
        icon={AlertCircle}
        filenamePrefix="Outstanding_Panel"
        compact
        fetchReport={(range) => fetchOutstandingPanel(range, filters)}
        onResetExtraFilters={reset}
        extraFilters={
          <>
            <FilterSelect label="Payer Type" options={PAYER_TYPE} {...bind('payerType')} />
            <FilterSelect label="Panel" options={options.panels} {...bind('corporatePanelId')} />
            <FilterSelect label="Department" options={options.departments} {...bind('departmentId')} />
            <FilterSelect label="Status" options={OUTSTANDING_STATUS} {...bind('status')} />
          </>
        }
        rowKey={(r) => r.id}
        emptyMessage="No outstanding invoices match these filters."
        columns={[
          { header: 'Invoice #', cell: (r) => r.invoiceNumber },
          { header: 'Date', cell: (r) => r.createdAt },
          { header: 'Patient', cell: (r) => r.patient },
          { header: 'Payer Type', cell: (r) => r.payerType },
          { header: 'Panel / Company', cell: (r) => r.panel || '—' },
          { header: 'Department', cell: (r) => r.department || '—' },
          money('Net', (r) => r.net),
          money('Paid', (r) => r.paid),
          money('Patient Due', (r) => r.patientDue),
          money('Panel Due', (r) => r.panelDue),
          money('Total Due', (r) => r.due),
          { header: 'Status', cell: (r) => labelOf(OUTSTANDING_STATUS, r.status) },
        ]}
        renderCell={(col, row) => (col.header === 'Invoice #' ? <InvoiceLink number={row.invoiceNumber} onClick={() => setInvoiceId(row.id)} /> : col.cell(row))}
      />
      {invoiceId && <InvoiceDetailModal invoiceId={invoiceId} onClose={() => setInvoiceId(null)} onChanged={() => {}} />}
    </>
  );
};

// ── #4 Admission & Bed Summary — the shared Admission Summary screen ──────────

export const AdmissionBedReport: React.FC = () => (
  <AdmissionSummaryView
    title="Admission & Bed Summary"
    subtitle="Admissions, discharges, active patients, occupied / available beds and Hospital due by department."
  />
);

// ── #5 Expense Report — read-only view of Expense Management (active entries) ──

export const ExpenseReport: React.FC = () => {
  const options = useOptions();
  const { filters, bind, reset } = useReportFilters({ category: '', paymentMethod: '', createdById: '' });
  return (
    <GenericReportView<ExpenseRecord>
      title="Expense Report"
      subtitle="Date, category, amount, method, details and Entered By. Voided expenses are excluded."
      icon={TrendingDown}
      filenamePrefix="Expense_Report"
      compact
      fetchReport={(range) => fetchExpenses(range, filters)}
      onResetExtraFilters={reset}
      extraFilters={
        <>
          <FilterSelect label="Category" options={EXPENSE_CATEGORY_OPTIONS} {...bind('category')} />
          <FilterSelect label="Payment Method" options={EXPENSE_METHOD_OPTIONS} {...bind('paymentMethod')} />
          <FilterSelect label="Entered By" options={options.users} {...bind('createdById')} />
        </>
      }
      rowKey={(r) => r.id}
      emptyMessage="No expenses for these filters."
      columns={[
        { header: 'Date', cell: (r) => r.expenseDateLabel },
        { header: 'Expense #', cell: (r) => r.expenseNumber },
        { header: 'Category', cell: (r) => EXPENSE_CATEGORY_LABEL[r.category] },
        money('Amount', (r) => r.amount),
        { header: 'Payment Method', cell: (r) => PAYMENT_METHOD_LABEL[r.paymentMethod] },
        { header: 'Paid To', cell: (r) => r.paidTo },
        { header: 'Details / Reference', cell: (r) => [r.description, r.reference].filter(Boolean).join(' · ') || '—' },
        { header: 'Entered By', cell: (r) => r.enteredBy },
      ]}
    />
  );
};

// ── #6 Balance Sheet & Account Settlements ────────────────────────────────

export const BalanceSettlementsReport: React.FC = () => {
  const options = useOptions();
  const { filters, bind, reset } = useReportFilters({ portal: '', portalUserId: '', settlementStatus: '' });
  return (
    <GenericReportView<BalanceSettlementRow>
      title="Balance Sheet & Account Settlements"
      subtitle="User-wise cash custody and settlements. Card / Bank / Online is shown separately and never counted as physical cash."
      icon={FileSpreadsheet}
      filenamePrefix="Balance_Settlements"
      compact
      fetchReport={(range) => fetchBalanceSettlements(range, filters)}
      onResetExtraFilters={reset}
      extraFilters={
        <>
          <FilterSelect label="Portal" options={CASH_PORTAL} {...bind('portal')} />
          <FilterSelect label="User" options={options.users} {...bind('portalUserId')} />
          <FilterSelect label="Settlement Status" options={SETTLEMENT_STATUS} {...bind('settlementStatus')} />
        </>
      }
      rowKey={(r) => r.key}
      emptyMessage="No cash activity or settlements in this period."
      columns={[
        { header: 'User', cell: (r) => r.user },
        { header: 'Portal', cell: (r) => r.portal },
        money('Opening / Petty Cash', (r) => r.opening + r.pettyCash),
        money('Cash Collections', (r) => r.cashCollections),
        money('Expenses / Refunds', (r) => r.expenses + r.refunds),
        money('Card / Bank / Online', (r) => r.nonCash),
        money('Expected Cash', (r) => r.expectedCash),
        money('Physical Submitted', (r) => r.submitted),
        money('Variance', (r) => r.variance),
        money('Accepted', (r) => r.accepted),
        money('Remaining', (r) => r.remaining),
        { header: 'Settlement Status', cell: (r) => labelOf(SETTLEMENT_STATUS, r.settlementStatus) },
      ]}
    />
  );
};

// ── #7 Staff / Payroll / Doctor Commission ────────────────────────────────

const currentMonth = () => new Date().toISOString().slice(0, 7);

/** "MONTHLY_COMMISSION — 60000" → "Monthly Commission — PKR 60,000". */
const formatSalaryBasis = (basis: string | null) => {
  if (!basis) return '—';
  const [kind = '', amount] = basis.split(' — ');
  const label = kind.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return amount ? `${label} — ${formatPKR(Number(amount))}` : label;
};

export const StaffPayrollCommissionReport: React.FC = () => {
  const options = useOptions();
  const { filters, bind, reset } = useReportFilters({ period: currentMonth(), departmentId: '', staffId: '', status: '' });
  return (
    <GenericReportView<StaffPayrollRow>
      title="Staff / Payroll / Doctor Commission"
      subtitle="Attendance days, salary basis, payroll amount and doctor commission for the payroll month."
      icon={Users}
      filenamePrefix="Staff_Payroll_Commission"
      compact
      noDateFilter
      fetchReport={() => fetchStaffPayrollCommission(filters)}
      onResetExtraFilters={reset}
      extraFilters={
        <>
          <div className="w-44">
            <TextInput label="Payroll Period" type="month" {...bind('period')} />
          </div>
          <FilterSelect label="Department" options={options.departments} {...bind('departmentId')} />
          <FilterSelect label="Staff / Doctor" options={options.staff} {...bind('staffId')} />
          <FilterSelect label="Status" options={PAYROLL_STATUS} {...bind('status')} />
        </>
      }
      rowKey={(r) => r.staffId}
      noTotalColumns={['Attendance Days']}
      emptyMessage="No staff match these filters."
      columns={[
        { header: 'Emp ID', cell: (r) => r.employeeId },
        { header: 'Staff / Doctor', cell: (r) => r.name },
        { header: 'Category', cell: (r) => r.category },
        { header: 'Department', cell: (r) => r.department || '—' },
        count('Attendance Days', (r) => r.attendanceDays),
        { header: 'Salary Basis', cell: (r) => formatSalaryBasis(r.salaryBasis) },
        money('Payroll Amount', (r) => r.payrollAmount),
        money('Doctor Commission', (r) => r.commissionAmount),
        { header: 'Status', cell: (r) => labelOf(PAYROLL_STATUS, r.status) },
      ]}
    />
  );
};

// ── #8 Inventory / Pharmacy Summary ───────────────────────────────────────

export const InventoryPharmacyReport: React.FC = () => {
  const options = useOptions();
  const { filters, bind, reset } = useReportFilters({ category: '', status: '' });
  return (
    <GenericReportView<SummaryRecord>
      title="Inventory / Pharmacy Summary"
      subtitle="Purchases, stock movement, low stock / expiry and Pharmacy request status. Detailed ledgers stay in their own modules."
      icon={Boxes}
      filenamePrefix="Inventory_Pharmacy_Summary"
      compact
      fetchReport={(range) => fetchInventoryPharmacy(range, filters)}
      onResetExtraFilters={reset}
      extraFilters={
        <>
          <FilterSelect label="Category" options={options.stockCategories} {...bind('category')} />
          <FilterSelect label="Status" options={ALERT_STATUS} {...bind('status')} />
        </>
      }
      rowKey={(r) => r.key}
      noTotalColumns={['Value']}
      emptyMessage="Nothing needs attention for these filters."
      columns={SUMMARY_COLUMNS}
    />
  );
};

/** Menu id → screen. Keys must match the `hm_reports` nav group in `constants/portalNavigations.ts`. */
export const MANAGEMENT_REPORT_VIEWS: Record<string, React.FC> = {
  sa_management_summary: ManagementSummaryReport,
  sa_billing_collection: BillingCollectionReport,
  sa_outstanding_panel: OutstandingPanelReport,
  sa_admission_bed: AdmissionBedReport,
  sa_expense: ExpenseReport,
  sa_balance_settlements: BalanceSettlementsReport,
  sa_staff_payroll_commission: StaffPayrollCommissionReport,
  sa_inventory_pharmacy: InventoryPharmacyReport,
};
