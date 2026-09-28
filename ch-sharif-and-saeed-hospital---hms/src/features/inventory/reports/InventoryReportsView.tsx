import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Truck,
  ClipboardList,
  Building2,
  Wallet,
  Layers,
  Coins,
} from 'lucide-react';
import { cn } from '../../../utils/formatters';
import { GenericReportView, ReportDatePreset } from '../../../components/reports/GenericReportView';
import { useReportFilters, FilterSelect, opts } from '../../../components/reports/reportFilters';
import { formatPKR, formatDateTimeDDMMYYYY, formatShortRef } from '../../../utils/formatters';
import { inventoryReportsApiService } from '../../../services/inventoryReportsApiService';
import { fetchMySettlements, SettlementRecord } from '../../../services/settlementService';
import { useRouter } from '../../../context/RouterContext';

export type ReportTab =
  | 'summary'
  | 'stock_movement'
  | 'purchases'
  | 'department_issue_return'
  | 'suppliers'
  | 'expenses'
  | 'stock_status'
  | 'cash_settlement';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'summary', label: 'Inventory Summary' },
  { id: 'stock_movement', label: 'Stock Movement' },
  { id: 'purchases', label: 'Purchase / Stock In' },
  { id: 'department_issue_return', label: 'Department Issue & Return' },
  { id: 'suppliers', label: 'Supplier Report' },
  { id: 'expenses', label: 'Expense Report' },
  { id: 'stock_status', label: 'Stock Status' },
  { id: 'cash_settlement', label: 'Cash & Settlement' },
];

const range = (r: { preset: ReportDatePreset; fromDate?: string; toDate?: string }) => ({
  preset: r.preset,
  fromDate: r.fromDate,
  toDate: r.toDate,
});

export const SummaryReport: React.FC = () => (
  <GenericReportView
    title="Inventory Summary"
    subtitle="Stock, purchases, issues, returns, low stock, expiry and supplier due."
    icon={LayoutDashboard}
    filenamePrefix="Inventory_Summary"
    rowKey={(r: { metric: string }) => r.metric}
    emptyMessage="No summary data."
    columns={[
      { header: 'Metric', cell: (r: any) => r.metric },
      { header: 'Value', align: 'right', cell: (r: any) => r.value },
    ]}
    fetchReport={async (r) => {
      const s = await inventoryReportsApiService.getSummary(range(r));
      return {
        periodLabel: s.period.label,
        rows: [
          { metric: 'Total Items', value: String(s.totalItems) },
          { metric: 'Total Stock Value', value: formatPKR(s.totalStockValue) },
          { metric: 'Low Stock Items', value: String(s.lowStockCount) },
          { metric: 'Out of Stock Items', value: String(s.outOfStockCount) },
          { metric: 'Near Expiry Items', value: String(s.nearExpiryCount) },
          { metric: 'Stock In (period)', value: `${s.stockInCountInRange} GRNs — ${formatPKR(s.purchasesInRangeAmount)}` },
          { metric: 'Purchases (period)', value: `${s.purchasesInRangeCount} orders — ${formatPKR(s.purchasesInRangeAmount)}` },
          { metric: 'Department Issues (period)', value: String(s.issuesInRangeCount) },
          { metric: 'Returns (period)', value: String(s.returnsInRangeCount) },
          { metric: 'Supplier Payable', value: formatPKR(s.supplierPayable) },
        ],
      };
    }}
  />
);

