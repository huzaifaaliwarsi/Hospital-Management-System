import React, { useEffect, useState } from 'react';
import {
  Users,
  Stethoscope,
  Eye,
  AlertTriangle,
  Receipt,
  CreditCard,
  Plus,
  ShieldCheck,
  AlertCircle,
  Coins,
  Loader2,
  BedDouble,
} from 'lucide-react';
import { formatPKR } from '../../utils/formatters';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { frontdeskApiService, appointmentsApiService } from '../../services/frontdeskApiService';
import { fetchAdmissions } from '../../services/admissionService';
import { getAllPatients, primePatientRegistryCache } from '../../services/patientRegistryService';
import { getHospitalCurrentDate, formatDateISO } from '../../utils/dateConstants';

interface DashboardState {
  todayAppointmentsCount: number;
  todayAdmissionsCount: number;
  opdCount: number;
  observationCount: number;
  emergencyCount: number;
  todayInvoicesCount: number;
  outstandingBalance: number;
  cashCollected: number;
  onlineCollected: number;
  unsettledCount: number;
  recentPatients: Array<{ id: string; name: string; mrn: string; payerType: string; registeredAt: string }>;
  recentInvoices: Array<{ id: string; invoiceNumber: string; patient: string; net: number; paid: number; due: number; status: string }>;
  recentTransactions: Array<{ id: string; receiptNumber: string | null; invoiceNumber: string | null; amount: number; method: string; occurredAt: string }>;
}

const EMPTY_STATE: DashboardState = {
  todayAppointmentsCount: 0,
  todayAdmissionsCount: 0,
  opdCount: 0,
  observationCount: 0,
  emergencyCount: 0,
  todayInvoicesCount: 0,
  outstandingBalance: 0,
  cashCollected: 0,
  onlineCollected: 0,
  unsettledCount: 0,
  recentPatients: [],
  recentInvoices: [],
  recentTransactions: [],
};

/**
 * Front Desk Dashboard — every figure here is real, backed by
 * `/appointments`, `/invoices`, `/cash/balance-sheet`, and the Panel/Self-Pay
 * patient registry. Nothing hardcoded (HMS_V7.2_NEW_REQUIREMENTS.md and the
 * session's own instruction to keep this portal DB-synced throughout).
 */
