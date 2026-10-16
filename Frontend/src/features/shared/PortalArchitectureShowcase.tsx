import React from 'react';
import {
  ShieldCheck,
  Building,
  CreditCard,
  Bed,
  Pill,
  Package,
  KeyRound,
  LayoutDashboard,
  ExternalLink,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';
import { PORTAL_CONFIGS, PORTAL_NAVIGATION_MAP } from '../../constants/portalNavigations';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { PortalKey } from '../../types';

export const PortalArchitectureShowcase: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser, logout } = useAuth();

  const portals: PortalKey[] = [
    'super-admin',
    'admin',
    'front-desk',
    'admission',
    'inventory',
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Executive Architecture Overview Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 uppercase tracking-wide">
                Role-Based Architecture Matrix
              </span>
              <h1 className="text-lg font-bold text-slate-900">
                CH Sharif & Saeed Hospital • Multi-Portal Subsystem Engine
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Engineered by <strong className="text-slate-700">iSysware Software Solutions</strong>.
              Each subsystem possesses an independent login portal, distinct sidebar navigation, scoped route guards, and isolated operational workflows.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              Current Session:{' '}
              <strong className="text-slate-900">{currentUser?.name}</strong>{' '}
              <span className="text-slate-500">({currentUser?.role})</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="px-2.5 py-1.5 rounded text-xs font-semibold bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* 5 Portals Verification Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {portals.map((portalKey) => {
          const cfg = PORTAL_CONFIGS[portalKey];
          const navGroups = PORTAL_NAVIGATION_MAP[portalKey];
          const totalModules = navGroups.reduce((acc, g) => acc + g.items.length, 0);

          return (
            <div
              key={portalKey}
              className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between overflow-hidden"
            >
              {/* Card Header with Portal Theme */}
              <div className={`p-4 border-b border-slate-100 ${cfg.badgeBg}`}>
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    <span className="text-xs font-mono font-bold tracking-wider uppercase">
                      {cfg.portalCode}
                    </span>
                  </div>
                  <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded font-medium">
                    {cfg.role}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white mt-1.5">{cfg.name}</h2>
                <p className="text-xs text-slate-200/90 mt-0.5 leading-snug">
                  {cfg.description}
                </p>
              </div>

              {/* Module & Credentials Specs */}
              <div className="p-4 space-y-3 flex-1 text-xs">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Route Architecture
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-100 font-mono text-[11px] text-slate-700">
                    <div>Prefix: <strong className="text-blue-900">{cfg.routePrefix}/*</strong></div>
                    <div>Default: <strong className="text-slate-800">{cfg.defaultRoute}</strong></div>
                    <div>Login: <strong className="text-indigo-900">{cfg.loginRoute}</strong></div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex justify-between">
                    <span>Navigation Modules ({totalModules})</span>
                    <span className="text-slate-400 font-normal">Scoped only to this role</span>
                  </div>
                  <div className="space-y-1">
                    {navGroups.map((g) => (
                      <div key={g.id} className="flex items-start gap-1 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800 shrink-0">{g.title}:</span>
                        <span className="truncate text-slate-500">
                          {g.items.map((i) => i.label).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Role-Based Access Isolation Note */}
                <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-700 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Access Isolation:</span>
                  <span className="font-semibold text-slate-800">Strictly Scoped to {cfg.role}</span>
                </div>
              </div>

              {/* Actions: View Login Screen or Direct Dashboard */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => navigate(cfg.loginRoute)}
                  className="px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <KeyRound className="h-3 w-3 text-slate-500" />
                  <span>Login Screen</span>
                </button>

                {currentUser?.allowedPortals.includes(portalKey) ? (
                  <button
                    type="button"
                    onClick={() => navigate(cfg.defaultRoute)}
                    className="px-3 py-1.5 rounded bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                  >
                    <span>Open Dashboard</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(cfg.loginRoute)}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                  >
                    <span>Authenticate</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Architecture & Anti-Tamper Notice */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 shrink-0">
          <Shield className="h-5 w-5" />
        </div>
        <div className="text-xs text-slate-600 space-y-1">
          <div className="font-bold text-slate-900 text-sm">
            Strict Multi-Tenant Security & Separation of Concerns Rules Enforced
          </div>
          <p>
            1. <strong>Super Admin Protection:</strong> Admin or staff accounts can NEVER delete, deactivate, demote, or modify the Super Admin credentials or privileges.
          </p>
          <p>
            2. <strong>Central Inventory Segregation:</strong> Central Store handles GRNs, requisitions, and suppliers, while OPD/IPD operations are isolated to clinical and reception desks.
          </p>
          <p>
            3. <strong>Route Guard Enforcement:</strong> Directly navigating to an unauthorized portal prefix immediately triggers the Access Denied audit guard.
          </p>
        </div>
      </div>
    </div>
  );
};