export const StockMovementReport: React.FC = () => {
  const { filters, bind, reset } = useReportFilters({ movementType: '' });
  return (
    <GenericReportView
      title="Stock Movement"
      subtitle="Every stock In/Out/Return/Adjustment movement in one ledger."
      icon={ArrowLeftRight}
      filenamePrefix="Stock_Movement_Report"
      rowKey={(r: any) => r.id}
      emptyMessage="No stock movements in this period."
      onResetExtraFilters={reset}
      extraFilters={
        <FilterSelect
          label="Movement Type"
          options={opts(
            ['PURCHASE_RECEIPT', 'Stock In'],
            ['DEPARTMENT_ISSUE', 'Department Issue'],
            ['DEPARTMENT_RETURN', 'Department Return'],
            ['SUPPLIER_RETURN', 'Supplier Return'],
            ['POSITIVE_ADJUSTMENT', 'Positive Adjustment'],
            ['NEGATIVE_ADJUSTMENT', 'Negative Adjustment'],
          )}
          {...bind('movementType')}
        />
      }
      columns={[
        { header: 'Date', cell: (r: any) => formatDateTimeDDMMYYYY(r.createdAt) },
        { header: 'Item', cell: (r: any) => `${r.stockItem?.code ?? ''} — ${r.stockItem?.name ?? ''}` },
        { header: 'Type', cell: (r: any) => r.movementType },
        { header: 'Qty', align: 'right', cell: (r: any) => String(r.quantityDelta), excelValue: (r: any) => Number(r.quantityDelta) },
        { header: 'Batch', cell: (r: any) => formatShortRef(r.batchNo, undefined, 'BN') },
        { header: 'Actor', cell: (r: any) => r.actor?.username || '—' },
      ]}
      fetchReport={async (r) => {
        const res = await inventoryReportsApiService.getStockMovement({ ...range(r), movementType: filters.movementType || undefined });
        return { periodLabel: res.period.label, rows: res.rows };
      }}
    />
  );
};

export const PurchaseReport: React.FC = () => {
  const { filters, bind, reset } = useReportFilters({ paymentMethod: '' });
  return (
    <GenericReportView
      title="Purchase / Stock In"
      subtitle="GRN / purchase details, supplier, totals, payment type, paid/due."
      icon={Truck}
      filenamePrefix="Purchase_Report"
      rowKey={(r: any) => r.id}
      emptyMessage="No purchases in this period."
      onResetExtraFilters={reset}
      extraFilters={
        <FilterSelect
          label="Payment Method"
          options={opts(['CREDIT', 'Credit'], ['PETTY_CASH', 'Petty Cash'], ['MANAGEMENT_DIRECT', 'Management Direct'], ['ONLINE', 'Online / Bank'])}
          {...bind('paymentMethod')}
        />
      }
      columns={[
        { header: 'Date', cell: (r: any) => formatDateTimeDDMMYYYY(r.createdAt) },
        { header: 'Supplier', cell: (r: any) => r.supplier?.name || '—' },
        { header: 'Invoice Ref', cell: (r: any) => formatShortRef(r.invoiceReference, r.id, 'GRN') },
        { header: 'Payment Method', cell: (r: any) => r.paymentMethod },
        { header: 'Total', align: 'right', cell: (r: any) => formatPKR(r.totalAmount), excelValue: (r: any) => Number(r.totalAmount) },
        {
          header: 'Due',
          align: 'right',
          cell: (r: any) => formatPKR(r.paymentMethod === 'CREDIT' ? r.totalAmount : 0),
          excelValue: (r: any) => (r.paymentMethod === 'CREDIT' ? Number(r.totalAmount) : 0),
        },
        { header: 'Created By', cell: (r: any) => r.createdByUser?.displayName || r.createdByUser?.username || '—' },
      ]}
      fetchReport={async (r) => {
        const res = await inventoryReportsApiService.getPurchases({ ...range(r), paymentMethod: filters.paymentMethod || undefined });
        return { periodLabel: res.period.label, rows: res.rows };
      }}
    />
  );
};

interface FlatIssueLine {
  key: string;
  department: string;
  status: string;
  issuedAt: string;
  item: string;
  unit: string;
  issuedQty: number;
  returnedQty: number;
  netQty: number;
}

