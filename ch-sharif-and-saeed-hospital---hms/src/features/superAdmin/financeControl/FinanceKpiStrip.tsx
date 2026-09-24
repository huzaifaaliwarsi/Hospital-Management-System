import React from 'react';
import { Banknote, CreditCard, RotateCcw, Wallet, Users, AlertTriangle, CheckSquare } from 'lucide-react';
import { formatPKR } from '../../../utils/formatters';
import type { FinanceKpis } from '../../../services/financeControlService';

interface TileProps {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  subtext?: string;
  alert?: boolean;
}

const KpiTile: React.FC<TileProps> = ({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  subtext,
  alert,
}) => (
  <div
    className={`bg-white rounded-2xl border p-4 shadow-xs transition-all duration-150 hover:shadow-sm flex flex-col justify-between ${
      alert ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200/90 hover:border-slate-300'
    }`}
  >
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-2xs`}>
        <Icon className="h-4 w-4" />
      </div>
      {subtext && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {subtext}
        </span>
      )}
    </div>

    <div>
      <div className="text-xl font-bold text-slate-900 font-mono tracking-tight">
        {value}
      </div>
      <p className="text-[11px] font-semibold text-slate-600 leading-snug mt-1">
        {label}
      </p>
    </div>
  </div>
);

/** Shared KPI strip for Finance Control modules — high contrast, no truncated labels */
export const FinanceKpiStrip: React.FC<{ kpis: FinanceKpis }> = ({ kpis }) => {
  const nonCashBreakdown = Object.entries(kpis.collectionsByMethod)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: ${formatPKR(v)}`)
    .join(', ');

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
      {/* 1. Cash Collected */}
      <KpiTile
        label="Cash Collected"
        value={formatPKR(kpis.totalCashCollectedToday)}
        icon={Banknote}
        iconBg="bg-emerald-50"
        iconColor="text-[#08775A]"
        subtext="Drawer In"
      />

      {/* 2. Non-Cash Collected */}
      <KpiTile
        label="Non-Cash Collections"
        value={formatPKR(kpis.totalNonCashCollectedToday)}
        icon={CreditCard}
        iconBg="bg-blue-50"
        iconColor="text-blue-700"
        subtext={nonCashBreakdown ? 'Cards/Bank' : 'Digital'}
      />

      {/* 3. Refunds */}
      <KpiTile
        label="Refunds Issued"
        value={formatPKR(kpis.totalRefundsToday)}
        icon={RotateCcw}
        iconBg="bg-rose-50"
        iconColor="text-rose-700"
        subtext="Disbursed"
      />

      {/* 4. Unsettled Cash */}
      <KpiTile
        label="Unsettled Drawer Cash"
        value={formatPKR(kpis.totalUnsettledCash)}
        icon={Wallet}
        iconBg="bg-amber-50"
        iconColor="text-amber-700"
        subtext="In Custody"
      />

      {/* 5. Users Pending Settlement */}
      <KpiTile
        label="Cashiers Pending Shift Close"
        value={String(kpis.usersPendingSettlementCount)}
        icon={Users}
        iconBg={kpis.usersPendingSettlementCount > 0 ? 'bg-amber-100' : 'bg-slate-100'}
        iconColor={kpis.usersPendingSettlementCount > 0 ? 'text-amber-800' : 'text-slate-600'}
        subtext="Active"
        alert={kpis.usersPendingSettlementCount > 0}
      />

      {/* 6. Settlement Differences */}
      <KpiTile
        label="Settlement Variances"
        value={String(kpis.settlementDifferencesCount)}
        icon={AlertTriangle}
        iconBg={kpis.settlementDifferencesCount > 0 ? 'bg-rose-100' : 'bg-slate-100'}
        iconColor={kpis.settlementDifferencesCount > 0 ? 'text-rose-800' : 'text-slate-600'}
        subtext="Audit"
        alert={kpis.settlementDifferencesCount > 0}
      />

      {/* 7. Settlements Completed */}
      <KpiTile
        label="Settlements Completed"
        value={String(kpis.settlementsCompletedTodayCount)}
        icon={CheckSquare}
        iconBg="bg-[#effaf5]"
        iconColor="text-[#08775A]"
        subtext="Audited"
      />
    </div>
  );
};
