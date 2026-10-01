import React from 'react';
import { LogOut, Activity, Pill } from 'lucide-react';
import type { NavGroup } from './navigation';

interface SidebarProps {
  groups: NavGroup[];
  portalLabel: string;
  currentPage: string;
  onSelectPage: (id: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ groups, portalLabel, currentPage, onSelectPage, onLogout }) => {
  return (
    <aside className="fixed top-0 bottom-0 left-0 z-40 w-64 bg-white text-slate-800 flex flex-col border-r border-slate-200/80 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100 bg-white shrink-0">
        <div className="w-9 h-9 bg-gradient-to-br from-[#0c6b50] to-[#0e7d5a] rounded-xl flex items-center justify-center text-white shadow-sm ring-2 ring-emerald-500/20 shrink-0">
          <Pill className="h-5 w-5 transform -rotate-45" />
        </div>
        <div className="leading-tight truncate">
          <div className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <span>PharmaCare ERP</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium truncate">Smart Pharmacy Management</div>
        </div>
      </div>

      {/* Portal Role Badge */}
      <div className="px-4 pt-3.5 pb-1 shrink-0">
        <div className="px-3 py-1.5 rounded-lg bg-emerald-50/70 border border-emerald-100/80 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10.5px] font-semibold text-emerald-800 tracking-wide uppercase truncate">{portalLabel}</span>
          </div>
          <Activity className="h-3 w-3 text-emerald-600 shrink-0" />
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {groups.map((group) => (
          <div key={group.id} className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectPage(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-[#0e7d5a] text-white font-semibold shadow-sm shadow-emerald-900/10'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate text-left flex-1">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer without Upgrade to Pro (as requested) */}
      <div className="p-3 border-t border-slate-100 shrink-0 space-y-2 bg-white">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50/70 hover:bg-rose-100/70 border border-rose-100 transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" /> Logout Session
        </button>
        <p className="text-[10px] text-center text-slate-400">CH Hospital Pharmacy &copy; 2026</p>
      </div>
    </aside>
  );
};

