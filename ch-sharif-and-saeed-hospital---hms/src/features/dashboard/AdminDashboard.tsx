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
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';
import { useRouter } from '../../context/RouterContext';
import { dashboardService, ResolvedDashboardState } from '../../services/dashboardService';
import { formatPKR } from '../../utils/formatters';

/**
 * Same screen/layout as before — every figure is now read from the live
 * `GET /api/v1/reports/dashboard/super-admin` aggregation (the ADMIN role
 * already has full `reports` access, see `authorize.ts`). Nothing here is
 * hardcoded: doctor roster, ward occupancy, revenue, and stock alerts all
 * come straight from the database.
 */
export const AdminDashboard: React.FC = () => {
  const { navigate } = useRouter();

  const [data, setData] = useState<ResolvedDashboardState | null>(() => dashboardService.getCachedDashboard());
  const [isLoading, setIsLoading] = useState<boolean>(!dashboardService.getCachedDashboard());
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await dashboardService.fetchSuperAdminDashboard('today');
      setData(result);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load live dashboard data from server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
      color: 'text-[#08775A] bg-[#effaf5] border-[#c2e7db]',
    },
    {
      title: 'Hospital Patients',
      value: `${totalPatients} Total`,
      sub: `${opdTotal} OPD • ${admissionTotal} IPD • ${emergencyTotal} ER`,
      icon: Users,
      color: 'text-[#08775A] bg-[#dff5ea] border-[#c2e7db]',
    },
    {
      title: 'Bed Occupancy',
      value: `${bedMetrics?.occupancyPercent ?? 0}%`,
      sub: `${bedMetrics?.occupiedBeds ?? 0} / ${bedMetrics?.totalBeds ?? 0} Beds Occupied`,
      icon: Bed,
      color: 'text-[#08775A] bg-[#effaf5] border-[#c2e7db]',
    },
    {
      title: "Today's Realized Revenue",
      value: formatPKR(billingSummary?.paidAmount ?? 0),
      sub: `Collections: ${collectionsPercent}%`,
      icon: CreditCard,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      title: 'Active Hospital Staff',
      value: `${infrastructure?.totalStaffCount ?? 0} Members`,
      sub: `${infrastructure?.activeDepartmentsCount ?? 0} active departments`,
      icon: Clock,
      color: 'text-teal-700 bg-teal-50 border-teal-200',
    },
    {
      title: 'Stock & Expiry Alerts',
      value: `${(inventorySummary?.lowStockItemsCount ?? 0) + (inventorySummary?.outOfStockItemsCount ?? 0)} Items`,
      sub: `${inventorySummary?.lowStockItemsCount ?? 0} low stock • ${inventorySummary?.outOfStockItemsCount ?? 0} out of stock`,
      icon: AlertCircle,
      color: 'text-amber-700 bg-amber-50 border-amber-200',
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Super Admin Protection Security Policy Banner */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-white flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded bg-[#149E75]/30 text-[#6ee7b7] flex items-center justify-center shrink-0">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wide">
              ADMIN WORKSTATION • GOVERNANCE LOCK ENFORCED
            </div>
            <div className="text-[11px] text-slate-400">
              Per hospital security architecture: Admin accounts cannot delete, deactivate, or modify Super Admin credentials or root permissions.
            </div>
          </div>
        </div>
        <div className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-700">
          Super Admin: Immutable
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-semibold transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 transition-opacity ${isLoading && !data ? 'opacity-50' : ''}`}>
        {adminKpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  {kpi.title}
                </span>
                <div className={`p-1 rounded ${kpi.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-base font-bold text-slate-900 tracking-tight">
                  {kpi.value}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{kpi.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Doctors on Duty & Department Status */}
        <div className="lg:col-span-2 space-y-5">
          {/* Active Doctors on Duty */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Active Doctors & Consultant Clinics Today
                </h2>
                <p className="text-[11px] text-slate-500">
                  Duty roster and OPD attendance tracking
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/staff_users')}
                className="text-xs text-[#08775A] font-semibold hover:underline"
              >
                View Full Roster →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3 font-semibold">Doctor Name</th>
                    <th className="py-2 px-3 font-semibold">Specialty / Dept</th>
                    <th className="py-2 px-3 font-semibold">Clinic Timings</th>
                    <th className="py-2 px-3 font-semibold text-center">Patients Booked</th>
                    <th className="py-2 px-3 font-semibold text-center">Duty Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doctorsOnDuty.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 px-3 text-center text-slate-400">
                        {isLoading ? 'Loading live roster…' : 'No active doctor records found.'}
                      </td>
                    </tr>
                  ) : (
                    doctorsOnDuty.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-medium text-slate-900">{doc.name}</td>
                        <td className="py-2 px-3 text-slate-600">{doc.department}</td>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{doc.shiftLabel}</td>
                        <td className="py-2 px-3 text-center font-semibold text-slate-800">
                          {doc.patientsBooked}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                              doc.status === 'On Duty'
                                ? 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
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
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Administrative Quick Actions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/admin/staff_users')}
                className="p-3 rounded-lg border border-slate-200 hover:border-[#149E75] hover:bg-[#effaf5]/50 text-left transition-all group"
              >
                <Stethoscope className="h-4 w-4 text-[#149E75] mb-1 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-semibold text-slate-900">Manage Doctors</div>
                <div className="text-[10px] text-slate-500">Rosters & commissions</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/services_rates')}
                className="p-3 rounded-lg border border-slate-200 hover:border-[#149E75] hover:bg-[#effaf5]/50 text-left transition-all group"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#08775A] mb-1 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-semibold text-slate-900">Services & Rates</div>
                <div className="text-[10px] text-slate-500">Tariffs & charges</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/wards_rooms_beds')}
                className="p-3 rounded-lg border border-slate-200 hover:border-[#149E75] hover:bg-[#effaf5]/50 text-left transition-all group"
              >
                <Bed className="h-4 w-4 text-[#08775A] mb-1 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-semibold text-slate-900">Wards & Beds</div>
                <div className="text-[10px] text-slate-500">Rooms & capacity</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/billing_reports')}
                className="p-3 rounded-lg border border-slate-200 hover:border-[#149E75] hover:bg-[#effaf5]/50 text-left transition-all group"
              >
                <TrendingUp className="h-4 w-4 text-[#149E75] mb-1 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-semibold text-slate-900">Revenue Audits</div>
                <div className="text-[10px] text-slate-500">Department receipts</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Ward Occupancy & Operational Warnings */}
        <div className="space-y-5">
          {/* Inpatient Bed Status */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Ward Bed Capacity Overview
            </h2>
            <div className="space-y-3">
              {(bedMetrics?.wards || []).length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  {isLoading ? 'Loading live ward data…' : 'No wards configured yet.'}
                </p>
              ) : (
                (bedMetrics?.wards || []).map((w) => (
                  <div key={w.wardName} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span>{w.wardName}</span>
                      <span className="font-semibold text-slate-900">
                        {w.occupiedBeds}/{w.totalBeds} ({w.occupancyPercent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          w.occupancyPercent >= 85
                            ? 'bg-rose-500'
                            : w.occupancyPercent >= 70
                            ? 'bg-[#149E75]'
                            : 'bg-[#08775A]'
                        }`}
                        style={{ width: `${w.occupancyPercent}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Available Vacant Beds:</span>
              <span className="font-bold text-emerald-700">{bedMetrics?.availableBeds ?? 0} Beds Free</span>
            </div>
          </div>

          {/* Operational Notices */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 text-amber-900">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              <span>Stock & Pharmacy Alerts</span>
            </h2>
            <div className="space-y-2 text-xs">
              {flaggedStockItems.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  {isLoading ? 'Loading live stock alerts…' : 'No active stock alerts — all items above reorder threshold.'}
                </p>
              ) : (
                flaggedStockItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded border leading-snug ${
                      item.status === 'OUT_OF_STOCK'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    <div className="font-bold text-[11px]">{item.name}</div>
                    <div className={`text-[10px] mt-0.5 ${item.status === 'OUT_OF_STOCK' ? 'text-rose-700' : 'text-amber-700'}`}>
                      {item.status === 'OUT_OF_STOCK'
                        ? 'Out of Stock in Central Store'
                        : `Low Stock (${item.currentStock} ${item.unit} remaining) • Reorder trigger: ${item.reorderLevel}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
