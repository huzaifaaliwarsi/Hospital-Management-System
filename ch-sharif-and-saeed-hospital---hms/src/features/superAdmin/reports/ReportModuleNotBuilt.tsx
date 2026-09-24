import React from 'react';
import { Wrench } from 'lucide-react';
import { EmptyState } from '../../../components/common/StateViews';

interface ReportModuleNotBuiltProps {
  moduleName: string;
}

/**
 * Reporting Guide v7.5 §1 scopes this build to Front Desk/Billing and
 * Admission reporting only — HR/Payroll (`staff_reports`,
 * `attendance_reports`, `salary_reports`) and Inventory/Commission
 * (`inventory_reports`, `commission_reports`) are separate domains with no
 * source data or endpoints built yet. Per `reporting.md` Step 1, these show
 * an honest "not built" state instead of `SuperAdminReportsView`'s
 * fabricated rows.
 */
export const ReportModuleNotBuilt: React.FC<ReportModuleNotBuiltProps> = ({ moduleName }) => (
  <div className="space-y-5 animate-in fade-in duration-150">
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
      <h1 className="text-xl font-bold text-slate-900">{moduleName}</h1>
      <p className="text-xs text-slate-500 mt-1">This report module is outside the current reporting build.</p>
    </div>
    <EmptyState
      icon={<Wrench className="h-6 w-6" />}
      title="Not built yet"
      description={`${moduleName} belongs to a separate HR/Payroll/Inventory workstream that hasn't been implemented — this screen intentionally shows no data rather than fabricated ones.`}
    />
  </div>
);