export const DepartmentIssueReturnReport: React.FC = () => {
  const { filters, bind, reset } = useReportFilters({ status: '' });
  return (
    <GenericReportView<FlatIssueLine>
      title="Department Issue & Return"
      subtitle="Department stock issued, returned and net quantity."
      icon={ClipboardList}
      filenamePrefix="Department_Issue_Return_Report"
      rowKey={(r) => r.key}
      emptyMessage="No department issues in this period."
      onResetExtraFilters={reset}
      extraFilters={
        <FilterSelect
          label="Status"
          options={opts(['ISSUED', 'Issued'], ['PARTIALLY_RETURNED', 'Partially Returned'], ['CLOSED', 'Closed'])}
          {...bind('status')}
        />
      }
      columns={[
        { header: 'Date', cell: (r) => r.issuedAt },
        { header: 'Department', cell: (r) => r.department },
        { header: 'Item', cell: (r) => r.item },
        { header: 'Issued Qty', align: 'right', cell: (r) => `${r.issuedQty} ${r.unit}`, excelValue: (r) => r.issuedQty },
        { header: 'Returned Qty', align: 'right', cell: (r) => `${r.returnedQty} ${r.unit}`, excelValue: (r) => r.returnedQty },
        { header: 'Net Qty', align: 'right', cell: (r) => `${r.netQty} ${r.unit}`, excelValue: (r) => r.netQty },
        { header: 'Status', cell: (r) => r.status },
      ]}
      fetchReport={async (r) => {
        const res = await inventoryReportsApiService.getDepartmentIssueReturn({ ...range(r), status: filters.status || undefined });
        const rows: FlatIssueLine[] = res.rows.flatMap((req: any) =>
          req.lines.map((l: any) => ({
            key: `${req.id}-${l.id}`,
            department: req.department,
            status: req.status,
            issuedAt: formatDateTimeDDMMYYYY(req.issuedAt),
            item: l.item,
            unit: l.unit,
            issuedQty: Number(l.issuedQty),
            returnedQty: Number(l.returnedQty),
            netQty: Number(l.netQty),
          })),
        );
        return { periodLabel: res.period.label, rows };
      }}
    />
  );
};

export const SupplierReport: React.FC = () => {
  const { filters, bind, reset } = useReportFilters({ transactionType: '' });
  return (
    <GenericReportView
      title="Supplier Report"
      subtitle="Supplier ledger statement across every supplier."
      icon={Building2}
      filenamePrefix="Supplier_Report"
      rowKey={(r: any) => r.id}
      emptyMessage="No supplier transactions in this period."
      onResetExtraFilters={reset}
      extraFilters={
        <FilterSelect
          label="Transaction Type"
          options={opts(['PURCHASE_CREDIT', 'Purchase'], ['PAYMENT', 'Payment'], ['RETURN', 'Return'], ['CREDIT_NOTE', 'Credit Note'])}
          {...bind('transactionType')}
        />
      }
      columns={[
        { header: 'Date', cell: (r: any) => formatDateTimeDDMMYYYY(r.createdAt) },
        { header: 'Supplier', cell: (r: any) => r.supplier?.name || '—' },
        { header: 'Type', cell: (r: any) => r.entryType },
        { header: 'Amount', align: 'right', cell: (r: any) => formatPKR(r.amount), excelValue: (r: any) => Number(r.amount) },
        { header: 'Actor', cell: (r: any) => r.actor?.username || '—' },
      ]}
      fetchReport={async (r) => {
        const res = await inventoryReportsApiService.getSuppliers({ ...range(r), transactionType: filters.transactionType || undefined });
        return { periodLabel: res.period.label, rows: res.rows };
      }}
    />
  );
};

export const ExpenseReport: React.FC = () => (
  <GenericReportView
    title="Expense Report"
    subtitle="Inventory expenses by category/method/user."
    icon={Wallet}
    filenamePrefix="Inventory_Expense_Report"
    rowKey={(r: any) => r.id}
    emptyMessage="No expenses in this period."
    columns={[
      { header: 'Date', cell: (r: any) => formatDateTimeDDMMYYYY(r.expenseDate) },
      { header: 'Category', cell: (r: any) => r.category },
      { header: 'Amount', align: 'right', cell: (r: any) => formatPKR(r.amount), excelValue: (r: any) => Number(r.amount) },
      { header: 'Method', cell: (r: any) => r.paymentMethod },
      { header: 'Payee', cell: (r: any) => r.payee || '—' },
      { header: 'Description', cell: (r: any) => r.description || '—' },
      { header: 'Entered By', cell: (r: any) => r.createdByUser?.displayName || r.createdByUser?.username || '—' },
    ]}
    fetchReport={async (r) => {
      const res = await inventoryReportsApiService.getExpenses(range(r));
      return { periodLabel: res.period.label, rows: res.rows };
    }}
  />
);

