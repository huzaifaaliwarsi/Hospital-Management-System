import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface KpiItem {
  label?: string;
  title?: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'indigo';
  accentColor?: string;
  category?: string;
  badge?: React.ReactNode;
}

interface HospitalKpiHeaderProps {
  items?: KpiItem[];
  cards?: KpiItem[];
  columns?: string;
  className?: string;
}

export const HospitalKpiHeader: React.FC<HospitalKpiHeaderProps> = ({
  items,
  cards,
  columns = 'grid-cols-2 lg:grid-cols-4',
  className = '',
}) => {
  const displayItems = cards || items || [];

  return (
    <div className={`grid ${columns} gap-3.5 ${className}`}>
      {displayItems.map((item, idx) => {
        const Icon = item.icon;
        const heading = item.title || item.label || '';

        // If accentColor is hex, derive border & icon styles, else fallback to tone
        let borderTopClass = 'border-t-teal-600';
        let iconClass = 'bg-[#effaf5] text-[#0e7d5a] border-[#c2e7db]';

        if (item.accentColor) {
          if (item.accentColor.includes('08775A') || item.accentColor.includes('0e7d5a')) {
            borderTopClass = 'border-t-[#08775A]';
            iconClass = 'bg-[#effaf5] text-[#08775A] border-[#c2e7db]';
          } else if (item.accentColor.includes('0284c7')) {
            borderTopClass = 'border-t-[#0284c7]';
            iconClass = 'bg-sky-50 text-[#0284c7] border-sky-200';
          } else if (item.accentColor.includes('16a34a')) {
            borderTopClass = 'border-t-[#16a34a]';
            iconClass = 'bg-emerald-50 text-[#16a34a] border-emerald-200';
          } else if (item.accentColor.includes('dc2626')) {
            borderTopClass = 'border-t-[#dc2626]';
            iconClass = 'bg-rose-50 text-[#dc2626] border-rose-200';
          } else if (item.accentColor.includes('8b5cf6')) {
            borderTopClass = 'border-t-[#8b5cf6]';
            iconClass = 'bg-purple-50 text-[#8b5cf6] border-purple-200';
          } else if (item.accentColor.includes('f59e0b')) {
            borderTopClass = 'border-t-[#f59e0b]';
            iconClass = 'bg-amber-50 text-[#f59e0b] border-amber-200';
          }
        } else if (item.tone === 'success') {
          borderTopClass = 'border-t-emerald-600';
          iconClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else if (item.tone === 'danger') {
          borderTopClass = 'border-t-rose-600';
          iconClass = 'bg-rose-50 text-rose-700 border-rose-200';
        } else if (item.tone === 'warning') {
          borderTopClass = 'border-t-amber-500';
          iconClass = 'bg-amber-50 text-amber-700 border-amber-200';
        } else if (item.tone === 'info') {
          borderTopClass = 'border-t-blue-600';
          iconClass = 'bg-blue-50 text-blue-700 border-blue-200';
        } else if (item.tone === 'indigo') {
          borderTopClass = 'border-t-indigo-600';
          iconClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        }

        return (
          <div
            key={idx}
            className={`bg-white rounded-2xl border border-slate-200/80 border-t-[3.5px] ${borderTopClass} shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-4 sm:p-5 flex items-center gap-3.5 hover:shadow-md transition-all`}
          >
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center border shrink-0 ${iconClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  {item.category || heading}
                </div>
                {item.badge}
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-slate-900 truncate tabular-nums mt-0.5">
                {item.value}
              </div>
              {item.subtitle ? (
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {item.subtitle}
                </div>
              ) : (
                item.category && (
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {heading}
                  </div>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

