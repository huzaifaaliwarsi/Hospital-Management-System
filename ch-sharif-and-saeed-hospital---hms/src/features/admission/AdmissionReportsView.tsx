import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  LineChart,
  Users,
  Bed,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Building2,
  UserCheck,
  ShieldCheck,
  Wallet,
  ArrowRight,
  Activity,
  Stethoscope,
  ClipboardList,
  Boxes,
  Loader2,
  Filter,
} from 'lucide-react';
import { formatPKR } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { fetchAdmissions, AdmissionRecord, AdmissionStatus } from '../../services/admissionService';
import {
  downloadTablePDF,
  downloadTableExcel,
  downloadTableCSV,
  printTable,
  ExportColumn,
} from '../../services/tableExportService';
import { ExportButtonGroup } from '../superAdmin/financeControl/ExportButtonGroup';

const STATUS_CONFIG: Record<
  AdmissionStatus,
  { label: string; badgeBg: string; badgeText: string; badgeBorder: string; pipeline: string }
> = {
  ACTIVE: {
    label: 'Active Inpatient',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
    pipeline: 'Occupying Inpatient Bed',
  },
  PLANNED: {
    label: 'Planned',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-200',
    pipeline: 'Scheduled Admission',
  },
  CONFIRMED: {
    label: 'Confirmed',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-200',
    pipeline: 'Bed Allocated / Pending Check-In',
  },
  DISCHARGE_PENDING: {
    label: 'Discharge Pending',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    pipeline: 'Awaiting 3-Way Clearances',
  },
  DISCHARGED: {
    label: 'Discharged',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    badgeBorder: 'border-slate-200',
    pipeline: 'Stay Concluded & Gate Passed',
  },
  CANCELLED: {
    label: 'Cancelled',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-200',
    pipeline: 'Booking Cancelled / No-Show',
  },
};

interface AdmissionExportRow {
  category: string;
  metric: string;
  detail: string;
  countOrValue: string;
}

const EXPORT_COLUMNS: ExportColumn<AdmissionExportRow>[] = [
  { header: 'Category', cell: (r) => r.category },
  { header: 'Dimension / Item', cell: (r) => r.metric },
  { header: 'Classification / Detail', cell: (r) => r.detail },
  { header: 'Count / Value', align: 'right', cell: (r) => r.countOrValue },
];

/**
 * Admission Reports — Re-architected with modern Hospital ERP aesthetics:
 * - Real multi-format export toolbar (Excel, CSV, PDF, Print)
 * - Hospital green gradient banner (#0a4636 -> #08775A) with real-time status indicators
 * - Interactive filter bar (Status filter pill selector + Payer type filter)
 * - 6 primary inpatient KPI metric cards (Admissions, Active, Planned, Clearances, Discharges, Estimated Intake)
 * - Dual side-by-side bordered tables (Status Breakdown vs Department Breakdown)
 * - Top Admitting Doctors ranking table with specialization
 * - Inpatient Census & Clinical Clearance Summary card
 * - Quick drill-down shortcuts to operational registers (Census, Bed Occupancy, Discharge Clearance, LOS)
 */
