import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users,
  Stethoscope,
  Clock,
  Activity,
  Bed,
  Layers,
  Receipt,
  CreditCard,
  AlertCircle,
  Pill,
  DollarSign,
  Package,
  Calendar,
  Filter,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileText,
  ChevronRight,
  Info,
  X,
  Shield,
  Banknote,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  DateFilterPreset,
  AttentionAlertItem,
} from './superAdminDashboardData';
import { dashboardService, ResolvedDashboardState } from '../../services/dashboardService';
import { formatPKR, formatNumber } from '../../utils/formatters';
import {
  formatDateISO,
  getStartOfMonth,
  getHospitalCurrentDate,
} from '../../utils/dateConstants';

const EMPTY_DASHBOARD: ResolvedDashboardState = {
  periodLabel: 'Today',
  infrastructure: {
    activeDepartmentsCount: 0,
    totalStaffCount: 0,
    doctorsCount: 0,
    activePanelsCount: 0,
    activePanelPatientsCount: 0,
    activeAdminsCount: 0,
  },
  kpis: [],
  patientFlow: [],
  patientHourlyTrend: [],
  billingSummary: {
    totalInvoices: 0,
    grossBilling: 0,
    discounts: 0,
    netBilling: 0,
    paidAmount: 0,
    partiallyPaidAmount: 0,
    partiallyPaidInvoicesCount: 0,
    outstandingAmount: 0,
    refundsAmount: 0,
  },
  revenueChart: [],
  revenueChannels: { cash: 0, onlineBank: 0, panelCorporate: 0, outstanding: 0 },
  paymentMethods: [],
  departmentActivity: [],
  doctorsOnDuty: [],
  pharmacySummary: {
    salesAmount: 0,
    invoicesCount: 0,
    medicinesDispensedCount: 0,
    pendingRequestsCount: 0,
    returnsCount: 0,
    returnsAmount: 0,
    nearExpiryAlertsCount: 0,
  },
  expenses: { todayAmount: 0, monthAmount: 0, topCategories: [] },
  corporatePanels: {
    activePanelsCount: 0,
    panelPatientsCount: 0,
    panelBillingAmount: 0,
    panelOutstandingAmount: 0,
    topPanels: [],
  },
  bedMetrics: {
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    occupancyPercent: 0,
    totalWards: 0,
    totalRooms: 0,
    wards: [],
  },
  inventorySummary: {
    lowStockItemsCount: 0,
    outOfStockItemsCount: 0,
    nearExpiryItemsCount: 0,
    expiredItemsCount: 0,
    pendingStockRequestsCount: 0,
  },
  flaggedStockItems: [],
  attentionAlerts: [],
  recentActivity: [],
  recentTransactions: [],
};

