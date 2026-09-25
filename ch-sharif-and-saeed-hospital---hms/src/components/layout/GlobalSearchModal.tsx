import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  ArrowRight,
  User,
  BedDouble,
  Calendar,
  Stethoscope,
  Receipt,
  Building2,
  Users,
  Clock,
  Layers,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Command,
} from 'lucide-react';
import { PortalKey } from '../../types';
import { PORTAL_CONFIGS, PORTAL_NAVIGATION_MAP } from '../../constants/portalNavigations';
import { searchPanelPatients, PanelPatientSearchResult } from '../../services/patientRegistryService';
import { cn } from '../../utils/formatters';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePortal: PortalKey;
  onNavigate: (path: string) => void;
}

interface QuickActionItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'action' | 'navigation' | 'patient';
  path?: string;
  icon: React.ElementType;
  badge?: string;
  action?: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  activePortal,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [patientResults, setPatientResults] = useState<PanelPatientSearchResult[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'MODULES' | 'PATIENTS' | 'ACTIONS'>('ALL');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setPatientResults([]);
      setSelectedIndex(0);
      setSelectedCategory('ALL');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle global keyboard shortcuts (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search for panel patients
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setPatientResults([]);
      setIsSearchingPatients(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPatients(true);
      try {
        const results = await searchPanelPatients(trimmed);
        setPatientResults(results.slice(0, 6));
      } catch (err) {
        console.warn('Patient search error:', err);
        setPatientResults([]);
      } finally {
        setIsSearchingPatients(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const activePortalConfig = PORTAL_CONFIGS[activePortal] || PORTAL_CONFIGS['front-desk'];

  // Quick Actions scoped strictly to the current active portal
  const quickActions: QuickActionItem[] = useMemo(() => {
    if (activePortal === 'front-desk') {
      return [
        {
          id: 'qa-opd',
          title: 'Fast OPD Walk-In Intake',
          subtitle: 'Create outpatient doctor consultation invoice',
          category: 'action',
          path: '/front-desk/walk_in_intake?type=OPD',
          icon: Stethoscope,
          badge: 'Walk-In',
        },
        {
          id: 'qa-admission',
          title: 'New Inpatient Admission',
          subtitle: 'Admit or schedule patient admission to bed',
          category: 'action',
          path: '/front-desk/new_admission',
          icon: BedDouble,
          badge: 'Patient Flow',
        },
        {
          id: 'qa-appointment',
          title: 'Book Doctor Appointment',
          subtitle: 'Schedule consultant slot and fee collection',
          category: 'action',
          path: '/front-desk/appointments',
          icon: Calendar,
          badge: 'Patient Flow',
        },
        {
          id: 'qa-er',
          title: 'Emergency Intake & Triage',
          subtitle: 'Rapid intake for acute and trauma cases',
          category: 'action',
          path: '/front-desk/walk_in_intake?type=EMERGENCY',
          icon: Stethoscope,
          badge: 'ER Fast-Track',
        },
      ];
    }

    if (activePortal === 'admission') {
      return [
        {
          id: 'qa-checkin',
          title: 'Admission Check-In Queue',
          subtitle: 'Process planned admission arrivals and room handoff',
          category: 'action',
          path: '/admission/admission_check_in',
          icon: Users,
          badge: 'Admission',
        },
        {
          id: 'qa-bedboard',
          title: 'Ward Bed Board & Transfers',
          subtitle: 'Real-time hospital bed occupancy and transfers',
          category: 'action',
          path: '/admission/bed_board_transfers',
          icon: Building2,
          badge: 'Wards',
        },
        {
          id: 'qa-active-adm',
          title: 'Active Inpatients',
          subtitle: 'Manage admitted patients and ongoing stays',
          category: 'action',
          path: '/admission/active_admissions',
          icon: BedDouble,
          badge: 'Inpatients',
        },
        {
          id: 'qa-discharged',
          title: 'Discharged Inpatients',
          subtitle: 'View historical inpatient stays and discharge notes',
          category: 'action',
          path: '/admission/discharged_patients',
          icon: Users,
          badge: 'History',
        },
      ];
    }

    if (activePortal === 'super-admin' || activePortal === 'admin') {
      const prefix = activePortal === 'admin' ? '/admin' : '/super-admin';
      return [
        {
          id: 'qa-patients',
          title: 'Patient Master Registry',
          subtitle: 'Search and manage all hospital patient records',
          category: 'action',
          path: `${prefix}/patient_registry`,
          icon: Users,
          badge: 'Patients',
        },
        {
          id: 'qa-panels',
          title: 'Corporate Panels',
          subtitle: 'Manage panel organizations and credit policies',
          category: 'action',
          path: `${prefix}/corporate_panels`,
          icon: Building2,
          badge: 'Billing',
        },
        {
          id: 'qa-services',
          title: 'Service Rate Master',
          subtitle: 'Configure doctor fees and diagnostic charges',
          category: 'action',
          path: `${prefix}/service_rate_master`,
          icon: Receipt,
          badge: 'Rates',
        },
      ];
    }

    return [];
  }, [activePortal]);

  // Collect ONLY the modules belonging to the current active portal
  const portalModules: QuickActionItem[] = useMemo(() => {
    const config = PORTAL_CONFIGS[activePortal];
    const groups = PORTAL_NAVIGATION_MAP[activePortal];
    if (!config || !groups) return [];

    const items: QuickActionItem[] = [];
    for (const group of groups) {
      for (const navItem of group.items) {
        if (navItem.id === 'logout') continue;
        items.push({
          id: `mod-${activePortal}-${navItem.id}`,
          title: navItem.label,
          subtitle: `${group.title}`,
          category: 'navigation',
          path: `${config.routePrefix}/${navItem.id}`,
          icon: navItem.icon || Layers,
          badge: group.title,
        });
      }
    }
    return items;
  }, [activePortal]);

  // Filter items based on query & category
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    let actions = quickActions;
    let modules = portalModules;

    if (q) {
      actions = actions.filter(
        (a) => a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
      );
      modules = modules.filter(
        (m) => m.title.toLowerCase().includes(q) || m.subtitle.toLowerCase().includes(q)
      );
    }

    const patientItems: QuickActionItem[] = patientResults.map((p) => {
      let patientPath = `/front-desk/new_admission?patientId=${p.id}`;
      if (activePortal === 'admission') {
        patientPath = `/admission/admission_check_in?search=${encodeURIComponent(p.mrNumber)}`;
      } else if (activePortal === 'super-admin' || activePortal === 'admin') {
        patientPath = `/${activePortal}/patient_registry?search=${encodeURIComponent(p.mrNumber)}`;
      }
      return {
        id: `pat-${p.id}`,
        title: p.fullName,
        subtitle: `MRN: ${p.mrNumber} • ${p.phone || 'No Phone'} • Panel: ${p.panelName || 'General'}`,
        category: 'patient',
        path: patientPath,
        icon: User,
        badge: p.mrNumber,
      };
    });

    if (selectedCategory === 'MODULES') return modules;
    if (selectedCategory === 'ACTIONS') return actions;
    if (selectedCategory === 'PATIENTS') return patientItems;

    return [...actions.slice(0, q ? 6 : 4), ...patientItems, ...modules.slice(0, q ? 12 : 8)];
  }, [query, selectedCategory, quickActions, portalModules, patientResults, activePortal]);

  // Handle keyboard arrow navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = filteredItems[selectedIndex];
      if (current && current.path) {
        onNavigate(current.path);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/60">
          <Search className="h-5 w-5 text-[#08775A] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Search ${activePortalConfig.name} modules, actions, or patients...`}
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-500 shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 px-3.5 py-2 border-b border-slate-100 bg-white text-xs">
          {(['ALL', 'ACTIONS', 'PATIENTS', 'MODULES'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setSelectedIndex(0);
              }}
              className={cn(
                'px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors cursor-pointer',
                selectedCategory === cat
                  ? 'bg-[#e7f6f1] text-[#08775A] border border-[#c2e7db]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              {cat === 'ALL'
                ? 'All Results'
                : cat === 'ACTIONS'
                ? 'Quick Actions'
                : cat === 'PATIENTS'
                ? `Patients ${patientResults.length > 0 ? `(${patientResults.length})` : ''}`
                : 'Modules'}
            </button>
          ))}
          {isSearchingPatients && (
            <span className="ml-auto text-[10px] text-[#08775A] animate-pulse flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              Searching DB...
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-50">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Search className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No matching results found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Try searching for "Admission", "OPD", "Appointments", "Beds", or a patient name/MRN.
              </p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.path) {
                      onNavigate(item.path);
                      onClose();
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'p-2.5 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-[#effaf5] border border-[#c2e7db]'
                      : 'hover:bg-slate-50 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs',
                        item.category === 'action'
                          ? 'bg-[#08775A] text-white'
                          : item.category === 'patient'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected && (
                      <span className="text-[10px] text-[#08775A] font-semibold hidden sm:inline">
                        Press Enter ↵
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Keyboard Hints */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono bg-white border border-slate-200 rounded text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 font-mono bg-white border border-slate-200 rounded text-[10px]">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono bg-white border border-slate-200 rounded text-[10px]">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono bg-white border border-slate-200 rounded text-[10px]">ESC</kbd>
              Close
            </span>
          </div>
          <span className="text-[#08775A] font-semibold hidden sm:inline">{activePortalConfig.name} Search</span>
        </div>
      </div>
    </div>
  );
};