export const AdmissionReportsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { navigate, currentPortal } = useRouter();

  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPayer, setSelectedPayer] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');

  const load = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAdmissions();
      setAdmissions(data);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load admission reports.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Unique departments for filter
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    admissions.forEach((a) => {
      if (a.departmentName) set.add(a.departmentName);
    });
    return Array.from(set).sort();
  }, [admissions]);

  // Filtered admissions
  const filteredAdmissions = useMemo(() => {
    return admissions.filter((a) => {
      if (selectedStatus !== 'ALL' && a.status !== selectedStatus) return false;
      if (selectedPayer !== 'ALL' && a.payerType !== selectedPayer) return false;
      if (selectedDepartment !== 'ALL' && a.departmentName !== selectedDepartment) return false;
      return true;
    });
  }, [admissions, selectedStatus, selectedPayer, selectedDepartment]);

  // Aggregations based on total admissions
  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAdmissions.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  }, [filteredAdmissions]);

  const byDepartment = useMemo(() => {
    const counts = new Map<string, number>();
    filteredAdmissions.forEach((a) => {
      const dept = a.departmentName || 'General / Unassigned';
      counts.set(dept, (counts.get(dept) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredAdmissions]);

  const byDoctor = useMemo(() => {
    const map = new Map<string, { count: number; department: string }>();
    filteredAdmissions.forEach((a) => {
      const doc = a.doctorName || 'Unassigned Consultant';
      const existing = map.get(doc);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(doc, { count: 1, department: a.departmentName || 'General' });
      }
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredAdmissions]);

  // Financial & Census KPIs
  const totalAdmissions = filteredAdmissions.length;
  const activeInpatients = byStatus.ACTIVE || 0;
  const plannedConfirmed = (byStatus.PLANNED || 0) + (byStatus.CONFIRMED || 0);
  const dischargePending = byStatus.DISCHARGE_PENDING || 0;
  const discharged = byStatus.DISCHARGED || 0;

  const selfPayCount = filteredAdmissions.filter((a) => a.payerType === 'Self Pay').length;
  const panelCount = filteredAdmissions.filter((a) => a.payerType === 'Corporate / Panel').length;
  const hospitalManagedMedCount = filteredAdmissions.filter((a) => a.medicationMode === 'HOSPITAL_MANAGED').length;

  const totalEstimatedRevenue = useMemo(() => {
    return filteredAdmissions.reduce((sum, a) => sum + (Number(a.estimatedAmount) || 0), 0);
  }, [filteredAdmissions]);

  // Export dataset
  const exportRows: AdmissionExportRow[] = useMemo(() => {
    const rows: AdmissionExportRow[] = [
      { category: 'Summary', metric: 'Total Admissions', detail: 'Total inpatient records matching filters', countOrValue: `${totalAdmissions}` },
      { category: 'Summary', metric: 'Active Inpatients', detail: 'Currently admitted & occupying bed', countOrValue: `${activeInpatients}` },
      { category: 'Summary', metric: 'Planned / Confirmed', detail: 'Scheduled inpatient arrivals', countOrValue: `${plannedConfirmed}` },
      { category: 'Summary', metric: 'Discharge Pending', detail: 'Awaiting clinical/billing clearances', countOrValue: `${dischargePending}` },
      { category: 'Summary', metric: 'Discharged', detail: 'Completed hospital stays', countOrValue: `${discharged}` },
      { category: 'Summary', metric: 'Total Estimated Intake', detail: 'Cumulative estimated admission charges', countOrValue: formatPKR(totalEstimatedRevenue) },
      { category: 'Payer Split', metric: 'Self Pay Patients', detail: 'Direct out-of-pocket cash patients', countOrValue: `${selfPayCount}` },
      { category: 'Payer Split', metric: 'Corporate / Panel Patients', detail: 'Insurance & corporate credit agreements', countOrValue: `${panelCount}` },
      { category: 'Pharmacy Care', metric: 'Hospital Managed Medication', detail: 'Ward fulfillment from Central Pharmacy', countOrValue: `${hospitalManagedMedCount}` },
    ];

    byDepartment.forEach(([dept, count]) => {
      rows.push({
        category: 'Department Breakdown',
        metric: dept,
        detail: 'Inpatient specialty distribution',
        countOrValue: `${count} admissions`,
      });
    });

    byDoctor.forEach((doc) => {
      rows.push({
        category: 'Consultant Activity',
        metric: doc.name,
        detail: doc.department,
        countOrValue: `${doc.count} admissions`,
      });
    });

    return rows;
  }, [
    totalAdmissions,
    activeInpatients,
    plannedConfirmed,
    dischargePending,
    discharged,
    totalEstimatedRevenue,
    selfPayCount,
    panelCount,
    hospitalManagedMedCount,
    byDepartment,
    byDoctor,
  ]);

  const exportContext = {
    documentTitle: 'Admission Reports & Inpatient Analytics',
    documentSubtitle: `Hospital Inpatient Admissions Overview — Generated for ${currentUser?.name || 'Authorized User'}`,
    filenamePrefix: 'Admission_Reports',
    columns: EXPORT_COLUMNS,
    rows: exportRows,
    currentUser,
    periodLabel: 'Live Inpatient Registry',
    filters: [
      `Status Filter: ${selectedStatus}`,
      `Payer: ${selectedPayer}`,
      `Department: ${selectedDepartment}`,
      `Active Inpatients: ${activeInpatients}`,
    ],
  };

  // Safe navigation helper depending on portal (Super Admin vs Admission portal)
  const navPrefix = currentPortal === 'super-admin' ? '/super-admin' : '/admission';

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* 1. Top Header with Title and Export Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Admission Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Inpatient census, bed occupancy analytics, admission registers, and clinical discharge tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ExportButtonGroup
            disabled={admissions.length === 0 || isLoading}
            onExcel={() => downloadTableExcel(exportContext)}
            onCsv={() => downloadTableCSV(exportContext)}
            onPdf={() => downloadTablePDF(exportContext)}
            onPrint={() => printTable(exportContext)}
          />

          <button
            type="button"
            onClick={() => load(true)}
            disabled={isRefreshing || isLoading}
            className="h-7.5 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
            title="Refresh admission data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Quick Status Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Status:
          </span>
          {[
            { id: 'ALL', label: 'All Cases' },
            { id: 'ACTIVE', label: 'Active Inpatients' },
            { id: 'PLANNED', label: 'Planned' },
            { id: 'CONFIRMED', label: 'Confirmed' },
            { id: 'DISCHARGE_PENDING', label: 'Discharge Pending' },
            { id: 'DISCHARGED', label: 'Discharged' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setSelectedStatus(pill.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedStatus === pill.id
                  ? 'bg-[#08775A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
              {pill.id !== 'ALL' && byStatus[pill.id] !== undefined && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {byStatus[pill.id] || 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Secondary Dropdown Filters */}
        <div className="flex items-center gap-2 flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Payer:</span>
            <select
              value={selectedPayer}
              onChange={(e) => setSelectedPayer(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              <option value="ALL">All Payers</option>
              <option value="Self Pay">Self Pay</option>
              <option value="Corporate / Panel">Corporate / Panel</option>
            </select>
          </div>

          {departmentsList.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Dept:</span>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              >
                <option value="ALL">All Departments</option>
                {departmentsList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(selectedStatus !== 'ALL' || selectedPayer !== 'ALL' || selectedDepartment !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSelectedStatus('ALL');
                setSelectedPayer('ALL');
                setSelectedDepartment('ALL');
              }}
              className="text-xs text-[#08775A] hover:underline font-semibold cursor-pointer ml-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 3. Loading / Error / Main View */}
      {loadError ? (
        <div className="bg-white rounded-xl border border-rose-200 p-8 flex flex-col items-center gap-2.5 text-center shadow-xs">
          <AlertCircle className="h-7 w-7 text-rose-500" />
          <p className="text-sm text-rose-700 font-semibold">{loadError}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-1 px-4 py-2 bg-[#08775A] text-white text-xs font-semibold rounded-lg hover:bg-[#065f46] transition-colors cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3 text-slate-400 shadow-xs">
          <Loader2 className="h-6 w-6 animate-spin text-[#08775A]" />
          <span className="text-xs font-medium">Loading admission registry and bed analytics…</span>
        </div>
      ) : (
        <>
          {/* Distinctive Dark Theme Banner (matching reference UI) */}
          <div className="bg-gradient-to-r from-[#0a4636] to-[#08775A] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide text-white">
              <div className="h-6 w-6 rounded bg-white/15 text-white flex items-center justify-center">
                <LineChart className="h-3.5 w-3.5" />
              </div>
              <span>Admission Reports — Inpatient Stay &amp; Clinical Status Analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-100 font-medium bg-white/10 px-2.5 py-0.5 rounded-md">
                Active Inpatients: {activeInpatients}
              </span>
              <span className="hidden sm:inline-block text-[11px] text-emerald-200 font-mono">
                {totalAdmissions} recorded case{totalAdmissions === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* 4. Primary KPI Metric Cards Grid (6 Cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Total Admissions */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between text-slate-600 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Admissions</span>
                <div className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-slate-700" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-slate-900 leading-tight">{totalAdmissions}</p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[10.5px] text-slate-500">
                <span className="font-semibold text-emerald-700">{selfPayCount} Self</span>
                <span>•</span>
                <span className="font-semibold text-blue-700">{panelCount} Panel</span>
              </div>
            </div>

            {/* Active Inpatients */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between text-emerald-700 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Active Inpatients</span>
                <div className="h-6 w-6 rounded-md bg-emerald-50 flex items-center justify-center">
                  <Bed className="h-3.5 w-3.5 text-emerald-700" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-emerald-700 leading-tight">{activeInpatients}</p>
              <p className="text-[10.5px] text-emerald-600 font-medium mt-1.5 truncate">Occupying hospital beds</p>
            </div>

            {/* Planned & Confirmed */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between text-blue-700 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Planned / Pipeline</span>
                <div className="h-6 w-6 rounded-md bg-blue-50 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-blue-700" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-blue-700 leading-tight">{plannedConfirmed}</p>
              <p className="text-[10.5px] text-blue-600 font-medium mt-1.5 truncate">Awaiting check-in</p>
            </div>

            {/* Discharge Pending */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between text-amber-700 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Discharge Pending</span>
                <div className="h-6 w-6 rounded-md bg-amber-50 flex items-center justify-center">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-amber-700 leading-tight">{dischargePending}</p>
              <p className="text-[10.5px] text-amber-600 font-medium mt-1.5 truncate">In clearance pipeline</p>
            </div>

            {/* Discharged Cases */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between text-slate-600 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Discharged</span>
                <div className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-slate-700" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-slate-700 leading-tight">{discharged}</p>
              <p className="text-[10.5px] text-slate-400 mt-1.5 truncate">Completed hospital stays</p>
            </div>

            {/* Estimated Inpatient Turnover */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs hover:border-[#08775A]/40 transition-colors">
              <div className="flex items-center justify-between text-[#08775A] mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Estimated Intake</span>
                <div className="h-6 w-6 rounded-md bg-[#effaf5] flex items-center justify-center">
                  <Wallet className="h-3.5 w-3.5 text-[#08775A]" />
                </div>
              </div>
              <p className="text-lg font-bold font-mono text-[#08775A] leading-tight">
                {formatPKR(totalEstimatedRevenue)}
              </p>
              <p className="text-[10.5px] text-slate-500 mt-1.5 truncate">Total estimated billing</p>
            </div>
          </div>

          {/* 5. Dual Side-by-Side Breakdown Tables (Matching Balance Sheet & Billing Reports style) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Table: Status & Stay Breakdown */}
            <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-[#16a34a] text-white px-3.5 py-2 font-bold text-xs tracking-wide flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Inpatient Admissions by Stay Status
                  </span>
                  <span className="text-[11px] font-normal text-emerald-100">
                    {activeInpatients} bed{activeInpatients === 1 ? '' : 's'} occupied
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#f1f5f9] border-b border-slate-300 text-slate-800 text-[11px] font-bold uppercase">
                        <th className="w-10 py-2.5 px-2.5 text-center border-r border-slate-300">#</th>
                        <th className="py-2.5 px-3 border-r border-slate-300">Status</th>
                        <th className="py-2.5 px-3 border-r border-slate-300">Operational Phase</th>
                        <th className="py-2.5 px-3 text-center border-r border-slate-300">Share %</th>
                        <th className="py-2.5 px-3 text-right">Admissions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {(Object.keys(STATUS_CONFIG) as AdmissionStatus[]).map((st, idx) => {
                        const count = byStatus[st] || 0;
                        const cfg = STATUS_CONFIG[st];
                        const share = totalAdmissions > 0 ? ((count / totalAdmissions) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={st} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-2.5 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/50">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
                              >
                                {cfg.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 whitespace-nowrap text-[11px]">
                              {cfg.pipeline}
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {share}%
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {count}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Total */}
              <div className="border-t border-slate-300 flex items-center justify-between bg-slate-50 text-xs font-bold">
                <span className="py-2.5 px-3.5 text-slate-700 uppercase tracking-wide">Total Filtered Cases</span>
                <span className="py-2.5 px-4 bg-[#dcfce7] text-emerald-950 font-mono text-sm border-l border-slate-300">
                  {totalAdmissions}
                </span>
              </div>
            </div>

            {/* Right Table: Department Breakdown */}
            <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-[#2563eb] text-white px-3.5 py-2 font-bold text-xs tracking-wide flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Admissions by Clinical Department
                  </span>
                  <span className="text-[11px] font-normal text-blue-100">
                    {byDepartment.length} department{byDepartment.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[295px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#f1f5f9] border-b border-slate-300 sticky top-0 z-10 text-slate-800 text-[11px] font-bold uppercase">
                        <th className="w-10 py-2.5 px-2.5 text-center border-r border-slate-300">#</th>
                        <th className="py-2.5 px-3 border-r border-slate-300">Department / Specialty</th>
                        <th className="py-2.5 px-3 text-center border-r border-slate-300">Share %</th>
                        <th className="py-2.5 px-3 text-right">Admissions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {byDepartment.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-slate-400">
                            No department data found.
                          </td>
                        </tr>
                      ) : (
                        byDepartment.map(([name, count], idx) => {
                          const share = totalAdmissions > 0 ? ((count / totalAdmissions) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={name} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-2.5 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/50">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap font-semibold text-slate-900">
                                <span className="flex items-center gap-1.5">
                                  <Building2 className="h-3.5 w-3.5 text-blue-600" />
                                  <span>{name}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                {share}%
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                                {count}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Total */}
              <div className="border-t border-slate-300 flex items-center justify-between bg-slate-50 text-xs font-bold">
                <span className="py-2.5 px-3.5 text-slate-700 uppercase tracking-wide">Total Departmental Cases</span>
                <span className="py-2.5 px-4 bg-[#eff6ff] text-blue-950 font-mono text-sm border-l border-slate-300">
                  {totalAdmissions}
                </span>
              </div>
            </div>
          </div>

          {/* 6. Top Admitting Doctors & Consultants */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5 text-[#08775A]" />
                Top Admitting Physicians &amp; Primary Consultants
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                Ranked by inpatient admission volume
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f1f5f9] border-b border-slate-300 text-slate-800 text-[11px] font-bold uppercase">
                    <th className="w-10 py-2.5 px-2.5 text-center border-r border-slate-300">#</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Consultant / Physician</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Primary Department</th>
                    <th className="py-2.5 px-3 text-center border-r border-slate-300">Admissions Share</th>
                    <th className="py-2.5 px-3 text-right">Admitted Patients</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {byDoctor.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No physician data available.
                      </td>
                    </tr>
                  ) : (
                    byDoctor.map((doc, idx) => {
                      const share = totalAdmissions > 0 ? ((doc.count / totalAdmissions) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={doc.name} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-2.5 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/50">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap font-bold text-slate-900">
                            <span className="flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 text-[#08775A]" />
                              <span>{doc.name}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap text-slate-600">
                            {doc.department}
                          </td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {share}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#08775A] whitespace-nowrap">
                            {doc.count}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 7. Comprehensive Inpatient Census & Operational Summary Card */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Bed className="h-3.5 w-3.5 text-[#08775A]" />
                Inpatient Census &amp; Clinical Clearance Summary
              </span>
              <span className="text-[11px] font-normal text-slate-500 font-mono">
                Real-Time Inpatient Position
              </span>
            </div>

            <div className="divide-y divide-slate-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="py-2.5 px-4 text-slate-600 font-medium">Total Registered Admissions:</span>
                <span className="py-2.5 px-4 bg-slate-50 text-slate-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  {totalAdmissions}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="py-2.5 px-4 text-slate-600 font-medium">Self-Pay Out-of-Pocket Encounters:</span>
                <span className="py-2.5 px-4 bg-emerald-50/60 text-emerald-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  {selfPayCount} ({totalAdmissions > 0 ? ((selfPayCount / totalAdmissions) * 100).toFixed(0) : 0}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="py-2.5 px-4 text-slate-600 font-medium">Corporate / Panel Patient Encounters:</span>
                <span className="py-2.5 px-4 bg-blue-50/60 text-blue-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  {panelCount} ({totalAdmissions > 0 ? ((panelCount / totalAdmissions) * 100).toFixed(0) : 0}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="py-2.5 px-4 text-slate-600 font-medium">Hospital-Managed Medication Care (Inpatient Pharmacy):</span>
                <span className="py-2.5 px-4 bg-amber-50/60 text-amber-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  {hospitalManagedMedCount} cases
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-50/40">
                <span className="py-2.5 px-4 text-slate-900 font-bold">Active Inpatients (Current Bed Occupancy):</span>
                <span className="py-2.5 px-4 bg-[#dcfce7] text-emerald-950 font-black font-mono min-w-44 text-right border-l border-slate-200">
                  {activeInpatients} patients
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="py-2.5 px-4 text-slate-600 font-medium">Patients in Discharge Clearance Pipeline:</span>
                <span className="py-2.5 px-4 bg-amber-50 text-amber-900 font-bold font-mono min-w-44 text-right border-l border-slate-200">
                  {dischargePending} pending
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-50/50">
                <span className="py-3 px-4 text-slate-900 font-bold">Cumulative Estimated Inpatient Charges:</span>
                <span className="py-3 px-4 bg-[#bbf7d0] text-emerald-950 font-black font-mono text-sm min-w-44 text-right border-l border-slate-200">
                  {formatPKR(totalEstimatedRevenue)}
                </span>
              </div>
            </div>
          </div>

          {/* 8. Quick Navigation to Specialized Inpatient Reports */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-[#08775A]" />
                Specialized Inpatient Registers &amp; Reporting Hub
              </span>
              <span className="text-[11px] text-slate-400">Click to drill down into operational registers</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => navigate(`${navPrefix}/adm_census`)}
                className="p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-[#08775A]">
                    Inpatient Census
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#08775A] group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500">Live bedside census, assigned rooms, and consultant tracking</p>
              </button>

              <button
                type="button"
                onClick={() => navigate(`${navPrefix}/adm_bed_occupancy`)}
                className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                    Bed Occupancy
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500">Ward utilization rates, occupied vs available bed capacity</p>
              </button>

              <button
                type="button"
                onClick={() => navigate(`${navPrefix}/adm_discharge_clearance_report`)}
                className="p-3 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-amber-700">
                    Discharge Clearance
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500">3-Way Gate: Clinical, Hospital Billing &amp; Pharmacy Clearances</p>
              </button>

              <button
                type="button"
                onClick={() => navigate(`${navPrefix}/adm_register_report`)}
                className="p-3 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-slate-900">
                    Master Admission Register
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500">Chronological admission ledger with Running Bill drill-down</p>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