interface SuperAdminDashboardProps {
  onNavigateToModule?: (moduleId: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onNavigateToModule,
}) => {
  // Date range filter state - initialized from browser/system local date
  const [selectedPreset, setSelectedPreset] = useState<DateFilterPreset>('today');
  const [fromDate, setFromDate] = useState<string>(() => formatDateISO(getStartOfMonth()));
  const [toDate, setToDate] = useState<string>(() => formatDateISO(getHospitalCurrentDate()));
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);

  // Selected Alert for modal inspection
  const [activeAlertModal, setActiveAlertModal] = useState<AttentionAlertItem | null>(null);

  // Live backend dashboard data
  const [dashboardData, setDashboardData] = useState<ResolvedDashboardState | null>(() =>
    dashboardService.getCachedDashboard(),
  );
  const [isLoading, setIsLoading] = useState<boolean>(!dashboardService.getCachedDashboard());
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboardData = useCallback(
    async (preset: DateFilterPreset, from?: string, to?: string) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await dashboardService.fetchSuperAdminDashboard(preset, from, to);
        setDashboardData(data);
      } catch (err: any) {
        setLoadError(err.message || 'Failed to load live dashboard data from server.');
      } finally {
        setIsLoading(false);
        setIsApplying(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadDashboardData(selectedPreset, fromDate, toDate);
  }, [selectedPreset, loadDashboardData]);

  // Active dataset derived exclusively from live backend data
  const currentDataset = dashboardData || EMPTY_DASHBOARD;
  const bedMetrics = dashboardData?.bedMetrics || EMPTY_DASHBOARD.bedMetrics;
  const inventoryAlerts = dashboardData?.inventorySummary || EMPTY_DASHBOARD.inventorySummary;
  const attentionAlerts = dashboardData?.attentionAlerts || [];
  const recentActivity = dashboardData?.recentActivity || [];
  const recentTransactions = dashboardData?.recentTransactions || [];

  // Period-aware KPI title mapping to strictly reflect the selected timeframe
  const displayKpis = useMemo(() => {
    return currentDataset.kpis.map((kpi) => {
      if (kpi.id === 'kpi_today_patients') {
        let title = "Today's Patients";
        if (selectedPreset === 'yesterday') title = "Yesterday's Patients";
        else if (selectedPreset === 'this_week') title = "Patients This Week";
        else if (selectedPreset === 'this_month') title = "Patients This Month";
        else if (selectedPreset === 'custom') title = "Patients";
        return { ...kpi, title, navModule: 'today_patients' };
      }
      if (kpi.id === 'kpi_today_billing') {
        let title = "Today's Billing";
        if (selectedPreset === 'yesterday') title = "Yesterday's Billing";
        else if (selectedPreset === 'this_week') title = "Billing This Week";
        else if (selectedPreset === 'this_month') title = "Billing This Month";
        else if (selectedPreset === 'custom') title = "Billing";
        return { ...kpi, title, navModule: 'billing_overview' };
      }
      if (kpi.id === 'kpi_today_collections') {
        let title = "Today's Collections";
        if (selectedPreset === 'yesterday') title = "Yesterday's Collections";
        else if (selectedPreset === 'this_week') title = "Collections This Week";
        else if (selectedPreset === 'this_month') title = "Collections This Month";
        else if (selectedPreset === 'custom') title = "Collections";
        return { ...kpi, title };
      }
      if (kpi.id === 'kpi_today_expenses') {
        let title = "Today's Expenses";
        if (selectedPreset === 'yesterday') title = "Yesterday's Expenses";
        else if (selectedPreset === 'this_week') title = "Expenses This Week";
        else if (selectedPreset === 'this_month') title = "Expenses This Month";
        else if (selectedPreset === 'custom') title = "Expenses";
        return { ...kpi, title };
      }
      // Current-state metrics remain unchanged
      return kpi;
    });
  }, [currentDataset, selectedPreset]);

  // Formatted period description displayed above dashboard
  const displayPeriodLabel = useMemo(() => {
    if (selectedPreset === 'custom') {
      return `Custom Range (${fromDate} to ${toDate})`;
    }
    return currentDataset.periodLabel;
  }, [selectedPreset, fromDate, toDate, currentDataset.periodLabel]);

  // Handle preset selection
  const handleSelectPreset = (preset: DateFilterPreset) => {
    setIsApplying(true);
    setSelectedPreset(preset);
    setDateValidationError(null);
    loadDashboardData(preset, fromDate, toDate);
  };

  // Handle Custom Range Apply
  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) {
      setDateValidationError('Please specify both From Date and To Date.');
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      setDateValidationError('From Date cannot be later than To Date.');
      return;
    }

    setDateValidationError(null);
    setIsApplying(true);
    setSelectedPreset('custom');
    loadDashboardData('custom', fromDate, toDate);
  };

  // Handle Reset to Today
  const handleResetFilter = () => {
    setIsApplying(true);
    setSelectedPreset('today');
    const startM = formatDateISO(getStartOfMonth());
    const curD = formatDateISO(getHospitalCurrentDate());
    setFromDate(startM);
    setToDate(curD);
    setDateValidationError(null);
    loadDashboardData('today', startM, curD);
  };

  // Map icon names to Lucide icons
  const renderKpiIcon = (name: string) => {
    switch (name) {
      case 'Users':
        return <Users className="h-5 w-5" />;
      case 'Stethoscope':
        return <Stethoscope className="h-5 w-5" />;
      case 'Clock':
        return <Clock className="h-5 w-5" />;
      case 'Activity':
        return <Activity className="h-5 w-5" />;
      case 'Bed':
        return <Bed className="h-5 w-5" />;
      case 'Layers':
        return <Layers className="h-5 w-5" />;
      case 'Receipt':
        return <Receipt className="h-5 w-5" />;
      case 'CreditCard':
        return <CreditCard className="h-5 w-5" />;
      case 'AlertCircle':
        return <AlertCircle className="h-5 w-5" />;
      case 'Pill':
        return <Pill className="h-5 w-5" />;
      case 'DollarSign':
        return <DollarSign className="h-5 w-5" />;
      case 'Package':
        return <Package className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800">
      {/* =========================================================================
          1. DASHBOARD HEADER & DATE FILTER AREA (Section 3)
      ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                Hospital Dashboard
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db]">
                <ShieldCheck className="h-3.5 w-3.5 mr-1 text-[#129b70]" />
                Super Admin View
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Overview of hospital operations, patient activity, billing and key alerts.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
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
              Period: <strong className="text-slate-900">{displayPeriodLabel}</strong>
            </span>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Preset Buttons */}
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
                { key: 'custom', label: 'Custom Range' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => handleSelectPreset(preset.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedPreset === preset.key
                    ? 'bg-[#129b70] text-white shadow-2xs font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Controls & Reset */}
          <div className="flex flex-wrap items-center gap-2">
            {selectedPreset === 'custom' && (
              <form onSubmit={handleApplyCustomRange} className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-xs">
                  <label htmlFor="fromDateInput" className="text-slate-500 text-[11px] font-medium">From:</label>
                  <input
                    id="fromDateInput"
                    lang="en-GB" type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-transparent border-none text-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-xs">
                  <label htmlFor="toDateInput" className="text-slate-500 text-[11px] font-medium">To:</label>
                  <input
                    id="toDateInput"
                    lang="en-GB" type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-transparent border-none text-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-[#129b70] hover:bg-[#0e7d5a] text-white text-xs font-semibold transition-colors"
                >
                  Apply
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={handleResetFilter}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Reset filter to Today"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading || isApplying ? 'animate-spin' : ''}`} />
              Reset
            </button>
          </div>
        </div>

        {dateValidationError && (
          <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{dateValidationError}</span>
          </div>
        )}

        {loadError && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => loadDashboardData(selectedPreset, fromDate, toDate)}
              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. PRIMARY 12 KPI CARDS (Section 4 & 18)
      ========================================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Key Operational & Financial Indicators
          </h2>
          <span className="text-[11px] text-slate-400">
            Values formatted in PKR &bull; Operational status
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayKpis.map((kpi) => (
            <div
              key={kpi.id}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-sm transition-shadow flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 line-clamp-1">
                  {kpi.title}
                </span>
                <div className={`p-2 rounded-lg border shrink-0 ${kpi.accentBg} ${kpi.colorClass}`}>
                  {renderKpiIcon(kpi.iconName)}
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                  {kpi.value}
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className="text-slate-500 truncate max-w-[150px]">{kpi.contextText}</span>
                  {kpi.changeText && (
                    <span
                      className={`inline-flex items-center font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                        kpi.isPositive
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-amber-700 bg-amber-50'
                      }`}
                    >
                      {kpi.isPositive ? (
                        <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
                      )}
                      {kpi.changeText}
                    </span>
                  )}
                </div>
              </div>

              {kpi.navModule && (
                <button
                  type="button"
                  onClick={() => onNavigateToModule?.(kpi.navModule!)}
                  className="mt-3 pt-2 border-t border-slate-100 text-[11px] font-semibold text-[#0e7d5a] hover:text-[#129b70] hover:underline flex items-center justify-between"
                >
                  <span>View Details</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          3. PATIENT FLOW OVERVIEW (Section 5)
      ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Patient Flow Overview</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive patient trajectory across Outpatient, Observation, Emergency, and Inpatient Admissions
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
            Active Census for {currentDataset.periodLabel}
          </span>
        </div>

        {/* 4 Patient Flow Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {currentDataset.patientFlow.map((flow) => {
            const isAdmission = flow.category === 'Admission';
            const totalLabel = isAdmission
              ? 'Period Admissions'
              : 'Registered Encounters';
            const waitingLabel = isAdmission ? 'Pending Bed' : 'Waiting';
            const completedLabel = isAdmission ? 'Discharged' : 'Done';
            const activeLabel = isAdmission ? 'Admitted Active' : 'In Service';

            return (
              <div
                key={flow.category}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {flow.category}
                    </span>
                    {isAdmission && (
                      <span className="text-[9px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                        Flow
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Peak: {flow.peakHour}
                  </span>
                </div>

                <div className="my-3">
                  <div className="text-2xl font-bold text-slate-900 font-mono">
                    {formatNumber(flow.total)}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">{totalLabel}</div>
                  {isAdmission && (
                    <div className="text-[10px] text-teal-700 mt-0.5 font-medium">
                      Current census: 189 active inpatients
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-1.5 rounded border border-slate-100">
                    <span className="text-[9px] text-amber-600 font-bold block uppercase truncate" title={waitingLabel}>
                      {waitingLabel}
                    </span>
                    <span className="font-bold text-slate-800 font-mono">{formatNumber(flow.waiting)}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-100">
                    <span className="text-[9px] text-emerald-600 font-bold block uppercase truncate" title={completedLabel}>
                      {completedLabel}
                    </span>
                    <span className="font-bold text-slate-800 font-mono">{formatNumber(flow.completed)}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-100">
                    <span className="text-[9px] text-[#0e7d5a] font-bold block uppercase truncate" title={activeLabel}>
                      {activeLabel}
                    </span>
                    <span className="font-bold text-slate-800 font-mono">{formatNumber(flow.active)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hourly / Daily Flow Line Chart */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Patient Flow Trend ({selectedPreset === 'this_week' || selectedPreset === 'this_month' ? 'Daily / Weekly Load' : 'Hourly Distribution'})
            </span>
            <span className="text-[11px] text-slate-400">Consultations vs Emergency Admissions</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentDataset.patientHourlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="opd"
                  name="OPD Visits"
                  stroke="#129b70"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="emergency"
                  name="Emergency"
                  stroke="#e11d48"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="observation"
                  name="Observation"
                  stroke="#0e7d5a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="admitted"
                  name="Admissions"
                  stroke="#14b885"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. REVENUE & COLLECTIONS OVERVIEW (Section 6)
      ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Revenue & Collections Overview</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct comparison of gross billing generated against cash/bank collections realized
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#0e7d5a] bg-[#effaf5] px-2.5 py-1 rounded-md border border-[#c2e7db]">
              Billing: {formatPKR(currentDataset.billingSummary.netBilling)}
            </span>
            <span className="text-xs font-bold text-[#0e7d5a] bg-[#effaf5] px-2.5 py-1 rounded-md border border-[#c2e7db]">
              Collections: {formatPKR(currentDataset.billingSummary.paidAmount)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue & Collection Chart (2 cols) */}
          <div className="lg:col-span-2 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentDataset.revenueChart} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `PKR ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: number) => [formatPKR(val), '']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="billing" name="Billing Generated" fill="#129b70" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collections" name="Collections Realized" fill="#0e7d5a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Settlement Channels breakdown */}
          <div className="space-y-3 flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Settlement Realization Channels
            </span>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-800">
                  <Banknote className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">Cash Settlements</span>
                  <span className="text-[10px] text-slate-500">Physical cashier receipt</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-900 font-mono block">
                  {formatPKR(currentDataset.revenueChannels.cash)}
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold">Immediate Cleared</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-[#effaf5] text-[#0e7d5a]">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">Online & Bank POS</span>
                  <span className="text-[10px] text-slate-500">Card machines & transfers</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-900 font-mono block">
                  {formatPKR(currentDataset.revenueChannels.onlineBank)}
                </span>
                <span className="text-[10px] text-[#0e7d5a] font-semibold">Bank Deposited</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-[#effaf5] text-[#129b70]">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">Panel / Corporate Credit</span>
                  <span className="text-[10px] text-slate-500">Insurance pre-approved claims</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-900 font-mono block">
                  {formatPKR(currentDataset.revenueChannels.panelCorporate)}
                </span>
                <span className="text-[10px] text-[#129b70] font-semibold">Under Billing</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-amber-100 text-amber-800">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-amber-900 block">Outstanding Balance</span>
                  <span className="text-[10px] text-amber-700">Receivables pending recovery</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-amber-900 font-mono block">
                  {formatPKR(currentDataset.revenueChannels.outstanding)}
                </span>
                <span className="text-[10px] text-amber-700 font-semibold">To be recovered</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. DEPARTMENT-WISE ACTIVITY (Section 7)
      ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Department-wise Activity</h3>
            <p className="text-xs text-slate-500">
              Operational load, patient encounters and billing generated per hospital department
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToModule?.('departments')}
            className="text-xs font-semibold text-[#0e7d5a] hover:text-[#129b70] hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View All Clinical Departments</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-5">Department</th>
                <th className="py-3 px-4">Specialty Type</th>
                <th className="py-3 px-4 text-center">Patients Handled</th>
                <th className="py-3 px-4 text-right">Billing Generated (PKR)</th>
                <th className="py-3 px-4 text-center">Current Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentDataset.departmentActivity.map((dept) => (
                <tr
                  key={dept.id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => onNavigateToModule?.('departments')}
                  title="Click to view department overview"
                >
                  <td className="py-3 px-5 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{dept.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{dept.type}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-800 font-mono">
                    {formatNumber(dept.patients)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                    {formatPKR(dept.billing)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${dept.statusColor}`}
                    >
                      {dept.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          6. CURRENT ADMISSIONS / BED OCCUPANCY (Section 8)
      ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Current Admissions & Bed Occupancy</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Current hospital capacity monitoring across clinical wards and intensive care units
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToModule?.('wards_rooms_beds')}
            className="text-xs font-semibold text-[#0e7d5a] hover:text-[#129b70] hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Manage Wards & Beds</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Global Bed Metrics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-xs text-slate-500 font-medium block">Total Beds</span>
            <span className="text-2xl font-bold text-slate-900 font-mono mt-1 block">
              {bedMetrics.totalBeds}
            </span>
            <span className="text-[11px] text-slate-400">Institutional capacity</span>
          </div>

          <div className="p-3.5 rounded-xl border border-[#c2e7db] bg-[#effaf5]">
            <span className="text-xs text-[#0e7d5a] font-medium block">Occupied Beds</span>
            <span className="text-2xl font-bold text-[#0e7d5a] font-mono mt-1 block">
              {bedMetrics.occupiedBeds}
            </span>
            <span className="text-[11px] text-[#129b70] font-medium">Currently admitted</span>
          </div>

          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
            <span className="text-xs text-emerald-800 font-medium block">Available Beds</span>
            <span className="text-2xl font-bold text-emerald-900 font-mono mt-1 block">
              {bedMetrics.availableBeds}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">Ready for admissions</span>
          </div>

          <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/50">
            <span className="text-xs text-teal-800 font-medium block">Overall Occupancy Rate</span>
            <span className="text-2xl font-bold text-teal-900 font-mono mt-1 block">
              {bedMetrics.occupancyPercent}%
            </span>
            <span className="text-[11px] text-teal-700 font-medium">Target optimal range</span>
          </div>
        </div>

        {/* Ward Breakdown Table / Grid */}
        <div className="space-y-3 pt-2">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
            Ward & Critical Care Occupancy Breakdown
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bedMetrics.wards.map((ward) => (
              <div
                key={ward.wardName}
                className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                      {ward.wardName}
                    </h4>
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                        ward.occupancyPercent >= 80
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {ward.occupancyPercent}%
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{ward.type}</span>
                </div>

                {/* Progress bar */}
                <div className="my-3">
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        ward.occupancyPercent >= 80 ? 'bg-amber-500' : 'bg-[#129b70]'
                      }`}
                      style={{ width: `${ward.occupancyPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Total</span>
                    <span className="font-bold text-slate-800">{ward.totalBeds}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#129b70] block uppercase">Occupied</span>
                    <span className="font-bold text-[#0e7d5a]">{ward.occupiedBeds}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 block uppercase">Free</span>
                    <span className="font-bold text-emerald-800">{ward.availableBeds}</span>
                  </div>
                </div>

                {ward.ventilatorsInUse && (
                  <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                    <span>Ventilators in active use:</span>
                    <strong className="text-slate-800">{ward.ventilatorsInUse} units</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================================
          7. BILLING SUMMARY & COLLECTION BY PAYMENT METHOD (Sections 9 & 10)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Billing Summary (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Billing Summary</h3>
              <p className="text-xs text-slate-500">
                Institutional revenue reconciliation, discounts, paid portions and outstanding
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToModule?.('billing_reports')}
              className="text-xs font-semibold text-[#0e7d5a] hover:underline"
            >
              Full Invoicing Ledger →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Total Invoices</span>
              <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                {formatNumber(currentDataset.billingSummary.totalInvoices)}
              </span>
              <span className="text-[10px] text-slate-400">Slips issued</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Gross Billing</span>
              <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                {formatPKR(currentDataset.billingSummary.grossBilling)}
              </span>
              <span className="text-[10px] text-slate-400">Before discounts</span>
            </div>

            <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200">
              <span className="text-[11px] text-amber-800 font-medium block">Discounts</span>
              <span className="text-lg font-bold text-amber-900 font-mono mt-0.5 block">
                {formatPKR(currentDataset.billingSummary.discounts)}
              </span>
              <span className="text-[10px] text-amber-700">Welfare & corporate</span>
            </div>

            <div className="p-3 bg-[#effaf5] rounded-lg border border-[#c2e7db]">
              <span className="text-[11px] text-[#0e7d5a] font-medium block">Net Billing</span>
              <span className="text-lg font-bold text-[#0e7d5a] font-mono mt-0.5 block">
                {formatPKR(currentDataset.billingSummary.netBilling)}
              </span>
              <span className="text-[10px] text-[#129b70]">Realizable total</span>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-emerald-800 font-medium block">Collections Received</span>
              <span className="text-lg font-bold text-emerald-900 font-mono mt-0.5 block">
                {formatPKR(currentDataset.billingSummary.paidAmount)}
              </span>
              <span className="text-[10px] text-emerald-700">Total realized receipts</span>
            </div>

            <div className="p-3 bg-[#effaf5] rounded-lg border border-[#c2e7db]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#0e7d5a] font-semibold block">Partially Paid</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#0e7d5a] bg-emerald-100 px-1.5 py-0.2 rounded">
                  Subset
                </span>
              </div>
              <span className="text-lg font-bold text-[#0e7d5a] font-mono mt-0.5 block">
                {formatPKR(currentDataset.billingSummary.partiallyPaidAmount)}
              </span>
              <span className="text-[10px] text-[#129b70]">
                On {currentDataset.billingSummary.partiallyPaidInvoicesCount} slips (in Collections)
              </span>
            </div>

            <div className="p-3 bg-rose-50/50 rounded-lg border border-rose-200">
              <span className="text-[11px] text-rose-800 font-medium block">Outstanding Balance</span>
              <span className="text-lg font-bold text-rose-900 font-mono mt-0.5 block">
                {formatPKR(currentDataset.billingSummary.outstandingAmount)}
              </span>
              <span className="text-[10px] text-rose-700">Receivable dues</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Refunds</span>
              <span className="text-lg font-bold text-slate-800 font-mono mt-0.5 block">
                {formatPKR(currentDataset.billingSummary.refundsAmount)}
              </span>
              <span className="text-[10px] text-slate-400">Approved reversals</span>
            </div>
          </div>

          {/* Mathematical Reconciliation Banner */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap font-medium">
              <span className="text-slate-500 font-semibold">Reconciliation:</span>
              <span className="text-[#0e7d5a] font-bold font-mono">Net Billing ({formatPKR(currentDataset.billingSummary.netBilling)})</span>
              <span className="text-slate-400">=</span>
              <span className="text-emerald-800 font-bold font-mono">Collections Received ({formatPKR(currentDataset.billingSummary.paidAmount)})</span>
              <span className="text-slate-400">+</span>
              <span className="text-rose-800 font-bold font-mono">Outstanding Balance ({formatPKR(currentDataset.billingSummary.outstandingAmount)})</span>
            </div>
            <span className="text-[11px] text-slate-500 italic">
              * Partially-paid collections ({formatPKR(currentDataset.billingSummary.partiallyPaidAmount)}) are an informational subset within Collections Received.
            </span>
          </div>
        </div>

        {/* Collection by Payment Method (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Payment Channels</h3>
                <p className="text-xs text-slate-500">Collection share by method</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToModule?.('collection_reports')}
                className="text-xs font-semibold text-[#0e7d5a] hover:underline"
              >
                Collections →
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              {currentDataset.paymentMethods.map((pm) => (
                <div key={pm.method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{pm.method}</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {formatPKR(pm.amount)} ({pm.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#129b70] rounded-full transition-all"
                      style={{ width: `${pm.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Total Realized:</span>
            <strong className="text-slate-900 font-mono">
              {formatPKR(currentDataset.billingSummary.paidAmount)}
            </strong>
          </div>
        </div>
      </div>

      {/* =========================================================================
          8. PHARMACY & INVENTORY SUMMARIES (Sections 11 & 12)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pharmacy Summary (Section 11) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-[#149E75]" />
                <h3 className="text-base font-bold text-slate-900">Pharmacy Summary</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Overview of pharmacy revenue, prescription dispense count, and returns
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToModule?.('pharmacy_integration')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#effaf5] text-[#08775A] border border-[#c2e7db] hover:bg-[#dff5ea] transition-colors flex items-center gap-1"
            >
              <span>View Pharmacy Overview</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-[#effaf5]/60 rounded-lg border border-[#c2e7db]">
              <span className="text-[11px] text-[#08775A] font-medium block">Pharmacy Sales</span>
              <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                {formatPKR(currentDataset.pharmacySummary.salesAmount)}
              </span>
              <span className="text-[10px] text-slate-500">Gross revenue</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-600 font-medium block">Invoices Issued</span>
              <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                {formatNumber(currentDataset.pharmacySummary.invoicesCount)}
              </span>
              <span className="text-[10px] text-slate-400">Cashier receipts</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-600 font-medium block">Medicines Dispensed</span>
              <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                {formatNumber(currentDataset.pharmacySummary.medicinesDispensedCount)}
              </span>
              <span className="text-[10px] text-slate-400">Units / strips</span>
            </div>

            <div className="p-3 bg-amber-50/40 rounded-lg border border-amber-100">
              <span className="text-[11px] text-amber-700 font-medium block">Pending Requests</span>
              <span className="text-lg font-bold text-amber-900 font-mono mt-0.5 block">
                {currentDataset.pharmacySummary.pendingRequestsCount}
              </span>
              <span className="text-[10px] text-amber-600">Ward indent queues</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-600 font-medium block">Patient Returns</span>
              <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                {currentDataset.pharmacySummary.returnsCount} ({formatPKR(currentDataset.pharmacySummary.returnsAmount)})
              </span>
              <span className="text-[10px] text-slate-400">Reversal refunds</span>
            </div>

            <div className="p-3 bg-rose-50/40 rounded-lg border border-rose-100">
              <span className="text-[11px] text-rose-700 font-medium block">Near Expiry Alerts</span>
              <span className="text-lg font-bold text-rose-900 font-mono mt-0.5 block">
                {currentDataset.pharmacySummary.nearExpiryAlertsCount}
              </span>
              <span className="text-[10px] text-rose-600">&lt; 30 days shelf life</span>
            </div>
          </div>
        </div>

        {/* Inventory Alert Summary (Section 12) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">Inventory Alert Summary</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Central medical store alerts, safety thresholds, and requisitions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToModule?.('inventory_reports')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1"
            >
              <span>View Inventory Overview</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
              <span className="text-[11px] text-amber-800 font-medium block">Low Stock Items</span>
              <span className="text-lg font-bold text-amber-900 font-mono mt-0.5 block">
                {inventoryAlerts.lowStockItemsCount} Items
              </span>
              <span className="text-[10px] text-amber-700 font-semibold">Below min-threshold</span>
            </div>

            <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-200">
              <span className="text-[11px] text-rose-800 font-medium block">Out of Stock Items</span>
              <span className="text-lg font-bold text-rose-900 font-mono mt-0.5 block">
                {inventoryAlerts.outOfStockItemsCount} Items
              </span>
              <span className="text-[10px] text-rose-700 font-semibold">Zero balance</span>
            </div>

            <div className="p-3 bg-orange-50/60 rounded-lg border border-orange-200">
              <span className="text-[11px] text-orange-800 font-medium block">Near Expiry Items</span>
              <span className="text-lg font-bold text-orange-900 font-mono mt-0.5 block">
                {inventoryAlerts.nearExpiryItemsCount} Batches
              </span>
              <span className="text-[10px] text-orange-700">&lt; 30 days remaining</span>
            </div>

            <div className="p-3 bg-rose-100/60 rounded-lg border border-rose-300">
              <span className="text-[11px] text-rose-900 font-medium block">Expired Items</span>
              <span className="text-lg font-bold text-rose-950 font-mono mt-0.5 block">
                {inventoryAlerts.expiredItemsCount} Batches
              </span>
              <span className="text-[10px] text-rose-800 font-semibold">Quarantine required</span>
            </div>

            <div className="p-3 bg-[#effaf5] rounded-lg border border-[#c2e7db] sm:col-span-2">
              <span className="text-[11px] text-[#0e7d5a] font-medium block">Pending Stock Requests</span>
              <span className="text-lg font-bold text-[#0e7d5a] font-mono mt-0.5 block">
                {inventoryAlerts.pendingStockRequestsCount} Purchase Requisitions
              </span>
              <span className="text-[10px] text-[#129b70] font-semibold">Awaiting store manager approval</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          9. EXPENSES & CORPORATE PANELS (Sections 13 & 14)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Summary (Section 13) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Hospital Expense Summary</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Executive overview of clinical, operational, and utility expenditures
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
              Monthly Total: {formatPKR(currentDataset.expenses.monthAmount)}
            </span>
          </div>

          <div className="space-y-3 pt-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
              Top Operational Expense Categories
            </span>

            {currentDataset.expenses.topCategories.map((exp) => (
              <div key={exp.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 truncate max-w-[260px]">
                    {exp.category}
                  </span>
                  <span className="font-mono text-slate-900 font-bold">
                    {formatPKR(exp.amount)} ({exp.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-700 rounded-full transition-all"
                    style={{ width: `${exp.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Selected Period Expenses:</span>
            <strong className="text-slate-900 font-mono">
              {formatPKR(currentDataset.expenses.todayAmount)}
            </strong>
          </div>
        </div>

        {/* Corporate Panels Summary (Section 14) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Corporate & Panel Summary</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Insurance providers, corporate pre-authorizations, and credit receivables
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToModule?.('corporate_panels')}
              className="text-xs font-semibold text-[#0e7d5a] hover:underline"
            >
              Panels Directory →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-[11px] text-slate-500 block">Active Panels</span>
              <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                {currentDataset.corporatePanels.activePanelsCount} Partners
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">All contracts active</span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-[11px] text-slate-500 block">
                {selectedPreset === 'today'
                  ? 'Panel Patients Today'
                  : selectedPreset === 'yesterday'
                  ? 'Panel Patients Yesterday'
                  : selectedPreset === 'this_week'
                  ? 'Panel Patients This Week'
                  : selectedPreset === 'this_month'
                  ? 'Panel Patients This Month'
                  : 'Panel Patients'}
              </span>
              <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                {currentDataset.corporatePanels.panelPatientsCount} Encounters
              </span>
              <span className="text-[10px] text-[#0e7d5a] font-medium">Cardholders served</span>
            </div>

            <div className="p-3 rounded-lg border border-[#c2e7db] bg-[#effaf5]">
              <span className="text-[11px] text-[#0e7d5a] block">Panel Billing (Period)</span>
              <span className="text-lg font-bold text-[#0e7d5a] font-mono mt-0.5 block">
                {formatPKR(currentDataset.corporatePanels.panelBillingAmount)}
              </span>
              <span className="text-[10px] text-[#129b70]">Pre-authorized claims</span>
            </div>

            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
              <span className="text-[11px] text-amber-900 block">Panel Outstanding</span>
              <span className="text-lg font-bold text-amber-950 font-mono mt-0.5 block">
                {formatPKR(currentDataset.corporatePanels.panelOutstandingAmount)}
              </span>
              <span className="text-[10px] text-amber-700">Aging receivables</span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
              Top Corporate Partners
            </span>
            <div className="space-y-1.5 text-xs">
              {currentDataset.corporatePanels.topPanels.map((panel) => (
                <div
                  key={panel.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="font-semibold text-slate-800 truncate max-w-[240px]">
                    {panel.name}
                  </span>
                  <div className="text-right font-mono">
                    <span className="font-bold text-slate-900">{formatPKR(panel.billing)}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5 font-sans">
                      ({panel.patients} pts)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          10. ATTENTION REQUIRED / ALERTS (Section 16)
      ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Attention Required</h3>
              <p className="text-xs text-slate-500">
                Operational anomalies, threshold breaches, and items requiring management sign-off
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
            {attentionAlerts.length} Alerts Active
          </span>
        </div>

        {attentionAlerts.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-800">All Operations Within Normal Limits</p>
            <p className="text-[11px] text-slate-500">No critical anomalies or threshold breaches reported across departments.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attentionAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  alert.severity === 'Critical'
                    ? 'bg-rose-50/40 border-rose-200'
                    : alert.severity === 'Warning'
                    ? 'bg-amber-50/40 border-amber-200'
                    : 'bg-[#effaf5] border-[#c2e7db]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        alert.severity === 'Critical'
                          ? 'bg-rose-100 text-rose-800'
                          : alert.severity === 'Warning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db]'
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      {alert.relevantMetric}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{alert.title}</h4>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{alert.description}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveAlertModal(alert)}
                    className="text-[11px] font-bold text-[#0e7d5a] hover:underline flex items-center gap-1"
                  >
                    <span>View Details</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  {alert.navModule && (
                    <button
                      type="button"
                      onClick={() => onNavigateToModule?.(alert.navModule!)}
                      className="text-[10px] text-slate-500 hover:text-slate-800 hover:underline"
                    >
                      Go to Module &rarr;
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          11. RECENT IMPORTANT ACTIVITY (Section 15 & 20)
      ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Important Activity</h3>
            <p className="text-xs text-slate-500">
              Audit log of critical clinical, financial, and operational operations by verified staff
            </p>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#effaf5] text-[#08775A] font-semibold self-start sm:self-auto border border-[#c2e7db]">
            Live Operational Log
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-5">Date / Time</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4 font-mono">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 text-xs">
                    No recent system activities or audit records found.
                  </td>
                </tr>
              ) : (
                recentActivity.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-5 text-slate-500 whitespace-nowrap">{act.timestamp}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{act.user}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                        {act.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{act.action}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db] text-[10px] font-medium">
                        {act.module}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 font-semibold">{act.reference}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          12. RECENT TRANSACTIONS TABLE (Section 17 & 20)
      ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Transactions</h3>
            <p className="text-xs text-slate-500">
              Recent cashier invoices, patient payments, dispensary receipts, and approved refunds
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToModule?.('billing_reports')}
            className="text-xs font-semibold text-[#0e7d5a] hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View All Invoices</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-5">Reference</th>
                <th className="py-3 px-4">Patient / Party</th>
                <th className="py-3 px-4">Transaction Type</th>
                <th className="py-3 px-4 text-right">Amount (PKR)</th>
                <th className="py-3 px-4 text-center">Payment Status</th>
                <th className="py-3 px-4">Handled By</th>
                <th className="py-3 px-4 text-right">Date / Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    <div className="flex flex-col items-center justify-center gap-1.5 py-4">
                      <Receipt className="h-8 w-8 text-slate-300" />
                      <span className="font-semibold text-slate-700">No Transactions Recorded Yet</span>
                      <span className="text-slate-400 text-[11px] max-w-sm">
                        Invoices, payments, dispensary sales, and refunds created in the system will appear here in real-time.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => (
                  <tr key={tx.reference} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-5 font-mono font-semibold text-slate-700">
                      {tx.reference}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{tx.patientName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.transactionType === 'Invoice'
                            ? 'bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db]'
                            : tx.transactionType === 'Payment'
                            ? 'bg-emerald-50 text-emerald-800'
                            : tx.transactionType === 'Pharmacy Sale'
                            ? 'bg-[#effaf5] text-[#129b70]'
                            : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                      {formatPKR(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          tx.paymentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tx.paymentStatus === 'Partially Paid'
                            ? 'bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db]'
                            : tx.paymentStatus === 'Refunded'
                            ? 'bg-slate-100 text-slate-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {tx.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{tx.user}</div>
                      <div className="text-[10px] text-slate-400">{tx.userRole}</div>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                      {tx.timestamp}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          MODAL: ATTENTION REQUIRED INSPECTION
      ========================================================================= */}
      {activeAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    activeAlertModal.severity === 'Critical'
                      ? 'bg-rose-100 text-rose-800'
                      : activeAlertModal.severity === 'Warning'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db]'
                  }`}
                >
                  {activeAlertModal.severity}
                </span>
                <h3 className="text-sm font-bold text-slate-900">Alert Audit Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveAlertModal(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Alert Title</span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">{activeAlertModal.title}</h4>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Metric in Scope
                </span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {activeAlertModal.relevantMetric}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Executive Assessment & Brief
                </span>
                <p className="text-slate-700 leading-relaxed mt-1 bg-white p-3 rounded border border-slate-200">
                  {activeAlertModal.detailedMessage || activeAlertModal.description}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveAlertModal(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
                >
                  Close
                </button>
                {activeAlertModal.navModule && (
                  <button
                    type="button"
                    onClick={() => {
                      const mod = activeAlertModal.navModule;
                      setActiveAlertModal(null);
                      if (mod) onNavigateToModule?.(mod);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#129b70] hover:bg-[#0e7d5a] text-white font-semibold flex items-center gap-1.5"
                  >
                    <span>{activeAlertModal.actionLabel}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
