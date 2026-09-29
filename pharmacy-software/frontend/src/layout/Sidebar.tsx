import React from 'react';
import { LogOut } from 'lucide-react';
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
    <aside className="fixed top-0 bottom-0 left-0 z-40 w-64 bg-white text-[#1f2937] flex flex-col border-r border-[#e2eae5]">
      {/* Brand Header */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-[#e2eae5] bg-white shrink-0">
        <div className="w-8 h-8 bg-[#129b70] rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs">RX</div>
        <div className="leading-tight truncate">
          <div className="text-xs font-bold text-[#111827] uppercase tracking-wider truncate">Pharmacy Software</div>
          <div className="text-[10px] text-[#52665e] font-medium truncate">Management System</div>
        </div>
      </div>

      {/* Portal badge */}
      <div className="px-3 pt-3 pb-1 shrink-0">
        <div className="px-2.5 py-1.5 rounded-lg border border-[#c2e7db] bg-[#effaf5] text-center flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <span className="h-2 w-2 rounded-full bg-[#10b981] shrink-0 animate-pulse" />
            <span className="text-[10px] font-bold tracking-wider uppercase text-[#0e7d5a] truncate">{portalLabel}</span>
          </div>
          <span className="text-[9px] text-[#52665e] uppercase font-mono shrink-0 ml-1 font-semibold">Portal</span>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {groups.map((group) => (
          <div key={group.id} className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-[#8b9e95] uppercase tracking-widest mb-1">{group.title}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectPage(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                      isActive ? 'bg-[#dff5ea] text-[#0e7d5a] font-semibold border-l-2 border-[#129b70]' : 'text-[#2d3748] hover:bg-[#f0faf6] hover:text-[#111827]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#129b70]' : 'text-[#52665e]'}`} />
                    <span className="truncate text-left flex-1 text-xs">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#e2eae5] shrink-0 space-y-2">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" /> Logout
        </button>
        <p className="text-[9px] text-center text-[#94a3b8]">Powered by iSysware Software Solutions</p>
      </div>
    </aside>
  );
};
