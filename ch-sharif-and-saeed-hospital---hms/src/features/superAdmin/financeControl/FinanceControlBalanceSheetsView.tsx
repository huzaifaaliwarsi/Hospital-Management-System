import React, { useState } from 'react';
import { Wallet, Loader2 } from 'lucide-react';
import { EmptyState } from '../../../components/common/StateViews';
import { useFilterOptions } from '../../../components/reports/reportFilters';
import { MyBalanceSheetView } from '../../frontDesk/billing/MyBalanceSheetView';
import { fetchManagementFilterOptions, EMPTY_MANAGEMENT_OPTIONS } from '../../../services/managementReportsService';

/**
 * Admin / Super Admin Balance Sheets — the exact Front Desk "My Balance Sheet"
 * screen (payments, expenses / refunds, balance summary), for any cash user
 * picked from the dropdown. Read-only: only the cashier settles their own cash.
 * The all-users comparison lives in Reports → Balance Sheet & Settlements.
 */
export const FinanceControlBalanceSheetsView: React.FC = () => {
  const options = useFilterOptions(fetchManagementFilterOptions, EMPTY_MANAGEMENT_OPTIONS);
  const optionsLoaded = options !== EMPTY_MANAGEMENT_OPTIONS;
  const { cashUsers } = options;
  const [pickedUserId, setUserId] = useState('');
  const userId = pickedUserId || cashUsers[0]?.value || '';

  const selected = cashUsers.find((u) => u.value === userId);

  const userPicker = (
    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
      User:
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="h-8 min-w-56 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold normal-case tracking-normal text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
      >
        {cashUsers.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>
    </label>
  );

  if (!optionsLoaded) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" /> <span>Loading balance sheets…</span>
      </div>
    );
  }

  if (!userId) {
    return (
      <EmptyState
        icon={<Wallet className="h-6 w-6" />}
        title="No cash users"
        description="Balance sheets appear here for Front Desk, Inventory and Pharmacy users who handle cash."
      />
    );
  }

  return (
    <MyBalanceSheetView
      userId={userId}
      userName={selected?.label}
      title="Balance Sheets"
      filterExtra={userPicker}
    />
  );
};
