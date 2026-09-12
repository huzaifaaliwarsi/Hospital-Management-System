import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Eye,
  AlertTriangle,
  Bed,
  CreditCard,
  FileText,
  Receipt,
  Building2,
  RotateCcw,
  UserCheck,
  ShieldCheck,
  Clock,
  Coins,
  Activity,
  ShoppingCart,
  ClipboardList,
  Pill,
  CornerDownLeft,
  Boxes,
  Package,
  Layers,
  Truck,
  ArrowLeftRight,
  Sliders,
  Building,
  CalendarX,
  AlertCircle,
  DollarSign,
  Tag,
  BarChart2,
  FileSpreadsheet,
  BadgePercent,
  PieChart,
  LineChart,
  BarChart,
  TrendingUp,
  FileBarChart,
  History,
  Briefcase,
  FileCheck,
  Network,
  LayoutGrid,
  UserCog,
  Key,
  ShieldAlert,
  Settings,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ChevronLeft,
  X,
  Search,
  LogOut,
  CalendarCheck,
  TrendingDown,
  Wallet,
  CheckSquare,
  FlaskConical,
  CalendarClock,
  Percent,
  BedDouble,
  BarChart3,
  FilePlus2,
  PackageSearch,
  FileBadge2,
  Calendar,
  SlidersHorizontal,
  Lock,
} from 'lucide-react';
import { HOSPITAL_INFO, SOFTWARE_PROVIDER } from '../../constants';
import { PORTAL_CONFIGS, PORTAL_NAVIGATION_MAP } from '../../constants/portalNavigations';
import { NavGroup, NavItem, PortalKey } from '../../types';
import { cn } from '../../utils/formatters';

interface SidebarProps {
  activePortal?: PortalKey;
  currentModule: string;
  onSelectModule: (moduleId: string) => void;
  onLogout?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

// Map icon string names to Lucide icons
const iconMap: Record<string, React.FC<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Stethoscope,
  Eye,
  AlertTriangle,
  Bed,
  CreditCard,
  FileText,
  Receipt,
  Building2,
  RotateCcw,
  UserCheck,
  ShieldCheck,
  Clock,
  Coins,
  Activity,
  ShoppingCart,
  ClipboardList,
  Pill,
  CornerDownLeft,
  Boxes,
  Package,
  Layers,
  Truck,
  ArrowLeftRight,
  Sliders,
  Building,
  CalendarX,
  AlertCircle,
  DollarSign,
  Tag,
  BarChart2,
  FileSpreadsheet,
  BadgePercent,
  PieChart,
  LineChart,
  BarChart,
  TrendingUp,
  FileBarChart,
  History,
  Briefcase,
  FileCheck,
  Network,
  LayoutGrid,
  UserCog,
  Key,
  ShieldAlert,
  Settings,
  LogOut,
  CalendarCheck,
  TrendingDown,
  Wallet,
  CheckSquare,
  FlaskConical,
  CalendarClock,
  Percent,
  BedDouble,
  BarChart3,
  FilePlus2,
  PackageSearch,
  FileBadge2,
  Calendar,
  SlidersHorizontal,
  Lock,
};

