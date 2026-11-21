import type { IncomeExpenseLedgerExecutiveTotals } from '../../../services/managementReportsService';

/** M01 presentation only: distinguish all-method payments from physical cash. */
export function m01SummaryRows(t: IncomeExpenseLedgerExecutiveTotals) {
  const cash = t.cashMovement;
  return [
    { label: 'Total Customer Collections (Net of Customer Refunds)', value: cash.totalCustomerCollections, emphasis: 'normal' },
    { label: 'Actual Paid Operating Expenses (Including Salary and Commission Payouts)', value: cash.actualPaidOperatingExpenses, emphasis: 'normal' },
    { label: 'Net Cash Movement', value: cash.netPhysicalCashMovement ?? cash.netCashMovement, emphasis: 'cash' },
    { label: 'Current Remaining Customer Dues', value: cash.currentRemainingCustomerDues, emphasis: 'normal' },
  ].map(row => ({ ...row, value: row.value === 0 ? 0 : row.value }));
}