export const StockStatusReport: React.FC = () => {
  const { filters, bind, reset } = useReportFilters({ status: '' });
  return (
    <GenericReportView
      title="Stock Status"
      subtitle="Current stock, low stock, out-of-stock, batch/expiry."
      icon={Layers}
      filenamePrefix="Stock_Status_Report"
      noDateFilter
      rowKey={(r: any) => r.id}
      emptyMessage="No stock items match this filter."
      onResetExtraFilters={reset}
      extraFilters={
        <FilterSelect label="Status" options={opts(['OUT', 'Out of Stock'], ['LOW', 'Low Stock'], ['NORMAL', 'Normal'])} {...bind('status')} />
      }
      columns={[
        { header: 'Code', cell: (r: any) => r.code },
        { header: 'Name', cell: (r: any) => r.name },
        { header: 'Category', cell: (r: any) => r.category || '—' },
        { header: 'Current Stock', align: 'right', cell: (r: any) => `${r.currentStock} ${r.unit}`, excelValue: (r: any) => Number(r.currentStock) },
        { header: 'Reorder Level', align: 'right', cell: (r: any) => String(r.reorderLevel), excelValue: (r: any) => Number(r.reorderLevel) },
        { header: 'Status', cell: (r: any) => r.status },
      ]}
      fetchReport={async () => {
        const res = await inventoryReportsApiService.getStockStatus({ status: filters.status || undefined });
        return { rows: res.rows };
      }}
    />
  );
};

export const CashSettlementReport: React.FC = () => (
  <GenericReportView<SettlementRecord>
    title="Cash & Settlement"
    subtitle="My Account Settlement history. Full Balance Sheet detail lives on its own screen (Cash & Expenses › My Balance Sheet)."
    icon={Coins}
    filenamePrefix="Inventory_Cash_Settlement_Report"
    allTimeOption
    rowKey={(r) => r.id}
    emptyMessage="No settlements yet."
    columns={[
      { header: 'Submitted At', cell: (s) => s.submittedAt },
      { header: 'Status', cell: (s) => s.status },
      { header: 'Expected Cash', align: 'right', cell: (s) => formatPKR(s.expectedCash), excelValue: (s) => s.expectedCash },
      { header: 'Counted Cash', align: 'right', cell: (s) => formatPKR(s.physicalCash), excelValue: (s) => s.physicalCash },
      { header: 'Variance', align: 'right', cell: (s) => formatPKR(s.variance), excelValue: (s) => s.variance },
      { header: 'Reason', cell: (s) => s.varianceReason || '—' },
    ]}
    fetchReport={async (r) => ({
      periodLabel: r.preset === 'all' ? 'All Time' : undefined,
      rows: await fetchMySettlements(r),
    })}
  />
);

export const TAB_ROUTE_MAP: Record<ReportTab, string> = {
  summary: 'inventory_summary',
  stock_movement: 'stock_movement_report',
  purchases: 'purchase_report',
  department_issue_return: 'department_issue_return_report',
  suppliers: 'supplier_report',
  expenses: 'expense_report',
  stock_status: 'stock_status_report',
  cash_settlement: 'cash_settlement_report',
};

interface InventoryReportsViewProps {
  defaultTab?: ReportTab;
}

export const InventoryReportsView: React.FC<InventoryReportsViewProps> = ({ defaultTab = 'summary' }) => {
  const { navigate } = useRouter();
  const [tab, setTab] = useState<ReportTab>(defaultTab);

  useEffect(() => {
    if (defaultTab) {
      setTab(defaultTab);
    }
  }, [defaultTab]);

  const handleTabChange = (nextTab: ReportTab) => {
    setTab(nextTab);
    const route = TAB_ROUTE_MAP[nextTab];
    if (route) {
      navigate(`/inventory/${route}`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleTabChange(t.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer',
              tab === t.id ? 'bg-[#129b70] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryReport />}
      {tab === 'stock_movement' && <StockMovementReport />}
      {tab === 'purchases' && <PurchaseReport />}
      {tab === 'department_issue_return' && <DepartmentIssueReturnReport />}
      {tab === 'suppliers' && <SupplierReport />}
      {tab === 'expenses' && <ExpenseReport />}
      {tab === 'stock_status' && <StockStatusReport />}
      {tab === 'cash_settlement' && <CashSettlementReport />}
    </div>
  );
};
