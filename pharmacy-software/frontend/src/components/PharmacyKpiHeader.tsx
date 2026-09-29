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
        const toneStyle =
          item.tone === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : item.tone === 'danger'
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : item.tone === 'warning'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : item.tone === 'info'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-[#effaf5] text-[#0e7d5a] border-[#c2e7db]';

        return (
          <div
            key={idx}
            className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 flex items-center gap-3.5 hover:border-slate-300 transition-colors"
          >
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center border shrink-0 ${toneStyle}`}>
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
