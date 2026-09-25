import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  Bed,
  CreditCard,
  AlertCircle,
  Clock,
  TrendingUp,
  Stethoscope,
  ShieldCheck,
  FileSpreadsheet,
  RefreshCw,
  Filter,
  CheckCircle2,
  ChevronRight,
  Activity,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from '../../context/RouterContext';
import { dashboardService, ResolvedDashboardState } from '../../services/dashboardService';
import { formatPKR } from '../../utils/formatters';

type DateFilterPreset = 'today' | 'yesterday' | 'this_week' | 'this_month';

/**
 * Admin Dashboard — mirrors SuperAdmin's executive aesthetics and command center layout.
 * Real DB backed: doctor roster, bed occupancy, revenue, patient flow and stock alerts.
 */
export const AdminDashboard: React.FC = () => {
  const { navigate } = useRouter();

  const [selectedPreset, setSelectedPreset] = useState<DateFilterPreset>('today');
  const [data, setData] = useState<ResolvedDashboardState | null>(() => dashboardService.getCachedDashboard());
  const [isLoading, setIsLoading] = useState<boolean>(!dashboardService.getCachedDashboard());
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (preset: DateFilterPreset = 'today') => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await dashboardService.fetchSuperAdminDashboard(preset);
      setData(result);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load live dashboard data from server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(selectedPreset);
  }, [loadDashboard, selectedPreset]);

  const infrastructure = data?.infrastructure;
  const bedMetrics = data?.bedMetrics;
  const billingSummary = data?.billingSummary;
  const inventorySummary = data?.inventorySummary;
  const patientFlow = data?.patientFlow || [];
  const doctorsOnDuty = data?.doctorsOnDuty || [];
  const flaggedStockItems = data?.flaggedStockItems || [];

  const opdTotal = patientFlow.find((f) => f.category === 'OPD')?.total ?? 0;
  const admissionTotal = patientFlow.find((f) => f.category === 'Admission')?.total ?? 0;
  const emergencyTotal = patientFlow.find((f) => f.category === 'Emergency')?.total ?? 0;
  const totalPatients = patientFlow.reduce((sum, f) => sum + (f.total || 0), 0);
  const collectionsPercent =
    billingSummary && billingSummary.netBilling > 0
      ? Math.round((billingSummary.paidAmount / billingSummary.netBilling) * 100)
      : 0;
  const doctorsOnDutyCount = doctorsOnDuty.filter((d) => d.status === 'On Duty').length;

  const adminKpis = [
    {
      title: 'Doctors On Duty',
      value: `${infrastructure?.doctorsCount ?? 0} Active`,
      sub: `${doctorsOnDutyCount} on duty today`,
      icon: UserCheck,
      color: 'text-[#0e7d5a] bg-[#e7f6f1] border-[#c2e7db]',
      nav: '/admin/staff_users',
    },
    {
      title: 'Hospital Patients',
      value: `${totalPatients} Total`,
      sub: `${opdTotal} OPD • ${admissionTotal} IPD • ${emergencyTotal} ER`,
      icon: Users,
      color: 'text-teal-700 bg-teal-50 border-teal-200',
      nav: '/admin/staff_users',
    },
    {
      title: 'Bed Occupancy',
      value: `${bedMetrics?.occupancyPercent ?? 0}%`,
      sub: `${bedMetrics?.occupiedBeds ?? 0} / ${bedMetrics?.totalBeds ?? 0} Beds Occupied`,
      icon: Bed,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      nav: '/admin/wards_rooms_beds',
    },
    {
      title: 'Realized Revenue',
      value: formatPKR(billingSummary?.paidAmount ?? 0),
      sub: `Collections rate: ${collectionsPercent}%`,
      icon: CreditCard,
      color: 'text-[#129b70] bg-[#e7f6f1] border-[#c2e7db]',
      nav: '/admin/billing_reports',
    },
    {
      title: 'Active Hospital Staff',
      value: `${infrastructure?.totalStaffCount ?? 0} Members`,
      sub: `${infrastructure?.activeDepartmentsCount ?? 0} active departments`,
      icon: Clock,
      color: 'text-slate-700 bg-slate-50 border-slate-200',
      nav: '/admin/departments',
    },
    {
      title: 'Stock & Expiry Alerts',
      value: `${(inventorySummary?.lowStockItemsCount ?? 0) + (inventorySummary?.outOfStockItemsCount ?? 0)} Items`,
      sub: `${inventorySummary?.lowStockItemsCount ?? 0} low stock • ${inventorySummary?.outOfStockItemsCount ?? 0} out`,
      icon: AlertCircle,
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      nav: '/admin/services_rates',
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Executive Command Center Header Card (Matches SuperAdmin aesthetic) */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-[#111827] tracking-tight">
              Hospital Administration Command Center
            </h1>
            <p className="text-xs text-[#52665e] mt-1">
              Real-time operational monitoring, clinical duty rosters, bed occupancy and supply alerts.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-[#08775A] border border-[#c2e7db] font-semibold">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#129b70]" />
                Syncing Live Data...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                Live Database Connected
              </span>
            )}
            <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-medium">
              Period: <strong className="text-slate-900">{data?.periodLabel || 'Today'}</strong>
            </span>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              Filter Period:
            </span>
            {(
              [
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'this_week', label: 'This Week' },
                { key: 'this_month', label: 'This Month' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setSelectedPreset(preset.key);
                  loadDashboard(preset.key);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedPreset === preset.key
                    ? 'bg-[#129b70] text-white shadow-2xs font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadDashboard(selectedPreset)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#e2eae5] text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loadError && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => loadDashboard(selectedPreset)}
              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* 2. Key Operational Indicators (KPI Grid) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Key Operational & Financial Indicators
          </h2>
          <span className="text-[11px] text-slate-400">
            Live database telemetry • Auto-syncing
          </span>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 transition-opacity ${isLoading && !data ? 'opacity-50' : ''}`}>
          {adminKpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className="bg-white p-4 rounded-xl border border-[#e2eae5] shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate">
                    {kpi.title}
                  </span>
                  <div className={`p-2 rounded-lg border shrink-0 ${kpi.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <div className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                    {kpi.value}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">{kpi.sub}</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(kpi.nav)}
                  className="mt-3 pt-2 border-t border-slate-100 text-[11px] font-semibold text-[#0e7d5a] hover:text-[#129b70] hover:underline flex items-center justify-between cursor-pointer"
                >
                  <span>Details</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Main Operational Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Doctors on Duty & Quick Actions */}
        <div className="lg:col-span-2 space-y-5">
          {/* Active Doctors on Duty */}
          <div className="bg-white rounded-xl border border-[#e2eae5] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#e2eae5] flex items-center justify-between bg-white">
              <div>
                <h2 className="text-sm font-bold text-[#111827]">
                  Active Doctors & Consultant Clinics Today
                </h2>
                <p className="text-xs text-[#52665e] mt-0.5">
                  Duty roster and OPD attendance tracking
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/staff_users')}
                className="text-xs text-[#129b70] hover:text-[#0e7d5a] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View Full Roster</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8faf9] text-[#52665e] border-b border-[#e2eae5] text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-4 font-semibold">Doctor Name</th>
                    <th className="py-2.5 px-4 font-semibold">Specialty / Dept</th>
                    <th className="py-2.5 px-4 font-semibold">Clinic Timings</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Patients Booked</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Duty Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2eae5]/60">
                  {doctorsOnDuty.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 px-4 text-center text-slate-400">
                        {isLoading ? 'Loading live roster…' : 'No active doctor records found.'}
                      </td>
                    </tr>
                  ) : (
                    doctorsOnDuty.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#f0faf6]/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{doc.name}</td>
                        <td className="py-3 px-4 text-slate-600">{doc.department}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{doc.shiftLabel}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {doc.patientsBooked}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              doc.status === 'On Duty'
                                ? 'bg-[#e7f6f1] text-[#0e7d5a] border border-[#c2e7db]'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full mr-1 ${doc.status === 'On Duty' ? 'bg-[#10b981]' : 'bg-slate-400'}`} />
                            {doc.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Setup & Management Actions */}
          <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-xs">
            <h2 className="text-sm font-bold text-[#111827] mb-3">
              Administrative Quick Actions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/staff_users')}
                className="p-3.5 rounded-xl border border-[#e2eae5] hover:border-[#129b70] hover:bg-[#effaf5]/50 text-left transition-all group cursor-pointer"
              >
                <Stethoscope className="h-5 w-5 text-[#129b70] mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-900">Manage Doctors</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Rosters & duty profiles</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/services_rates')}
                className="p-3.5 rounded-xl border border-[#e2eae5] hover:border-[#129b70] hover:bg-[#effaf5]/50 text-left transition-all group cursor-pointer"
              >
                <FileSpreadsheet className="h-5 w-5 text-[#08775A] mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-900">Services & Rates</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Tariffs & charges</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/wards_rooms_beds')}
                className="p-3.5 rounded-xl border border-[#e2eae5] hover:border-[#129b70] hover:bg-[#effaf5]/50 text-left transition-all group cursor-pointer"
              >
                <Bed className="h-5 w-5 text-[#08775A] mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-900">Wards & Beds</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Rooms & bed capacity</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/billing_reports')}
                className="p-3.5 rounded-xl border border-[#e2eae5] hover:border-[#129b70] hover:bg-[#effaf5]/50 text-left transition-all group cursor-pointer"
              >
                <TrendingUp className="h-5 w-5 text-[#129b70] mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-slate-900">Revenue Audits</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Department billing</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Ward Occupancy & Operational Alerts */}
        <div className="space-y-5">
          {/* Inpatient Ward Bed Capacity */}
          <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-sm font-bold text-[#111827]">
                Ward Bed Capacity Overview
              </h2>
              <span className="text-[11px] font-bold text-[#129b70] bg-[#e7f6f1] px-2 py-0.5 rounded-full border border-[#c2e7db]">
                {bedMetrics?.occupancyPercent ?? 0}% Occupied
              </span>
            </div>

            <div className="space-y-3.5">
              {(bedMetrics?.wards || []).length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  {isLoading ? 'Loading live ward data…' : 'No wards configured yet.'}
                </p>
              ) : (
                (bedMetrics?.wards || []).map((w) => (
                  <div key={w.wardName} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span className="font-semibold text-slate-800">{w.wardName}</span>
                      <span className="font-mono text-slate-600">
                        {w.occupiedBeds}/{w.totalBeds} ({w.occupancyPercent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          w.occupancyPercent >= 85
                            ? 'bg-rose-500'
                            : w.occupancyPercent >= 70
                            ? 'bg-[#129b70]'
                            : 'bg-[#08775A]'
                        }`}
                        style={{ width: `${w.occupancyPercent}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3.5 border-t border-[#e2eae5] flex items-center justify-between text-xs">
              <span className="text-[#52665e]">Available Vacant Beds:</span>
              <span className="font-bold text-[#0e7d5a] bg-[#e7f6f1] px-2 py-0.5 rounded border border-[#c2e7db]">
                {bedMetrics?.availableBeds ?? 0} Free
              </span>
            </div>
          </div>

          {/* Stock & Pharmacy Alerts */}
          <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-xs">
            <h2 className="text-sm font-bold text-[#111827] mb-3 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Stock & Pharmacy Alerts</span>
            </h2>
            <div className="space-y-2.5 text-xs">
              {flaggedStockItems.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  <CheckCircle2 className="h-6 w-6 text-[#129b70]/50 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-700">All items in stock</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">All central store medicines are above reorder threshold</p>
                </div>
              ) : (
                flaggedStockItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border leading-snug ${
                      item.status === 'OUT_OF_STOCK'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    <div className="font-bold text-xs">{item.name}</div>
                    <div className={`text-[11px] mt-0.5 ${item.status === 'OUT_OF_STOCK' ? 'text-rose-700' : 'text-amber-700'}`}>
                      {item.status === 'OUT_OF_STOCK'
                        ? 'Out of Stock in Central Store'
                        : `Low Stock (${item.currentStock} ${item.unit} remaining) • Reorder level: ${item.reorderLevel}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Subtle Role & Governance Policy Notice (Clean footer instead of harsh black banner) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#f8faf9] rounded-xl border border-[#e2eae5] text-xs text-slate-600 shadow-2xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#129b70] shrink-0" />
          <span>
            <strong className="text-slate-900">Hospital Administration Workstation:</strong> Operating under role-based hospital access controls. Root governance and audit policies are active.
          </span>
        </div>
        <span className="text-[10px] font-mono bg-white text-slate-600 px-2 py-0.5 rounded border border-[#e2eae5]">
          Super Admin: Root Protected
        </span>
      </div>
    </div>
  );
};
