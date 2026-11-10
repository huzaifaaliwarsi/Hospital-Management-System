import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface KpiItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

interface PharmacyKpiHeaderProps {
  items: KpiItem[];
}

export const PharmacyKpiHeader: React.FC<PharmacyKpiHeaderProps> = ({ items }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
      {items.map((item, idx) => {
        const Icon = item.icon;
        const config =
          item.tone === 'success'
            ? { borderTop: 'border-t-emerald-600', iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
            : item.tone === 'danger'
            ? { borderTop: 'border-t-rose-600', iconBg: 'bg-rose-50 text-rose-700 border-rose-200' }
            : item.tone === 'warning'
            ? { borderTop: 'border-t-amber-500', iconBg: 'bg-amber-50 text-amber-700 border-amber-200' }
            : item.tone === 'info'
            ? { borderTop: 'border-t-blue-600', iconBg: 'bg-blue-50 text-blue-700 border-blue-200' }
            : { borderTop: 'border-t-teal-600', iconBg: 'bg-[#effaf5] text-[#0e7d5a] border-[#c2e7db]' };

        return (
          <div
            key={idx}
            className={`bg-white rounded-2xl border border-slate-200/60 border-t-[3.5px] ${config.borderTop} shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-4 sm:p-5 flex items-center gap-3.5 hover:shadow-md transition-all`}
          >
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center border shrink-0 ${config.iconBg}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                {item.label}
              </div>
              <div className="text-lg font-extrabold text-slate-900 truncate tabular-nums">
                {item.value}
              </div>
              {item.subtitle && (
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {item.subtitle}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
