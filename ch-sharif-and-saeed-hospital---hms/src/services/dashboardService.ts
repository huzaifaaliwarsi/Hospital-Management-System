import apiClient from './apiClient';
import type {
  DateFilterPreset,
  KPICardItem,
  PatientFlowItem,
  WardOccupancySummary,
  BillingSummaryData,
  PaymentMethodBreakdownItem,
  PharmacySummaryData,
  InventoryAlertSummaryData,
  CorporatePanelSummaryData,
  DepartmentActivityItem,
  AttentionAlertItem,
  UserActivityItem,
  RecentTransactionItem,
  RevenueChartPoint,
} from '../features/dashboard/superAdminDashboardData';

export interface SuperAdminDashboardResponse {
  period: {
    preset: string;
    startDate: string;
    endDate: string;
    label: string;
  };
  infrastructure: {
    activeDepartmentsCount: number;
    totalStaffCount: number;
    doctorsCount: number;
    activePanelsCount: number;
    activePanelPatientsCount: number;
    activeAdminsCount: number;
  };
  bedMetrics: {
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyPercent: number;
    totalWards: number;
    totalRooms: number;
    wards: WardOccupancySummary[];
  };
  billingSummary: BillingSummaryData;
  revenueChannels: {
    cash: number;
    onlineBank: number;
    panelCorporate: number;
    outstanding: number;
  };
  paymentMethods: PaymentMethodBreakdownItem[];
  patientFlow: PatientFlowItem[];
  inventorySummary: InventoryAlertSummaryData & {
    flaggedItems?: Array<{
      id: string;
      name: string;
      unit: string;
      currentStock: number;
      reorderLevel: number;
      status: 'OUT_OF_STOCK' | 'LOW_STOCK';
    }>;
  };
  pharmacySummary: PharmacySummaryData;
  corporatePanels: CorporatePanelSummaryData;
  departmentActivity: DepartmentActivityItem[];
  doctorsOnDuty?: DoctorOnDutyItem[];
  attentionAlerts: AttentionAlertItem[];
  recentActivity: UserActivityItem[];
  recentTransactions: RecentTransactionItem[];
  kpis: KPICardItem[];
}

export interface DoctorOnDutyItem {
  id: string;
  name: string;
  department: string;
  designation: string;
  shiftLabel: string;
  patientsBooked: number;
  status: 'On Duty' | 'On Roster';
}

export interface FlaggedStockItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK';
}

export interface ResolvedDashboardState {
  periodLabel: string;
  infrastructure: {
    activeDepartmentsCount: number;
    totalStaffCount: number;
    doctorsCount: number;
    activePanelsCount: number;
    activePanelPatientsCount: number;
    activeAdminsCount: number;
  };
  kpis: KPICardItem[];
  patientFlow: PatientFlowItem[];
  patientHourlyTrend: Array<{ hour: string; opd: number; emergency: number; total: number }>;
  billingSummary: BillingSummaryData;
  revenueChart: RevenueChartPoint[];
  revenueChannels: {
    cash: number;
    onlineBank: number;
    panelCorporate: number;
    outstanding: number;
  };
  paymentMethods: PaymentMethodBreakdownItem[];
  departmentActivity: DepartmentActivityItem[];
  doctorsOnDuty: DoctorOnDutyItem[];
  pharmacySummary: PharmacySummaryData;
  expenses: {
    todayAmount: number;
    monthAmount: number;
    topCategories: Array<{ category: string; amount: number; percentage: number; allocatedBudget: number }>;
  };
  corporatePanels: CorporatePanelSummaryData;
  bedMetrics: {
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyPercent: number;
    totalWards: number;
    totalRooms: number;
    wards: WardOccupancySummary[];
  };
  inventorySummary: InventoryAlertSummaryData;
  flaggedStockItems: FlaggedStockItem[];
  attentionAlerts: AttentionAlertItem[];
  recentActivity: UserActivityItem[];
  recentTransactions: RecentTransactionItem[];
}

// In-memory cache for fast tab-switching
let cachedDashboard: ResolvedDashboardState | null = null;

function generateHourlyTrend(totalPatients: number) {
  const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
  if (totalPatients === 0) {
    return hours.map((hour) => ({ hour, opd: 0, emergency: 0, total: 0 }));
  }
  // Distribute across hours
  const perHour = Math.floor(totalPatients / hours.length);
  return hours.map((hour, idx) => {
    const opd = idx === 1 || idx === 2 ? perHour + 2 : Math.max(0, perHour);
    const emergency = Math.max(0, Math.floor(opd * 0.2));
    return { hour, opd, emergency, total: opd + emergency };
  });
}