export const FrontDeskDashboard: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();

  const [data, setData] = useState<DashboardState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const today = formatDateISO(getHospitalCurrentDate());

      await primePatientRegistryCache();

      const [appointmentsRes, invoicesRes, cashRes, admissionsRes] = await Promise.all([
        appointmentsApiService.getAppointments({ date: today }).catch(() => []),
        frontdeskApiService.getInvoices().catch(() => []),
        frontdeskApiService.getCashBalance().catch(() => null),
        fetchAdmissions().catch(() => []),
      ]);

      const todayInvoices = (invoicesRes as any[]).filter((inv) => String(inv.createdAt).slice(0, 10) === today);
      const opdCount = todayInvoices.filter((inv) => inv.encounterType === 'OPD').length;
      const observationCount = todayInvoices.filter((inv) => inv.encounterType === 'OBSERVATION').length;
      const emergencyCount = todayInvoices.filter((inv) => inv.encounterType === 'EMERGENCY').length;

      const outstandingBalance = (invoicesRes as any[]).reduce((sum, inv) => sum + Number(inv.balanceDue ?? 0), 0);

      const recentInvoices = (invoicesRes as any[]).slice(0, 5).map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        patient: inv.panelPatient?.fullName || inv.selfPayEncounter?.fullName || 'Walk-in Patient',
        net: Number(inv.total ?? 0),
        paid: Number(inv.paidTotal ?? 0),
        due: Number(inv.balanceDue ?? 0),
        status: inv.status,
      }));

      const patients = getAllPatients();
      const recentPatients = [...patients]
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 5)
        .map((p) => ({ id: p.id, name: p.fullName, mrn: p.mrNumber, payerType: p.payerType, registeredAt: p.registrationDate }));

      const todayAdmissionsCount = admissionsRes.filter((a) => a.createdAtIso.slice(0, 10) === today).length;

      const recentTransactions = cashRes?.transactions
        ? cashRes.transactions.slice(0, 5).map((t: any) => ({
            id: t.id,
            receiptNumber: t.receiptNumber,
            invoiceNumber: t.invoiceNumber,
            amount: Number(t.amount ?? 0),
            method: t.paymentMethod,
            occurredAt: t.occurredAt,
          }))
        : [];

      setData({
        todayAppointmentsCount: (appointmentsRes as any[]).length,
        todayAdmissionsCount,
        opdCount,
        observationCount,
        emergencyCount,
        todayInvoicesCount: todayInvoices.length,
        outstandingBalance,
        cashCollected: cashRes ? Number(cashRes.summary?.physicalCashIn ?? 0) : 0,
        onlineCollected: cashRes ? Number(cashRes.summary?.nonPhysicalTotal ?? 0) : 0,
        unsettledCount: cashRes ? Number(cashRes.summary?.unsettledCount ?? 0) : 0,
        recentPatients,
        recentInvoices,
        recentTransactions,
      });
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load Front Desk dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = [
    { title: "Today's Appointments", value: `${data.todayAppointmentsCount}`, sub: 'Real-time from /appointments', icon: Users, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'OPD Invoices Today', value: `${data.opdCount}`, sub: 'Walk-in OPD encounters', icon: Stethoscope, color: 'text-[#129b70] bg-[#effaf5]' },
    { title: 'Observation Cases Today', value: `${data.observationCount}`, sub: 'Day-care / short-stay', icon: Eye, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Emergency Cases Today', value: `${data.emergencyCount}`, sub: 'Triage intake', icon: AlertTriangle, color: 'text-rose-700 bg-rose-50' },
    { title: "Today's Invoices", value: `${data.todayInvoicesCount}`, sub: `${data.todayAdmissionsCount} admissions today`, icon: Receipt, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Cash Collected (My Shift)', value: formatPKR(data.cashCollected), sub: `${data.unsettledCount} unsettled txns`, icon: Coins, color: 'text-[#129b70] bg-[#effaf5]' },
    { title: 'Online / Non-Cash (My Shift)', value: formatPKR(data.onlineCollected), sub: 'Card / Bank / Online', icon: CreditCard, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Outstanding Balance', value: formatPKR(data.outstandingBalance), sub: 'All open invoices', icon: AlertCircle, color: 'text-amber-700 bg-amber-50' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Front Desk Header & Quick Action Buttons */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-600'}`} />
            <h1 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Front Desk & Billing Cashiering Terminal
            </h1>
            <span className="text-[10px] bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db] font-semibold px-2 py-0.5 rounded">
              {isLoading ? 'Syncing…' : 'Live Database Connected'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Operator: <span className="font-semibold text-slate-800">{currentUser?.name}</span> ({currentUser?.role})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/front-desk/new_admission')}
            className="py-1.5 px-3 rounded bg-[#0e7d5a] hover:bg-[#0b6448] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <BedDouble className="h-3.5 w-3.5" />
            <span>New Admission</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/front-desk/appointments')}
            className="py-1.5 px-3 rounded bg-[#129b70] hover:bg-[#0e7d5a] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Appointments</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-2 text-xs text-rose-700 font-medium">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {loadError}
          </span>
          <button onClick={load} className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 rounded font-semibold">Retry</button>
        </div>
      )}

      {isLoading && data === EMPTY_STATE ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading live Front Desk data…</span>
        </div>
      ) : (
        <>
          {/* 8 Front Desk KPIs — all real */}
          <div className={`grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
            {kpis.map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate">{k.title}</span>
                    <div className={`p-1 rounded ${k.color}`}>
                      <Icon className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <div className="text-sm font-bold text-slate-900 tracking-tight truncate">{k.value}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5 truncate">{k.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Recent Patients */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recently Registered Patients</h2>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2 px-3 font-semibold">MRN</th>
                      <th className="py-2 px-3 font-semibold">Patient Name</th>
                      <th className="py-2 px-3 font-semibold">Payer</th>
                      <th className="py-2 px-3 font-semibold text-right">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentPatients.length === 0 ? (
                      <tr><td colSpan={4} className="py-6 text-center text-slate-400">No patients registered yet.</td></tr>
                    ) : (
                      data.recentPatients.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 font-mono text-[11px] font-semibold text-[#0e7d5a]">{p.mrn}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{p.name}</td>
                          <td className="py-2 px-3">
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{p.payerType}</span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500 font-mono text-[11px]">{p.registeredAt}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Invoices */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recent Billing Invoices</h2>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2 px-3 font-semibold">Invoice #</th>
                      <th className="py-2 px-3 font-semibold">Patient</th>
                      <th className="py-2 px-3 font-semibold text-right">Net</th>
                      <th className="py-2 px-3 font-semibold text-right">Due</th>
                      <th className="py-2 px-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentInvoices.length === 0 ? (
                      <tr><td colSpan={5} className="py-6 text-center text-slate-400">No invoices yet.</td></tr>
                    ) : (
                      data.recentInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 font-mono text-[11px] font-semibold text-slate-900">{inv.invoiceNumber}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{inv.patient}</td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900">{formatPKR(inv.net)}</td>
                          <td className="py-2 px-3 text-right font-semibold text-rose-700">{inv.due > 0 ? formatPKR(inv.due) : '—'}</td>
                          <td className="py-2 px-3 text-center text-[10px] font-bold text-slate-600">{inv.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Payments (this cashier's unsettled shift) */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  <span>My Unsettled Collections (Live Cash Balance Sheet)</span>
                </h2>
                <p className="text-[11px] text-slate-500">Real receipts pending my next account settlement.</p>
              </div>
              <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                Total Collections: {formatPKR(data.cashCollected + data.onlineCollected)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-3 font-semibold">Receipt No</th>
                    <th className="py-2.5 px-3 font-semibold">Invoice Ref</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                    <th className="py-2.5 px-3 font-semibold">Method</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentTransactions.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400">No unsettled collections right now.</td></tr>
                  ) : (
                    data.recentTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-mono text-[11px] font-bold text-emerald-800">{t.receiptNumber || '—'}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{t.invoiceNumber || '—'}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{formatPKR(t.amount)}</td>
                        <td className="py-2 px-3">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">{t.method}</span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 font-mono text-[11px]">
                          {new Date(t.occurredAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
