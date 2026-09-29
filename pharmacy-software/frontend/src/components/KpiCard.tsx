import React from 'react';
import type { LucideIcon } from 'lucide-react';

export const KpiCard: React.FC<{ label: string; value: string; icon: LucideIcon; tone?: 'default' | 'warning' | 'danger' }> = ({ label, value, icon: Icon, tone = 'default' }) => {
  const toneClasses = tone === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' : tone === 'danger' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-[#effaf5] text-[#0e7d5a] border-[#c2e7db]';
  return (
    <div className="bg-white rounded-xl border border-[#e2eae5] p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center border shrink-0 ${toneClasses}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-[#52665e] uppercase tracking-wide truncate">{label}</div>
        <div className="text-lg font-bold text-[#111827] truncate">{value}</div>
      </div>
    </div>
  );
};