function generateRevenueChart(billing: number, collections: number) {
  const points = ['Morning Shift', 'Afternoon Shift', 'Evening Shift', 'Night / Overtime'];
  if (billing === 0 && collections === 0) {
    return points.map((label) => ({ label, billing: 0, collections: 0 }));
  }
  return [
    { label: 'Morning Shift', billing: Math.round(billing * 0.45), collections: Math.round(collections * 0.5) },
    { label: 'Afternoon Shift', billing: Math.round(billing * 0.35), collections: Math.round(collections * 0.3) },
    { label: 'Evening Shift', billing: Math.round(billing * 0.15), collections: Math.round(collections * 0.15) },
    { label: 'Night / Overtime', billing: Math.round(billing * 0.05), collections: Math.round(collections * 0.05) },
  ];
}

export const dashboardService = {
  async fetchSuperAdminDashboard(
    preset: DateFilterPreset = 'today',
    fromDate?: string,
    toDate?: string,
  ): Promise<ResolvedDashboardState> {
    const params: Record<string, string> = { preset };
    if (preset === 'custom' && fromDate && toDate) {
      params.fromDate = fromDate;
      params.toDate = toDate;
    }

    const res = await apiClient.get<{ data: SuperAdminDashboardResponse }>('/reports/dashboard/super-admin', {
      params,
    });

    const d = res.data.data;

    const totalPatients = (d.patientFlow || []).reduce((acc, f) => acc + (f.total || 0), 0);

    const resolved: ResolvedDashboardState = {
      periodLabel: d.period?.label || 'Today',
      infrastructure: d.infrastructure || {
        activeDepartmentsCount: 0,
        totalStaffCount: 0,
        doctorsCount: 0,
        activePanelsCount: 0,
        activePanelPatientsCount: 0,
        activeAdminsCount: 0,
      },
      kpis: d.kpis || [],
      patientFlow: d.patientFlow || [],
      patientHourlyTrend: generateHourlyTrend(totalPatients),
      billingSummary: d.billingSummary || {
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
      revenueChart: generateRevenueChart(d.billingSummary?.netBilling || 0, d.billingSummary?.paidAmount || 0),
      revenueChannels: d.revenueChannels || { cash: 0, onlineBank: 0, panelCorporate: 0, outstanding: 0 },
      paymentMethods: d.paymentMethods || [],
      departmentActivity: d.departmentActivity || [],
      doctorsOnDuty: d.doctorsOnDuty || [],
      pharmacySummary: d.pharmacySummary || {
        salesAmount: 0,
        invoicesCount: 0,
        medicinesDispensedCount: 0,
        pendingRequestsCount: 0,
        returnsCount: 0,
        returnsAmount: 0,
        nearExpiryAlertsCount: 0,
      },
      expenses: {
        todayAmount: 0,
        monthAmount: 0,
        topCategories: [],
      },
      corporatePanels: d.corporatePanels || {
        activePanelsCount: 0,
        panelPatientsCount: 0,
        panelBillingAmount: 0,
        panelOutstandingAmount: 0,
        topPanels: [],
      },
      bedMetrics: d.bedMetrics || {
        totalBeds: 0,
        occupiedBeds: 0,
        availableBeds: 0,
        occupancyPercent: 0,
        totalWards: 0,
        totalRooms: 0,
        wards: [],
      },
      inventorySummary: {
        lowStockItemsCount: d.inventorySummary?.lowStockItemsCount ?? 0,
        outOfStockItemsCount: d.inventorySummary?.outOfStockItemsCount ?? 0,
        nearExpiryItemsCount: (d.inventorySummary as any)?.nearExpiryItemsCount ?? 0,
        expiredItemsCount: (d.inventorySummary as any)?.expiredItemsCount ?? 0,
        pendingStockRequestsCount: d.inventorySummary?.pendingStockRequestsCount ?? 0,
      },
      flaggedStockItems: d.inventorySummary?.flaggedItems || [],
      attentionAlerts: (d.attentionAlerts || []).map((a: any) => ({
        id: a.id,
        severity: (a.severity === 'critical' || a.severity === 'Critical')
          ? 'Critical'
          : (a.severity === 'warning' || a.severity === 'Warning')
          ? 'Warning'
          : 'Info',
        title: a.title,
        description: a.description,
        relevantMetric: a.relevantMetric || a.metric || '',
        actionLabel: a.actionLabel || 'View Details',
        navModule: a.navModule,
      })),
      recentActivity: d.recentActivity || [],
      recentTransactions: d.recentTransactions || [],
    };

    cachedDashboard = resolved;
    return resolved;
  },

  getCachedDashboard(): ResolvedDashboardState | null {
    return cachedDashboard;
  },
};
