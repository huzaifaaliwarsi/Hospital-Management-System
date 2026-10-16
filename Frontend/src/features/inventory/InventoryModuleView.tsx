import React from 'react';
import { Construction } from 'lucide-react';
import { InventoryDashboard } from '../dashboard/InventoryDashboard';
import { StockOverviewView } from './StockOverviewView';
import { StockMovementCenterView } from './stockMovement/StockMovementCenterView';
import { StockInTab } from './stockMovement/StockInTab';
import { DepartmentIssueTab } from './stockMovement/DepartmentIssueTab';
import { DepartmentReturnTab } from './stockMovement/DepartmentReturnTab';
import { SupplierReturnTab } from './stockMovement/SupplierReturnTab';
import { AdjustmentTab } from './stockMovement/AdjustmentTab';
import { SupplierDirectoryView } from './SupplierDirectoryView';
import { SupplierLedgerView } from './SupplierLedgerView';
import { PettyCashExpensesView } from './cashExpenses/PettyCashExpensesView';
import { MyBalanceSheetView } from './cashExpenses/MyBalanceSheetView';
import { MyAccountSettlementView } from './cashExpenses/MyAccountSettlementView';
import { InventoryReportsView } from './reports/InventoryReportsView';
import { EmptyState } from '../../components/common/StateViews';

interface InventoryModuleViewProps {
  moduleId: string;
  moduleName: string;
  groupTitle: string;
}

/**
 * Deliberately NOT `ModulePlaceholderView` — that component's generic mock
 * data generator matches `moduleId.includes('stock')` (and falls back to
 * fake patient records otherwise), which would put fabricated medicine/
 * patient rows on Stock Overview, Supplier Ledger, etc. Every screen this
 * portal hasn't built yet gets an honest "not built" state instead.
 */
const InventoryComingSoon: React.FC<{ moduleName: string; groupTitle: string }> = ({ moduleName, groupTitle }) => (
  <div className="bg-white rounded-lg border border-slate-200 shadow-xs">
    <EmptyState
      icon={<Construction className="h-6 w-6" />}
      title={`${moduleName} — not built yet`}
      description={`${groupTitle} › ${moduleName} is on the Inventory build plan (inventory.md §9 steps 11–14) but has no screen or live data wired up yet.`}
      className="border-none my-0 py-16"
    />
  </div>
);

/**
 * Inventory portal dispatcher — each distinct screen is rendered directly.
 */
export const InventoryModuleView: React.FC<InventoryModuleViewProps> = ({ moduleId, moduleName, groupTitle }) => {
  switch (moduleId) {
    case 'dashboard':
      return <InventoryDashboard />;
    case 'stock_overview':
      return <StockOverviewView />;
    case 'stock_movement':
    case 'stock_in':
    case 'purchases_goods_receipt':
      return <StockInTab />;
    case 'department_issue':
    case 'department_issues':
      return <DepartmentIssueTab />;
    case 'department_return':
    case 'department_returns':
    case 'department_issue_return':
      return <DepartmentReturnTab />;
    case 'supplier_return':
    case 'supplier_returns':
      return <SupplierReturnTab />;
    case 'adjustment':
    case 'adjustments':
    case 'stock_adjustments':
      return <AdjustmentTab />;
    case 'supplier_directory':
    case 'supplier-directory':
    case 'vendors':
      return <SupplierDirectoryView />;
    case 'suppliers':
    case 'supplier_ledger':
    case 'supplier-ledger':
    case 'ledger':
      return <SupplierLedgerView />;
    case 'petty_cash_expenses':
    case 'petty-cash-expenses':
    case 'expenses':
      return <PettyCashExpensesView />;
    case 'my_balance_sheet':
    case 'my-balance-sheet':
    case 'balance_sheet':
      return <MyBalanceSheetView />;
    case 'my_account_settlement':
    case 'my-account-settlement':
    case 'settlement':
      return <MyAccountSettlementView />;
    // Reports (Expanded into individual navigation screens)
    case 'inventory_summary':
    case 'summary':
      return <InventoryReportsView defaultTab="summary" />;
    case 'stock_movement_report':
    case 'stock-movement-report':
    case 'movement_report':
      return <InventoryReportsView defaultTab="stock_movement" />;
    case 'purchase_report':
    case 'purchase-report':
    case 'purchases_report':
      return <InventoryReportsView defaultTab="purchases" />;
    case 'department_issue_return_report':
    case 'department-issue-return-report':
    case 'dept_issue_return_report':
      return <InventoryReportsView defaultTab="department_issue_return" />;
    case 'supplier_report':
    case 'supplier-report':
    case 'suppliers_report':
      return <InventoryReportsView defaultTab="suppliers" />;
    case 'expense_report':
    case 'expense-report':
    case 'expenses_report':
      return <InventoryReportsView defaultTab="expenses" />;
    case 'stock_status_report':
    case 'stock-status-report':
    case 'stock_status':
      return <InventoryReportsView defaultTab="stock_status" />;
    case 'cash_settlement_report':
    case 'cash-settlement-report':
    case 'settlement_report':
      return <InventoryReportsView defaultTab="cash_settlement" />;
    case 'inventory_reports':
    case 'inventory-reports':
    case 'reports':
      return <InventoryReportsView defaultTab="summary" />;
    default:
      return <InventoryDashboard />;
  }
};
