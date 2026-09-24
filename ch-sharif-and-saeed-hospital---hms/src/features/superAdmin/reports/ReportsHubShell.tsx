import React, { useState } from 'react';

export interface ReportsHubItem {
  id: string;
  label: string;
  icon: React.ElementType;
  Component: React.ComponentType;
}

interface ReportsHubShellProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  items: ReportsHubItem[];
}

/**
 * Reporting Guide v7.5 — Super Admin/Admin oversight shell. Front Desk and
 * Admission each already own their own real, live report screens (built
 * this session, see `reporting.md`); this shell gives Super Admin/Admin the
 * SAME components in one place instead of duplicating them or wrapping them
 * in another mock layer. Every item here is the exact component the owning
 * portal renders for itself — read-only oversight, not a re-implementation.
 */
export const ReportsHubShell: React.FC<ReportsHubShellProps> = ({ icon: Icon, title, subtitle, items }) => {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const active = items.find((i) => i.id === activeId) ?? items[0];

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-2 h-fit lg:sticky lg:top-4">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-left whitespace-nowrap transition-colors ${
                  active?.id === item.id
                    ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="min-w-0">{active && <active.Component />}</div>
      </div>
    </div>
  );
};
