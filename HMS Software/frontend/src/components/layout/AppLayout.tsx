import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { User, PortalType } from '../../types';
import { NAVIGATION_GROUPS, HOSPITAL_INFO, SOFTWARE_PROVIDER } from '../../constants';
import { Search, X, ArrowRight, ShieldCheck, HeartPulse } from 'lucide-react';
import { Modal } from '../common/Modal';
import { cn } from '../../utils/formatters';

interface AppLayoutProps {
  user: User;
  activePortal: PortalType;
  onChangePortal: (portal: PortalType) => void;
  currentModule: string;
  onSelectModule: (moduleId: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
  onOpenShowcase?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  user,
  activePortal,
  onChangePortal,
  currentModule,
  onSelectModule,
  onLogout,
  children,
  onOpenShowcase,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Find module & group titles
  let currentModuleName = 'Dashboard';
  let currentGroupTitle = 'Overview';

  for (const group of NAVIGATION_GROUPS) {
    const item = group.items.find((i) => i.id === currentModule);
    if (item) {
      currentModuleName = item.label;
      currentGroupTitle = group.title;
      break;
    }
  }

  // Quick search entries
  const allNavItems = NAVIGATION_GROUPS.flatMap((g) =>
    g.items.map((i) => ({ ...i, groupTitle: g.title }))
  );
  const filteredNavItems = searchQuery.trim()
    ? allNavItems.filter(
        (i) =>
          i.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.groupTitle.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allNavItems.slice(0, 8);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col antialiased text-slate-900 font-sans">
      {/* Sidebar */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={onSelectModule}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Wrapper (Offset for Sidebar) */}
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-200 ease-in-out min-w-0',
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        )}
      >
        {/* Header */}
        <Header
          user={user}
          activePortal={activePortal}
          onChangePortal={onChangePortal}
          currentModuleName={currentModuleName}
          currentGroupTitle={currentGroupTitle}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onLogout={onLogout}
          onOpenQuickSearch={() => setIsQuickSearchOpen(true)}
          onOpenShowcase={onOpenShowcase}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-5 lg:p-6 w-full mx-auto space-y-5 sm:space-y-6 min-w-0">
          {children}
        </main>

        {/* Global Enterprise Footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{HOSPITAL_INFO.name}</span>
              <span>•</span>
              <span>Hospital Management ERP</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <span>Engineered & Maintained by</span>
              <strong className="text-slate-700 font-semibold">{SOFTWARE_PROVIDER.name}</strong>
              <span>({SOFTWARE_PROVIDER.version})</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Quick Search Dialog Modal */}
      <Modal
        isOpen={isQuickSearchOpen}
        onClose={() => {
          setIsQuickSearchOpen(false);
          setSearchQuery('');
        }}
        title="Hospital Master Search"
        subtitle="Quickly navigate to any module, patient registry, or hospital service"
        maxWidth="lg"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type module, doctor, or keyword (e.g. OPD, Billing, Pharmacy)..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#149E75]/20 focus:border-[#149E75]"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 py-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Modules & Quick Actions
            </p>
            {filteredNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectModule(item.id);
                  setIsQuickSearchOpen(false);
                  setSearchQuery('');
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
              >
                <div>
                  <span className="font-semibold text-slate-800">{item.label}</span>
                  <span className="text-[10px] text-slate-400 block">{item.groupTitle}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