export const Sidebar: React.FC<SidebarProps> = ({
  activePortal = 'super-admin',
  currentModule,
  onSelectModule,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  // Collapsed sections tracking (default open)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [navSearch, setNavSearch] = useState('');

  const portalConfig = PORTAL_CONFIGS[activePortal] || PORTAL_CONFIGS['super-admin'];
  const portalGroups = PORTAL_NAVIGATION_MAP[activePortal] || PORTAL_NAVIGATION_MAP['super-admin'];

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const filteredGroups = portalGroups.map((group) => {
    if (!navSearch.trim()) return group;
    const search = navSearch.toLowerCase();
    const matchedItems = group.items.filter((item) =>
      item.label.toLowerCase().includes(search)
    );
    return {
      ...group,
      items: matchedItems,
    };
  }).filter((group) => group.items.length > 0);

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-40 bg-white text-[#1f2937] flex flex-col border-r border-[#e2eae5] transition-all duration-200 ease-in-out',
          // Desktop sizing
          isCollapsed ? 'lg:w-20' : 'lg:w-64',
          // Mobile responsive slide-over
          isMobileOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#e2eae5] bg-white shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-[#129b70] rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs">
              CSS
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="leading-tight truncate">
                <div className="text-xs font-bold text-[#111827] uppercase tracking-wider truncate">
                  CH Sharif & Saeed
                </div>
                <div className="text-[10px] text-[#52665e] font-medium truncate">
                  Hospital Management System
                </div>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-md text-[#52665e] hover:text-[#111827] hover:bg-[#f0faf6] transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-md text-[#52665e] hover:text-[#111827] hover:bg-[#f0faf6] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Portal Visual Identifier Banner */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="px-3 pt-3 pb-1 shrink-0">
            <div className="px-2.5 py-1.5 rounded-lg border border-[#c2e7db] bg-[#effaf5] text-center flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <span className="h-2 w-2 rounded-full bg-[#10b981] shrink-0 animate-pulse" />
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#0e7d5a] truncate">
                  {portalConfig.portalCode}
                </span>
              </div>
              <span className="text-[9px] text-[#52665e] uppercase font-mono shrink-0 ml-1 font-semibold">
                Portal
              </span>
            </div>
          </div>
        )}

        {/* Quick Menu Search (when expanded) */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="px-3 pt-3 pb-1 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#8b9e95] pointer-events-none" />
              <input
                type="text"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder="Quick module search..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f6faf8] text-[#111827] placeholder:text-[#8b9e95] rounded-lg border border-[#e2eae5] focus:outline-hidden focus:ring-2 focus:ring-[#129b70]/20 focus:border-[#129b70]"
              />
              {navSearch && (
                <button
                  onClick={() => setNavSearch('')}
                  className="absolute right-2.5 top-1.5 text-[#8b9e95] hover:text-[#111827] text-xs cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Groups List */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin scrollbar-thumb-[#e2eae5] scrollbar-track-transparent">
          {filteredGroups.map((group) => {
            const isGroupCollapsed = collapsedGroups[group.id];

            return (
              <div key={group.id} className="space-y-1">
                {/* Group Title Header */}
                {(!isCollapsed || isMobileOpen) && group.id !== 'main' ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-bold text-[#8b9e95] uppercase tracking-widest hover:text-[#52665e] transition-colors cursor-pointer"
                  >
                    <span>{group.title}</span>
                    {isGroupCollapsed ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                ) : (
                  (!isCollapsed || isMobileOpen) && (
                    <div className="px-3 text-[10px] font-bold text-[#8b9e95] uppercase tracking-widest mb-1">
                      {group.title}
                    </div>
                  )
                )}

                {/* Items in Group */}
                {(!isGroupCollapsed || isCollapsed) && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const IconComponent = item.icon ? iconMap[item.icon] : null;
                      const isActive =
                        currentModule === item.id ||
                        currentModule.replace(/-/g, '_') === item.id.replace(/-/g, '_');

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.id === 'logout' && onLogout) {
                              onLogout();
                            } else {
                              onSelectModule(item.id);
                            }
                            if (isMobileOpen) onCloseMobile();
                          }}
                          title={isCollapsed && !isMobileOpen ? item.label : undefined}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer',
                            item.id === 'logout'
                              ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 border border-rose-200'
                              : isActive
                              ? 'bg-[#dff5ea] text-[#0e7d5a] font-semibold border-l-2 border-[#129b70]'
                              : 'text-[#2d3748] hover:bg-[#f0faf6] hover:text-[#111827]',
                            isCollapsed && !isMobileOpen && 'justify-center px-0 py-2'
                          )}
                        >
                          {IconComponent && (
                            <IconComponent
                              className={cn(
                                'h-4 w-4 shrink-0',
                                item.id === 'logout'
                                  ? 'text-rose-600'
                                  : isActive
                                  ? 'text-[#129b70]'
                                  : 'text-[#52665e]'
                              )}
                            />
                          )}

                          {(!isCollapsed || isMobileOpen) && (
                            <>
                              <span className="truncate text-left flex-1 text-xs">{item.label}</span>
                              {item.badge && (
                                <span
                                  className={cn(
                                    'text-[10px] px-1.5 py-0.5 rounded font-mono',
                                    item.badgeVariant === 'danger'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : item.badgeVariant === 'warning'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db]'
                                  )}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer info: Logout Action + iSysware Attribution */}
        <div className="p-3 border-t border-[#e2eae5] text-[#52665e] shrink-0 space-y-2 bg-white">
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs',
                isCollapsed && !isMobileOpen && 'justify-center px-0'
              )}
              title="Logout"
            >
              <LogOut className="h-4 w-4 shrink-0 text-rose-600" />
              {(!isCollapsed || isMobileOpen) && <span>Logout</span>}
            </button>
          )}

          {(!isCollapsed || isMobileOpen) ? (
            <div className="text-[10px] text-[#8b9e95] text-center uppercase tracking-tight pt-1">
              Powered by <span className="text-[#129b70] font-semibold">{SOFTWARE_PROVIDER.name}</span>
            </div>
          ) : (
            <div className="flex justify-center text-[10px] font-bold text-[#129b70]" title={SOFTWARE_PROVIDER.name}>
              iS
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
