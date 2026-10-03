import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Banknote,
  CreditCard,
  Wallet,
  ClipboardList,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ShoppingCart,
  Receipt,
  ArrowRight,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { pharmacyApi, SalesDashboard } from '../services/pharmacyApi';
import { useAuth } from '../context/AuthContext';
import { formatPKR } from '../utils/format';

interface Props {
  onNavigate?: (pageId: string) => void;
}

export const SalesDashboardPage: React.FC<Props> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const [data, setData] = useState<SalesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = () => {
    setLoading(true);
    pharmacyApi
      .getSalesDashboard()
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch(() => setError('Failed to load sales dashboard.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#0e7d5a]" />
        <p className="text-sm font-medium">Loading sales terminal data…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600 mb-2">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Failed to Load Sales Terminal</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{error || 'Unable to retrieve real-time sales metrics.'}</p>
        <button
          type="button"
          onClick={fetchDashboard}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0e7d5a] text-white text-xs font-semibold hover:bg-[#0c6b50] transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try Again
        </button>
      </div>
    );
  }

  const firstName = currentUser?.fullName?.split(' ')[0] || 'Cashier';

  return (
    <div className="p-8 space-y-6 max-w-[1700px] mx-auto dashboard-inter">
      {/* Hero Banner for Sales Terminal */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0c5944] via-[#0e7d5a] to-[#0a664c] text-white p-7 sm:p-9 shadow-lg shadow-emerald-950/10">
        {/* Large, prominent sleek capsule graphic watermark */}
        <div className="absolute -right-4 sm:right-2 lg:right-8 top-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 opacity-25 sm:opacity-30 pointer-events-none select-none flex items-center justify-center">
          <svg viewBox="0 0 240 240" fill="none" stroke="currentColor" className="w-full h-full transform rotate-45">
            <circle cx="120" cy="120" r="110" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.35" />
            <circle cx="120" cy="120" r="92" strokeWidth="1" strokeDasharray="3 3" opacity="0.2" />
            <rect x="85" y="30" width="70" height="180" rx="35" strokeWidth="3.5" />
            <line x1="85" y1="120" x2="155" y2="120" strokeWidth="2.5" />
            <line x1="120" y1="65" x2="120" y2="85" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
            <line x1="110" y1="75" x2="130" y2="75" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
            <circle cx="120" cy="155" r="4.5" fill="currentColor" opacity="0.6" />
            <circle cx="120" cy="172" r="3" fill="currentColor" opacity="0.35" />
          </svg>
        </div>

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-400/25 text-emerald-200 text-xs font-medium backdrop-blur-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span>Dispensing Counter Active</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Welcome, {firstName}
          </h2>

          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-normal">
            Dispense walk-in prescriptions, process split payments, review ward medicine queues, and monitor your drawer cash in real time.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-emerald-100">
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('pos')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[#0e7d5a] font-semibold hover:bg-emerald-50 transition-all shadow-sm cursor-pointer"
            >
              <ShoppingCart className="h-4 w-4" /> Start New Sale (POS)
            </button>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('hms-requests')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-800/60 hover:bg-emerald-800/80 border border-emerald-400/30 text-white font-semibold transition-all backdrop-blur-xs cursor-pointer"
            >
              <ClipboardList className="h-4 w-4" /> Hospital Queue ({data.pendingHmsRequests})
            </button>
            <div className="flex items-center gap-2 border-l border-emerald-400/25 pl-4 text-emerald-200">
              <Activity className="h-4 w-4 text-emerald-300" />
              <span>{data.mySalesCountToday} transactions dispensed today</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* My Sales Today (Emerald top accent) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 border-t-[3.5px] border-t-emerald-600 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {data.mySalesCountToday} bills
            </span>
          </div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">My Sales Today</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{formatPKR(data.mySalesToday)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Dispensed volume</div>
        </div>

        {/* Cash Collection (Blue top accent) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 border-t-[3.5px] border-t-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Banknote className="h-4.5 w-4.5" />
            </div>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
              Physical
            </span>
          </div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cash Collection</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{formatPKR(data.cashCollectionToday)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Paper currency</div>
        </div>

        {/* Card / Online (Purple top accent) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 border-t-[3.5px] border-t-purple-600 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <CreditCard className="h-4.5 w-4.5" />
            </div>
            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
              Digital
            </span>
          </div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Card / Online</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{formatPKR(data.cardOnlineCollectionToday)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Bank / POS terminal</div>
        </div>

        {/* Pending HMS (Amber top accent) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 border-t-[3.5px] border-t-amber-500 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ClipboardList className="h-4.5 w-4.5" />
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              data.pendingHmsRequests > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {data.pendingHmsRequests > 0 ? 'Action needed' : 'Clear'}
            </span>
          </div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">HMS Requests</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{data.pendingHmsRequests}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Inbound prescriptions</div>
        </div>

        {/* Expected Cash in Hand (Teal top accent) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 border-t-[3.5px] border-t-teal-600 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Wallet className="h-4.5 w-4.5" />
            </div>
            <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
              Drawer
            </span>
          </div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Expected Cash</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{formatPKR(data.expectedCash)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Ready for settlement</div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('pos')}
          className="p-6 bg-white rounded-2xl border border-slate-300/80 hover:border-emerald-500 hover:shadow-md shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all text-left flex items-start justify-between group cursor-pointer"
        >
          <div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-[#0e7d5a] flex items-center justify-center mb-3">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#0e7d5a] transition-colors">Start New Sale</h4>
            <p className="text-xs text-slate-500 mt-1">Dispense medicines to walk-in patient with barcode scanner or search.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-[#0e7d5a] group-hover:translate-x-1 transition-all" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate && onNavigate('invoices')}
          className="p-6 bg-white rounded-2xl border border-slate-300/80 hover:border-emerald-500 hover:shadow-md shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all text-left flex items-start justify-between group cursor-pointer"
        >
          <div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Receipt className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Recent Invoices</h4>
            <p className="text-xs text-slate-500 mt-1">Review your dispensed invoices, receipts and reprint thermal slips.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate && onNavigate('settlements')}
          className="p-6 bg-white rounded-2xl border border-slate-300/80 hover:border-emerald-500 hover:shadow-md shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all text-left flex items-start justify-between group cursor-pointer"
        >
          <div>
            <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-600 transition-colors">Shift Settlement</h4>
            <p className="text-xs text-slate-500 mt-1">Count your physical cash drawer and submit your end-of-shift handover.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all" />
        </button>
      </div>
    </div>
  );
};
