import React, { useEffect, useState } from 'react';
import { cn } from '../../../utils/formatters';
import { useRouter } from '../../../context/RouterContext';
import { StockInTab } from './StockInTab';
import { DepartmentIssueTab } from './DepartmentIssueTab';
import { DepartmentReturnTab } from './DepartmentReturnTab';
import { SupplierReturnTab } from './SupplierReturnTab';
import { AdjustmentTab } from './AdjustmentTab';

export type MovementTab = 'stock_in' | 'department_issue' | 'department_return' | 'supplier_return' | 'adjustment';

const TABS: { id: MovementTab; label: string }[] = [
  { id: 'stock_in', label: 'Stock In / Purchase' },
  { id: 'department_issue', label: 'Department Issue' },
  { id: 'department_return', label: 'Department Return' },
  { id: 'supplier_return', label: 'Supplier Return' },
  { id: 'adjustment', label: 'Adjustment' },
];

interface StockMovementCenterViewProps {
  initialTab?: MovementTab;
}

export const StockMovementCenterView: React.FC<StockMovementCenterViewProps> = ({ initialTab = 'stock_in' }) => {
  const { currentModule, navigate } = useRouter();

  const resolveTab = (): MovementTab => {
    if (initialTab && TABS.some((t) => t.id === initialTab)) return initialTab;
    if (currentModule === 'department_issue') return 'department_issue';
    if (currentModule === 'department_return') return 'department_return';
    if (currentModule === 'supplier_return') return 'supplier_return';
    if (currentModule === 'adjustment') return 'adjustment';
    return 'stock_in';
  };

  const [tab, setTab] = useState<MovementTab>(resolveTab);

  useEffect(() => {
    if (initialTab && TABS.some((t) => t.id === initialTab)) {
      setTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200 shadow-xs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              navigate(`/inventory/${t.id}`);
            }}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer',
              tab === t.id ? 'bg-[#129b70] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stock_in' && <StockInTab />}
      {tab === 'department_issue' && <DepartmentIssueTab />}
      {tab === 'department_return' && <DepartmentReturnTab />}
      {tab === 'supplier_return' && <SupplierReturnTab />}
      {tab === 'adjustment' && <AdjustmentTab />}
    </div>
  );
};
