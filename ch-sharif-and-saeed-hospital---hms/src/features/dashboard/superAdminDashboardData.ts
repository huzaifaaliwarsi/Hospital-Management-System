import {
  getDynamicPeriodLabel,
  formatDisplayDate,
  getHospitalCurrentDate,
} from '../../utils/dateConstants';

export type DateFilterPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export interface KPICardItem {
  id: string;
  title: string;
  value: string;
  numericValue: number;
  iconName: string;
  contextText: string;
  changeText?: string;
  isPositive?: boolean;
  colorClass: string;
  accentBg: string;
  navModule?: string;
}

export interface PatientFlowItem {
  category: 'OPD' | 'Observation' | 'Emergency' | 'Admission';
  total: number;
  waiting: number;
  completed: number;
  active: number;
  peakHour: string;
  accentColor: string;
}

export interface RevenueChartPoint {
  label: string;
  billing: number;
  collections: number;
}

export interface DepartmentActivityItem {
  id: string;
  name: string;
  type: string;
  patients: number;
  billing: number;
  status: 'Normal Flow' | 'High Volume' | 'Surge' | 'Optimal';
  statusColor: string;
}

export interface WardOccupancySummary {
  wardName: string;
  type: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyPercent: number;
  ventilatorsInUse?: number;
}

export interface BillingSummaryData {
  totalInvoices: number;
  grossBilling: number;
  discounts: number;
  netBilling: number;
  paidAmount: number;
  partiallyPaidAmount: number;
  partiallyPaidInvoicesCount: number;
  outstandingAmount: number;
  refundsAmount: number;
}

export interface PaymentMethodBreakdownItem {
  method: string;
  amount: number;
  percentage: number;
  icon: string;
}

export interface PharmacySummaryData {
  salesAmount: number;
  invoicesCount: number;
  medicinesDispensedCount: number;
  pendingRequestsCount: number;
  returnsCount: number;
  returnsAmount: number;
  nearExpiryAlertsCount: number;
}

export interface InventoryAlertSummaryData {
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  nearExpiryItemsCount: number;
  expiredItemsCount: number;
  pendingStockRequestsCount: number;
}

export interface ExpenseCategoryItem {
  category: string;
  amount: number;
  percentage: number;
  allocatedBudget: number;
}

export interface CorporatePanelSummaryData {
  activePanelsCount: number;
  panelPatientsCount: number;
  panelBillingAmount: number;
  panelOutstandingAmount: number;
  topPanels: { name: string; patients: number; billing: number }[];
}

export interface UserActivityItem {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  module: string;
  reference: string;
}

export interface AttentionAlertItem {
  id: string;
  severity: 'Critical' | 'Warning' | 'Info';
  title: string;
  description: string;
  relevantMetric: string;
  actionLabel: string;
  navModule?: string;
  detailedMessage?: string;
}

export interface RecentTransactionItem {
  reference: string;
  patientName: string;
  transactionType: 'Invoice' | 'Payment' | 'Refund' | 'Pharmacy Sale';
  amount: number;
  paymentStatus: 'Paid' | 'Partially Paid' | 'Refunded' | 'Pending Settlement';
  user: string;
  userRole: string;
  timestamp: string;
}

export interface DashboardPeriodDataset {
  periodLabel: string;
  kpis: KPICardItem[];
  patientFlow: PatientFlowItem[];
  patientHourlyTrend: { time: string; opd: number; emergency: number; observation: number; admitted: number }[];
  revenueChart: RevenueChartPoint[];
  revenueChannels: {
    cash: number;
    onlineBank: number;
    panelCorporate: number;
    outstanding: number;
  };
  departmentActivity: DepartmentActivityItem[];
  billingSummary: BillingSummaryData;
  paymentMethods: PaymentMethodBreakdownItem[];
  pharmacySummary: PharmacySummaryData;
  expenses: {
    todayAmount: number;
    monthAmount: number;
    topCategories: ExpenseCategoryItem[];
  };
  corporatePanels: CorporatePanelSummaryData;
}

// CURRENT STATE INFRASTRUCTURE (Beds & Inventory Alerts per Section 18)
export const CURRENT_STATE_BED_METRICS = {
  totalBeds: 250,
  occupiedBeds: 189,
  availableBeds: 61,
  occupancyPercent: 75.6,
  wards: [
    {
      wardName: 'NICU (Neonatal ICU)',
      type: 'Intensive Care',
      totalBeds: 20,
      occupiedBeds: 17,
      availableBeds: 3,
      occupancyPercent: 85.0,
      ventilatorsInUse: 8,
    },
    {
      wardName: 'PICU (Pediatric ICU)',
      type: 'Intensive Care',
      totalBeds: 16,
      occupiedBeds: 13,
      availableBeds: 3,
      occupancyPercent: 81.3,
      ventilatorsInUse: 5,
    },
    {
      wardName: 'PEDS Ward',
      type: 'Inpatient Specialty',
      totalBeds: 34,
      occupiedBeds: 26,
      availableBeds: 8,
      occupancyPercent: 76.5,
    },
    {
      wardName: 'Private Ward & Suites',
      type: 'Private Inpatient',
      totalBeds: 40,
      occupiedBeds: 32,
      availableBeds: 8,
      occupancyPercent: 80.0,
    },
    {
      wardName: 'Semi-Private Ward',
      type: 'Stepdown Inpatient',
      totalBeds: 50,
      occupiedBeds: 38,
      availableBeds: 12,
      occupancyPercent: 76.0,
    },
    {
      wardName: 'General Medical & Surgical Ward',
      type: 'General Inpatient',
      totalBeds: 90,
      occupiedBeds: 63,
      availableBeds: 27,
      occupancyPercent: 70.0,
    },
  ] as WardOccupancySummary[],
};

export const CURRENT_STATE_INVENTORY_ALERTS: InventoryAlertSummaryData = {
  lowStockItemsCount: 8,
  outOfStockItemsCount: 3,
  nearExpiryItemsCount: 14,
  expiredItemsCount: 2,
  pendingStockRequestsCount: 6,
};

// DATASETS PER TIME PERIOD
export const PERIOD_DATASETS: Record<DateFilterPreset, DashboardPeriodDataset> = {
  today: {
    periodLabel: getDynamicPeriodLabel('today'),
    kpis: [
      {
        id: 'kpi_today_patients',
        title: "Today's Patients",
        value: '284',
        numericValue: 284,
        iconName: 'Users',
        contextText: 'across all clinical areas',
        changeText: '+12.4% vs yesterday',
        isPositive: true,
        colorClass: 'text-[#0e7d5a]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
        navModule: 'patient_reports',
      },
      {
        id: 'kpi_opd_visits',
        title: 'OPD Visits',
        value: '196',
        numericValue: 196,
        iconName: 'Stethoscope',
        contextText: '16 consultant clinics active',
        changeText: '+8.2%',
        isPositive: true,
        colorClass: 'text-[#129b70]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
        navModule: 'patient_reports',
      },
      {
        id: 'kpi_observation_patients',
        title: 'Observation Patients',
        value: '34',
        numericValue: 34,
        iconName: 'Clock',
        contextText: 'under 6-hour clinical monitoring',
        changeText: '4 ready for discharge',
        isPositive: true,
        colorClass: 'text-[#0e7d5a]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_emergency_visits',
        title: 'Emergency Visits',
        value: '54',
        numericValue: 54,
        iconName: 'Activity',
        contextText: '8 triaged as Red / Resus',
        changeText: '+6 cases',
        isPositive: false,
        colorClass: 'text-rose-700',
        accentBg: 'bg-rose-50 border-rose-200',
      },
      {
        id: 'kpi_current_admissions',
        title: 'Current Admissions',
        value: '189',
        numericValue: 189,
        iconName: 'Bed',
        contextText: 'inpatient ward beds active',
        changeText: 'Current census',
        isPositive: true,
        colorClass: 'text-[#0e7d5a]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
        navModule: 'wards_rooms_beds',
      },
      {
        id: 'kpi_bed_occupancy',
        title: 'Bed Occupancy',
        value: '75.6%',
        numericValue: 75.6,
        iconName: 'Layers',
        contextText: '189 of 250 total beds',
        changeText: '61 available beds',
        isPositive: true,
        colorClass: 'text-[#129b70]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
        navModule: 'wards_rooms_beds',
      },
      {
        id: 'kpi_today_billing',
        title: "Today's Billing",
        value: 'PKR 1,485,000',
        numericValue: 1485000,
        iconName: 'Receipt',
        contextText: '246 invoices finalized',
        changeText: '+14.2% revenue pace',
        isPositive: true,
        colorClass: 'text-[#0e7d5a]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
        navModule: 'billing_reports',
      },
      {
        id: 'kpi_today_collections',
        title: "Today's Collections",
        value: 'PKR 1,260,000',
        numericValue: 1260000,
        iconName: 'CreditCard',
        contextText: '84.8% collection efficiency',
        changeText: 'Realized at cashiers',
        isPositive: true,
        colorClass: 'text-[#0e7d5a]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
        navModule: 'collection_reports',
      },
      {
        id: 'kpi_outstanding_balance',
        title: 'Outstanding Balance',
        value: 'PKR 225,000',
        numericValue: 225000,
        iconName: 'AlertCircle',
        contextText: 'corporate claims & self-pay dues',
        changeText: '15.2% uncollected',
        isPositive: false,
        colorClass: 'text-amber-700',
        accentBg: 'bg-amber-50 border-amber-200',
      },
      {
        id: 'kpi_pharmacy_sales',
        title: 'Pharmacy Sales',
        value: 'PKR 342,800',
        numericValue: 342800,
        iconName: 'Pill',
        contextText: '184 dispenses executed',
        changeText: '+9.1%',
        isPositive: true,
        colorClass: 'text-[#0e7d5a]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
        navModule: 'pharmacy_reports',
      },
      {
        id: 'kpi_today_expenses',
        title: "Today's Expenses",
        value: 'PKR 412,500',
        numericValue: 412500,
        iconName: 'DollarSign',
        contextText: 'consumables, gases & staffing',
        changeText: 'Within budget cap',
        isPositive: true,
        colorClass: 'text-slate-700',
        accentBg: 'bg-slate-100 border-slate-200',
      },
      {
        id: 'kpi_low_stock_alerts',
        title: 'Low Stock Alerts',
        value: '8 Items',
        numericValue: 8,
        iconName: 'Package',
        contextText: '3 out of stock in central store',
        changeText: 'Re-order needed',
        isPositive: false,
        colorClass: 'text-rose-700',
        accentBg: 'bg-rose-50 border-rose-200',
        navModule: 'inventory_reports',
      },
    ],
    patientFlow: [
      {
        category: 'OPD',
        total: 196,
        waiting: 28,
        completed: 148,
        active: 20,
        peakHour: '11:00 AM',
        accentColor: '#129b70',
      },
      {
        category: 'Observation',
        total: 34,
        waiting: 6,
        completed: 18,
        active: 10,
        peakHour: '02:30 PM',
        accentColor: '#0e7d5a',
      },
      {
        category: 'Emergency',
        total: 54,
        waiting: 4,
        completed: 38,
        active: 12,
        peakHour: '01:00 PM',
        accentColor: '#e11d48',
      },
      {
        category: 'Admission',
        total: 31,
        waiting: 5,
        completed: 14, // discharged today
        active: 12,
        peakHour: '12:00 PM',
        accentColor: '#14b885',
      },
    ],
    patientHourlyTrend: [
      { time: '08:00', opd: 22, emergency: 6, observation: 4, admitted: 3 },
      { time: '09:00', opd: 38, emergency: 8, observation: 6, admitted: 4 },
      { time: '10:00', opd: 52, emergency: 9, observation: 8, admitted: 5 },
      { time: '11:00', opd: 68, emergency: 12, observation: 10, admitted: 6 },
      { time: '12:00', opd: 58, emergency: 14, observation: 9, admitted: 7 },
      { time: '13:00', opd: 42, emergency: 11, observation: 7, admitted: 4 },
      { time: '14:00', opd: 36, emergency: 8, observation: 6, admitted: 3 },
      { time: '15:00', opd: 28, emergency: 7, observation: 5, admitted: 2 },
    ],
    revenueChart: [
      { label: '08:00 - 10:00', billing: 280000, collections: 245000 },
      { label: '10:00 - 12:00', billing: 540000, collections: 460000 },
      { label: '12:00 - 14:00', billing: 390000, collections: 335000 },
      { label: '14:00 - 16:00', billing: 275000, collections: 220000 },
    ],
    revenueChannels: {
      cash: 680000,
      onlineBank: 295000,
      panelCorporate: 285000,
      outstanding: 225000,
    },
    departmentActivity: [
      {
        id: 'DEP-CARDIO',
        name: 'Cardiology & Cath Lab',
        type: 'Clinical / Interventional',
        patients: 46,
        billing: 485000,
        status: 'High Volume',
        statusColor: 'bg-amber-50 text-amber-800 border-amber-200',
      },
      {
        id: 'DEP-ORTHO',
        name: 'Orthopedics & Trauma',
        type: 'Surgical / Clinical',
        patients: 38,
        billing: 310000,
        status: 'Normal Flow',
        statusColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      },
      {
        id: 'DEP-PEDS',
        name: 'Pediatrics & Neonatology',
        type: 'Specialized Care',
        patients: 42,
        billing: 195000,
        status: 'Normal Flow',
        statusColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      },
      {
        id: 'DEP-MED',
        name: 'General Medicine & Pulmonology',
        type: 'Clinical',
        patients: 54,
        billing: 175000,
        status: 'Surge',
        statusColor: 'bg-rose-50 text-rose-800 border-rose-200',
      },
      {
        id: 'DEP-SURG',
        name: 'General & Laparoscopic Surgery',
        type: 'Surgical',
        patients: 22,
        billing: 390000,
        status: 'Optimal',
        statusColor: 'bg-[#effaf5] text-[#08775A] border-[#c2e7db]',
      },
      {
        id: 'DEP-OBGYN',
        name: 'Obstetrics & Gynecology',
        type: 'Clinical / Maternal',
        patients: 34,
        billing: 220000,
        status: 'Normal Flow',
        statusColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      },
      {
        id: 'DEP-ER',
        name: 'Emergency & Critical Care',
        type: '24/7 Emergency',
        patients: 54,
        billing: 185000,
        status: 'High Volume',
        statusColor: 'bg-amber-50 text-amber-800 border-amber-200',
      },
      {
        id: 'DEP-RAD',
        name: 'Radiology & Diagnostic Imaging',
        type: 'Diagnostic',
        patients: 68,
        billing: 245000,
        status: 'Normal Flow',
        statusColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      },
    ],
    billingSummary: {
      totalInvoices: 246,
      grossBilling: 1620000,
      discounts: 135000,
      netBilling: 1485000,
      paidAmount: 1260000,
      partiallyPaidAmount: 140000,
      partiallyPaidInvoicesCount: 12,
      outstandingAmount: 225000,
      refundsAmount: 18500,
    },
    paymentMethods: [
      { method: 'Cash', amount: 680000, percentage: 54.0, icon: 'Banknote' },
      { method: 'Card (Debit / Credit)', amount: 295000, percentage: 23.4, icon: 'CreditCard' },
      { method: 'Bank / Online Transfer', amount: 160000, percentage: 12.7, icon: 'Building' },
      { method: 'Panel / Corporate Credit', amount: 125000, percentage: 9.9, icon: 'Shield' },
    ],
    pharmacySummary: {
      salesAmount: 342800,
      invoicesCount: 184,
      medicinesDispensedCount: 612,
      pendingRequestsCount: 8,
      returnsCount: 3,
      returnsAmount: 4850,
      nearExpiryAlertsCount: 14,
    },
    expenses: {
      todayAmount: 412500,
      monthAmount: 8420000,
      topCategories: [
        { category: 'Medicines & Clinical Consumables', amount: 185000, percentage: 44.8, allocatedBudget: 250000 },
        { category: 'Biomedical Gases & Liquid Oxygen', amount: 82000, percentage: 19.9, allocatedBudget: 100000 },
        { category: 'Staff Operational Shifts & Nursing', amount: 75000, percentage: 18.2, allocatedBudget: 90000 },
        { category: 'Laboratory Reagents & Diagnostics', amount: 48000, percentage: 11.6, allocatedBudget: 60000 },
        { category: 'Facility Sterilization & Housekeeping', amount: 22500, percentage: 5.5, allocatedBudget: 35000 },
      ],
    },
    corporatePanels: {
      activePanelsCount: 14,
      panelPatientsCount: 42,
      panelBillingAmount: 385000,
      panelOutstandingAmount: 1450000,
      topPanels: [
        { name: 'State Life Insurance (National Health Card)', patients: 18, billing: 172000 },
        { name: 'EFU General Insurance Ltd.', patients: 9, billing: 94000 },
        { name: 'Jubilee Life Health Insurance', patients: 8, billing: 68000 },
        { name: 'Pak-Qatar Family Takaful', patients: 7, billing: 51000 },
      ],
    },
  },

  yesterday: {
    periodLabel: getDynamicPeriodLabel('yesterday'),
    kpis: [
      {
        id: 'kpi_today_patients',
        title: "Yesterday's Patients",
        value: '268',
        numericValue: 268,
        iconName: 'Users',
        contextText: 'across all clinical areas',
        changeText: '-5.6% vs avg',
        isPositive: false,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_opd_visits',
        title: 'OPD Visits',
        value: '182',
        numericValue: 182,
        iconName: 'Stethoscope',
        contextText: '15 consultant clinics active',
        changeText: '-3.1%',
        isPositive: false,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#dff5ea] border-[#c2e7db]',
      },
      {
        id: 'kpi_observation_patients',
        title: 'Observation Patients',
        value: '31',
        numericValue: 31,
        iconName: 'Clock',
        contextText: 'managed under 6-hr protocol',
        changeText: 'All cleared',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_emergency_visits',
        title: 'Emergency Visits',
        value: '48',
        numericValue: 48,
        iconName: 'Activity',
        contextText: '5 triaged as Red',
        changeText: 'Standard load',
        isPositive: true,
        colorClass: 'text-rose-700',
        accentBg: 'bg-rose-50 border-rose-200',
      },
      {
        id: 'kpi_current_admissions',
        title: 'Current Admissions',
        value: '189',
        numericValue: 189,
        iconName: 'Bed',
        contextText: 'current inpatient census',
        changeText: 'Current-state',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_bed_occupancy',
        title: 'Bed Occupancy',
        value: '75.6%',
        numericValue: 75.6,
        iconName: 'Layers',
        contextText: '189 of 250 total beds',
        changeText: '61 available beds',
        isPositive: true,
        colorClass: 'text-teal-700',
        accentBg: 'bg-teal-50 border-teal-200',
      },
      {
        id: 'kpi_today_billing',
        title: "Yesterday's Billing",
        value: 'PKR 1,320,000',
        numericValue: 1320000,
        iconName: 'Receipt',
        contextText: '228 invoices processed',
        changeText: 'Closed day total',
        isPositive: true,
        colorClass: 'text-emerald-700',
        accentBg: 'bg-emerald-50 border-emerald-200',
      },
      {
        id: 'kpi_today_collections',
        title: "Yesterday's Collections",
        value: 'PKR 1,180,000',
        numericValue: 1180000,
        iconName: 'CreditCard',
        contextText: '89.4% collection rate',
        changeText: 'Reconciled',
        isPositive: true,
        colorClass: 'text-emerald-800',
        accentBg: 'bg-emerald-50 border-emerald-200',
      },
      {
        id: 'kpi_outstanding_balance',
        title: 'Outstanding Balance',
        value: 'PKR 140,000',
        numericValue: 140000,
        iconName: 'AlertCircle',
        contextText: 'pending panel approvals',
        changeText: '10.6% carried forward',
        isPositive: false,
        colorClass: 'text-amber-700',
        accentBg: 'bg-amber-50 border-amber-200',
      },
      {
        id: 'kpi_pharmacy_sales',
        title: 'Pharmacy Sales',
        value: 'PKR 315,400',
        numericValue: 315400,
        iconName: 'Pill',
        contextText: '172 dispenses',
        changeText: 'Audit verified',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#dff5ea] border-[#c2e7db]',
      },
      {
        id: 'kpi_today_expenses',
        title: "Yesterday's Expenses",
        value: 'PKR 385,000',
        numericValue: 385000,
        iconName: 'DollarSign',
        contextText: 'operational expenses posted',
        changeText: 'Settled',
        isPositive: true,
        colorClass: 'text-slate-700',
        accentBg: 'bg-slate-100 border-slate-200',
      },
      {
        id: 'kpi_low_stock_alerts',
        title: 'Low Stock Alerts',
        value: '8 Items',
        numericValue: 8,
        iconName: 'Package',
        contextText: 'current inventory alerts',
        changeText: 'Immediate attention',
        isPositive: false,
        colorClass: 'text-rose-700',
        accentBg: 'bg-rose-50 border-rose-200',
      },
    ],
    patientFlow: [
      { category: 'OPD', total: 182, waiting: 0, completed: 182, active: 0, peakHour: '11:30 AM', accentColor: '#129b70' },
      { category: 'Observation', total: 31, waiting: 0, completed: 31, active: 0, peakHour: '03:00 PM', accentColor: '#0e7d5a' },
      { category: 'Emergency', total: 48, waiting: 0, completed: 48, active: 0, peakHour: '08:00 PM', accentColor: '#e11d48' },
      { category: 'Admission', total: 26, waiting: 0, completed: 18, active: 8, peakHour: '01:00 PM', accentColor: '#14b885' },
    ],
    patientHourlyTrend: [
      { time: '08:00', opd: 20, emergency: 5, observation: 3, admitted: 2 },
      { time: '10:00', opd: 48, emergency: 8, observation: 7, admitted: 4 },
      { time: '12:00', opd: 55, emergency: 12, observation: 9, admitted: 6 },
      { time: '14:00', opd: 34, emergency: 9, observation: 6, admitted: 3 },
      { time: '16:00', opd: 25, emergency: 14, observation: 6, admitted: 3 },
    ],
    revenueChart: [
      { label: 'Morning Shift', billing: 620000, collections: 560000 },
      { label: 'Evening Shift', billing: 480000, collections: 430000 },
      { label: 'Night Shift', billing: 220000, collections: 190000 },
    ],
    revenueChannels: {
      cash: 620000,
      onlineBank: 280000,
      panelCorporate: 280000,
      outstanding: 140000,
    },
    departmentActivity: [
      { id: 'DEP-CARDIO', name: 'Cardiology & Cath Lab', type: 'Clinical', patients: 42, billing: 420000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-ORTHO', name: 'Orthopedics & Trauma', type: 'Surgical', patients: 35, billing: 290000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-PEDS', name: 'Pediatrics & Neonatology', type: 'Specialized', patients: 38, billing: 170000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-MED', name: 'General Medicine & Pulmonology', type: 'Clinical', patients: 51, billing: 160000, status: 'High Volume', statusColor: 'bg-amber-50 text-amber-800' },
      { id: 'DEP-SURG', name: 'General Surgery', type: 'Surgical', patients: 20, billing: 340000, status: 'Optimal', statusColor: 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]' },
      { id: 'DEP-OBGYN', name: 'Obstetrics & Gynecology', type: 'Maternal', patients: 31, billing: 200000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-ER', name: 'Emergency & Critical Care', type: 'Emergency', patients: 48, billing: 165000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-RAD', name: 'Radiology & Imaging', type: 'Diagnostic', patients: 62, billing: 225000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
    ],
    billingSummary: {
      totalInvoices: 228,
      grossBilling: 1440000,
      discounts: 120000,
      netBilling: 1320000,
      paidAmount: 1180000,
      partiallyPaidAmount: 110000,
      partiallyPaidInvoicesCount: 9,
      outstandingAmount: 140000,
      refundsAmount: 12000,
    },
    paymentMethods: [
      { method: 'Cash', amount: 620000, percentage: 52.5, icon: 'Banknote' },
      { method: 'Card (Debit / Credit)', amount: 280000, percentage: 23.7, icon: 'CreditCard' },
      { method: 'Bank / Online Transfer', amount: 160000, percentage: 13.6, icon: 'Building' },
      { method: 'Panel / Corporate Credit', amount: 120000, percentage: 10.2, icon: 'Shield' },
    ],
    pharmacySummary: {
      salesAmount: 315400,
      invoicesCount: 172,
      medicinesDispensedCount: 580,
      pendingRequestsCount: 0,
      returnsCount: 2,
      returnsAmount: 3400,
      nearExpiryAlertsCount: 14,
    },
    expenses: {
      todayAmount: 385000,
      monthAmount: 8420000,
      topCategories: [
        { category: 'Medicines & Clinical Consumables', amount: 170000, percentage: 44.2, allocatedBudget: 250000 },
        { category: 'Biomedical Gases & Liquid Oxygen', amount: 78000, percentage: 20.3, allocatedBudget: 100000 },
        { category: 'Staff Operational Shifts & Nursing', amount: 72000, percentage: 18.7, allocatedBudget: 90000 },
        { category: 'Laboratory Reagents & Diagnostics', amount: 44000, percentage: 11.4, allocatedBudget: 60000 },
        { category: 'Facility Sterilization & Housekeeping', amount: 21000, percentage: 5.4, allocatedBudget: 35000 },
      ],
    },
    corporatePanels: {
      activePanelsCount: 14,
      panelPatientsCount: 38,
      panelBillingAmount: 345000,
      panelOutstandingAmount: 1450000,
      topPanels: [
        { name: 'State Life Insurance (National Health Card)', patients: 16, billing: 154000 },
        { name: 'EFU General Insurance Ltd.', patients: 8, billing: 86000 },
        { name: 'Jubilee Life Health Insurance', patients: 8, billing: 62000 },
        { name: 'Pak-Qatar Family Takaful', patients: 6, billing: 43000 },
      ],
    },
  },

  this_week: {
    periodLabel: getDynamicPeriodLabel('this_week'),
    kpis: [
      {
        id: 'kpi_today_patients',
        title: 'Patients This Week',
        value: '1,942',
        numericValue: 1942,
        iconName: 'Users',
        contextText: '7-day cumulative patient visits',
        changeText: '+11.8% vs last week',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_opd_visits',
        title: 'OPD Visits',
        value: '1,348',
        numericValue: 1348,
        iconName: 'Stethoscope',
        contextText: '69.4% of total outpatient flow',
        changeText: '+9.4%',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#dff5ea] border-[#c2e7db]',
      },
      {
        id: 'kpi_observation_patients',
        title: 'Observation Patients',
        value: '235',
        numericValue: 235,
        iconName: 'Clock',
        contextText: 'average 4.2 hrs stay',
        changeText: '18 admitted',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_emergency_visits',
        title: 'Emergency Visits',
        value: '359',
        numericValue: 359,
        iconName: 'Activity',
        contextText: '52 resuscitations conducted',
        changeText: 'Peak on Sun/Mon',
        isPositive: false,
        colorClass: 'text-rose-700',
        accentBg: 'bg-rose-50 border-rose-200',
      },
      {
        id: 'kpi_current_admissions',
        title: 'Current Admissions',
        value: '189',
        numericValue: 189,
        iconName: 'Bed',
        contextText: 'current active inpatients',
        changeText: 'Current-state',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_bed_occupancy',
        title: 'Bed Occupancy',
        value: '75.6%',
        numericValue: 75.6,
        iconName: 'Layers',
        contextText: '189 of 250 total beds',
        changeText: '61 available beds',
        isPositive: true,
        colorClass: 'text-teal-700',
        accentBg: 'bg-teal-50 border-teal-200',
      },
      {
        id: 'kpi_today_billing',
        title: 'Billing This Week',
        value: 'PKR 10,240,000',
        numericValue: 10240000,
        iconName: 'Receipt',
        contextText: '1,680 invoices issued',
        changeText: '+15.3% weekly pace',
        isPositive: true,
        colorClass: 'text-emerald-700',
        accentBg: 'bg-emerald-50 border-emerald-200',
      },
      {
        id: 'kpi_today_collections',
        title: 'Collections This Week',
        value: 'PKR 8,920,000',
        numericValue: 8920000,
        iconName: 'CreditCard',
        contextText: '87.1% collection efficiency',
        changeText: 'Settled to banks',
        isPositive: true,
        colorClass: 'text-emerald-800',
        accentBg: 'bg-emerald-50 border-emerald-200',
      },
      {
        id: 'kpi_outstanding_balance',
        title: 'Outstanding Balance',
        value: 'PKR 1,320,000',
        numericValue: 1320000,
        iconName: 'AlertCircle',
        contextText: 'corporate & insurance aging',
        changeText: '12.9% pending',
        isPositive: false,
        colorClass: 'text-amber-700',
        accentBg: 'bg-amber-50 border-amber-200',
      },
      {
        id: 'kpi_pharmacy_sales',
        title: 'Pharmacy Sales',
        value: 'PKR 2,410,000',
        numericValue: 2410000,
        iconName: 'Pill',
        contextText: '1,280 prescriptions filled',
        changeText: '+10.2%',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#dff5ea] border-[#c2e7db]',
      },
      {
        id: 'kpi_today_expenses',
        title: 'Expenses This Week',
        value: 'PKR 2,850,000',
        numericValue: 2850000,
        iconName: 'DollarSign',
        contextText: 'clinical & operational costs',
        changeText: 'Approved by CFO',
        isPositive: true,
        colorClass: 'text-slate-700',
        accentBg: 'bg-slate-100 border-slate-200',
      },
      {
        id: 'kpi_low_stock_alerts',
        title: 'Low Stock Alerts',
        value: '8 Items',
        numericValue: 8,
        iconName: 'Package',
        contextText: 'current inventory state',
        changeText: 'Immediate attention',
        isPositive: false,
        colorClass: 'text-rose-700',
        accentBg: 'bg-rose-50 border-rose-200',
      },
    ],
    patientFlow: [
      { category: 'OPD', total: 1348, waiting: 28, completed: 1300, active: 20, peakHour: '11:00 AM', accentColor: '#129b70' },
      { category: 'Observation', total: 235, waiting: 6, completed: 219, active: 10, peakHour: '02:00 PM', accentColor: '#0e7d5a' },
      { category: 'Emergency', total: 359, waiting: 4, completed: 343, active: 12, peakHour: '09:00 PM', accentColor: '#e11d48' },
      { category: 'Admission', total: 142, waiting: 5, completed: 86, active: 51, peakHour: '12:00 PM', accentColor: '#14b885' },
    ],
    patientHourlyTrend: [
      { time: 'Mon', opd: 210, emergency: 55, observation: 35, admitted: 14 },
      { time: 'Tue', opd: 195, emergency: 48, observation: 32, admitted: 12 },
      { time: 'Wed', opd: 205, emergency: 52, observation: 36, admitted: 15 },
      { time: 'Thu', opd: 188, emergency: 49, observation: 30, admitted: 11 },
      { time: 'Fri', opd: 175, emergency: 46, observation: 28, admitted: 10 },
      { time: 'Sat', opd: 179, emergency: 55, observation: 38, admitted: 13 },
      { time: 'Sun', opd: 196, emergency: 54, observation: 36, admitted: 11 },
    ],
    revenueChart: [
      { label: 'Mon', billing: 1480000, collections: 1290000 },
      { label: 'Tue', billing: 1410000, collections: 1240000 },
      { label: 'Wed', billing: 1520000, collections: 1330000 },
      { label: 'Thu', billing: 1380000, collections: 1190000 },
      { label: 'Fri', billing: 1320000, collections: 1150000 },
      { label: 'Sat', billing: 1650000, collections: 1460000 },
      { label: 'Sun', billing: 1480000, collections: 1260000 },
    ],
    revenueChannels: {
      cash: 4820000,
      onlineBank: 2150000,
      panelCorporate: 1950000,
      outstanding: 1320000,
    },
    departmentActivity: [
      { id: 'DEP-CARDIO', name: 'Cardiology & Cath Lab', type: 'Clinical', patients: 310, billing: 3250000, status: 'High Volume', statusColor: 'bg-amber-50 text-amber-800' },
      { id: 'DEP-ORTHO', name: 'Orthopedics & Trauma', type: 'Surgical', patients: 255, billing: 2150000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-PEDS', name: 'Pediatrics & Neonatology', type: 'Specialized', patients: 284, billing: 1350000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-MED', name: 'General Medicine & Pulmonology', type: 'Clinical', patients: 375, billing: 1180000, status: 'Surge', statusColor: 'bg-rose-50 text-rose-800' },
      { id: 'DEP-SURG', name: 'General Surgery', type: 'Surgical', patients: 152, billing: 2650000, status: 'Optimal', statusColor: 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]' },
      { id: 'DEP-OBGYN', name: 'Obstetrics & Gynecology', type: 'Maternal', patients: 238, billing: 1540000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-ER', name: 'Emergency & Critical Care', type: 'Emergency', patients: 359, billing: 1240000, status: 'High Volume', statusColor: 'bg-amber-50 text-amber-800' },
      { id: 'DEP-RAD', name: 'Radiology & Diagnostics', type: 'Diagnostic', patients: 468, billing: 1680000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
    ],
    billingSummary: {
      totalInvoices: 1680,
      grossBilling: 11150000,
      discounts: 910000,
      netBilling: 10240000,
      paidAmount: 8920000,
      partiallyPaidAmount: 960000,
      partiallyPaidInvoicesCount: 64,
      outstandingAmount: 1320000,
      refundsAmount: 124000,
    },
    paymentMethods: [
      { method: 'Cash', amount: 4820000, percentage: 54.0, icon: 'Banknote' },
      { method: 'Card (Debit / Credit)', amount: 2150000, percentage: 24.1, icon: 'CreditCard' },
      { method: 'Bank / Online Transfer', amount: 1120000, percentage: 12.6, icon: 'Building' },
      { method: 'Panel / Corporate Credit', amount: 830000, percentage: 9.3, icon: 'Shield' },
    ],
    pharmacySummary: {
      salesAmount: 2410000,
      invoicesCount: 1280,
      medicinesDispensedCount: 4250,
      pendingRequestsCount: 8,
      returnsCount: 19,
      returnsAmount: 32500,
      nearExpiryAlertsCount: 14,
    },
    expenses: {
      todayAmount: 412500,
      monthAmount: 8420000,
      topCategories: [
        { category: 'Medicines & Clinical Consumables', amount: 1280000, percentage: 44.9, allocatedBudget: 1750000 },
        { category: 'Biomedical Gases & Liquid Oxygen', amount: 560000, percentage: 19.6, allocatedBudget: 700000 },
        { category: 'Staff Operational Shifts & Nursing', amount: 510000, percentage: 17.9, allocatedBudget: 630000 },
        { category: 'Laboratory Reagents & Diagnostics', amount: 340000, percentage: 11.9, allocatedBudget: 420000 },
        { category: 'Facility Sterilization & Housekeeping', amount: 160000, percentage: 5.6, allocatedBudget: 245000 },
      ],
    },
    corporatePanels: {
      activePanelsCount: 14,
      panelPatientsCount: 284,
      panelBillingAmount: 2680000,
      panelOutstandingAmount: 1450000,
      topPanels: [
        { name: 'State Life Insurance (National Health Card)', patients: 122, billing: 1190000 },
        { name: 'EFU General Insurance Ltd.', patients: 64, billing: 645000 },
        { name: 'Jubilee Life Health Insurance', patients: 56, billing: 485000 },
        { name: 'Pak-Qatar Family Takaful', patients: 42, billing: 360000 },
      ],
    },
  },

  this_month: {
    periodLabel: getDynamicPeriodLabel('this_month'),
    kpis: [
      {
        id: 'kpi_today_patients',
        title: 'Patients This Month',
        value: '8,420',
        numericValue: 8420,
        iconName: 'Users',
        contextText: 'cumulative month-to-date volume',
        changeText: '+14.5% vs prev month',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_opd_visits',
        title: 'OPD Visits',
        value: '5,840',
        numericValue: 5840,
        iconName: 'Stethoscope',
        contextText: 'consultation clinic footfall',
        changeText: '+11.2%',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#dff5ea] border-[#c2e7db]',
      },
      {
        id: 'kpi_observation_patients',
        title: 'Observation Patients',
        value: '1,015',
        numericValue: 1015,
        iconName: 'Clock',
        contextText: 'short-stay admissions',
        changeText: '98% discharged',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_emergency_visits',
        title: 'Emergency Visits',
        value: '1,565',
        numericValue: 1565,
        iconName: 'Activity',
        contextText: '24/7 trauma & resus admissions',
        changeText: '210 critical saves',
        isPositive: true,
        colorClass: 'text-rose-700',
        accentBg: 'bg-rose-50 border-rose-200',
      },
      {
        id: 'kpi_current_admissions',
        title: 'Current Admissions',
        value: '189',
        numericValue: 189,
        iconName: 'Bed',
        contextText: 'current active inpatients',
        changeText: 'Current-state',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_bed_occupancy',
        title: 'Bed Occupancy',
        value: '75.6%',
        numericValue: 75.6,
        iconName: 'Layers',
        contextText: '189 of 250 total beds',
        changeText: '61 available beds',
        isPositive: true,
        colorClass: 'text-teal-700',
        accentBg: 'bg-teal-50 border-teal-200',
      },
      {
        id: 'kpi_today_billing',
        title: 'Billing This Month',
        value: 'PKR 44,550,000',
        numericValue: 44550000,
        iconName: 'Receipt',
        contextText: '7,380 institutional slips',
        changeText: '+16.2% trajectory',
        isPositive: true,
        colorClass: 'text-emerald-700',
        accentBg: 'bg-emerald-50 border-emerald-200',
      },
      {
        id: 'kpi_today_collections',
        title: 'Collections This Month',
        value: 'PKR 38,920,000',
        numericValue: 38920000,
        iconName: 'CreditCard',
        contextText: '87.4% recovery efficiency',
        changeText: 'Verified by Audit',
        isPositive: true,
        colorClass: 'text-emerald-800',
        accentBg: 'bg-emerald-50 border-emerald-200',
      },
      {
        id: 'kpi_outstanding_balance',
        title: 'Outstanding Balance',
        value: 'PKR 5,630,000',
        numericValue: 5630000,
        iconName: 'AlertCircle',
        contextText: 'corporate insurance & panel aging',
        changeText: '12.6% portfolio',
        isPositive: false,
        colorClass: 'text-amber-700',
        accentBg: 'bg-amber-50 border-amber-200',
      },
      {
        id: 'kpi_pharmacy_sales',
        title: 'Pharmacy Sales',
        value: 'PKR 10,280,000',
        numericValue: 10280000,
        iconName: 'Pill',
        contextText: '5,520 dispensed bills',
        changeText: '+12.4%',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#dff5ea] border-[#c2e7db]',
      },
      {
        id: 'kpi_today_expenses',
        title: 'Expenses This Month',
        value: 'PKR 8,420,000',
        numericValue: 8420000,
        iconName: 'DollarSign',
        contextText: 'total operational outflow',
        changeText: 'Operating ratio: 21.6%',
        isPositive: true,
        colorClass: 'text-slate-700',
        accentBg: 'bg-slate-100 border-slate-200',
      },
      {
        id: 'kpi_low_stock_alerts',
        title: 'Low Stock Alerts',
        value: '8 Items',
        numericValue: 8,
        iconName: 'Package',
        contextText: 'current inventory state',
        changeText: 'Immediate attention',
        isPositive: false,
        colorClass: 'text-rose-700',
        accentBg: 'bg-rose-50 border-rose-200',
      },
    ],
    patientFlow: [
      { category: 'OPD', total: 5840, waiting: 28, completed: 5792, active: 20, peakHour: '11:00 AM', accentColor: '#129b70' },
      { category: 'Observation', total: 1015, waiting: 6, completed: 999, active: 10, peakHour: '02:00 PM', accentColor: '#0e7d5a' },
      { category: 'Emergency', total: 1565, waiting: 4, completed: 1549, active: 12, peakHour: '09:00 PM', accentColor: '#e11d48' },
      { category: 'Admission', total: 440, waiting: 5, completed: 375, active: 60, peakHour: '12:00 PM', accentColor: '#14b885' },
    ],
    patientHourlyTrend: [
      { time: 'Week 1', opd: 1420, emergency: 380, observation: 245, admitted: 92 },
      { time: 'Week 2', opd: 1480, emergency: 395, observation: 260, admitted: 96 },
      { time: 'Week 3', opd: 1450, emergency: 390, observation: 250, admitted: 94 },
      { time: 'Week 4', opd: 1490, emergency: 400, observation: 260, admitted: 93 },
    ],
    revenueChart: [
      { label: 'Week 1', billing: 10800000, collections: 9450000 },
      { label: 'Week 2', billing: 11200000, collections: 9800000 },
      { label: 'Week 3', billing: 11100000, collections: 9700000 },
      { label: 'Week 4', billing: 11450000, collections: 9970000 },
    ],
    revenueChannels: {
      cash: 20950000,
      onlineBank: 9350000,
      panelCorporate: 8620000,
      outstanding: 5630000,
    },
    departmentActivity: [
      { id: 'DEP-CARDIO', name: 'Cardiology & Cath Lab', type: 'Clinical', patients: 1350, billing: 14200000, status: 'High Volume', statusColor: 'bg-amber-50 text-amber-800' },
      { id: 'DEP-ORTHO', name: 'Orthopedics & Trauma', type: 'Surgical', patients: 1120, billing: 9400000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-PEDS', name: 'Pediatrics & Neonatology', type: 'Specialized', patients: 1240, billing: 5900000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-MED', name: 'General Medicine & Pulmonology', type: 'Clinical', patients: 1650, billing: 5150000, status: 'Surge', statusColor: 'bg-rose-50 text-rose-800' },
      { id: 'DEP-SURG', name: 'General Surgery', type: 'Surgical', patients: 670, billing: 11600000, status: 'Optimal', statusColor: 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]' },
      { id: 'DEP-OBGYN', name: 'Obstetrics & Gynecology', type: 'Maternal', patients: 1040, billing: 6720000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-ER', name: 'Emergency & Critical Care', type: 'Emergency', patients: 1565, billing: 5420000, status: 'High Volume', statusColor: 'bg-amber-50 text-amber-800' },
      { id: 'DEP-RAD', name: 'Radiology & Diagnostics', type: 'Diagnostic', patients: 2050, billing: 7350000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
    ],
    billingSummary: {
      totalInvoices: 7380,
      grossBilling: 48500000,
      discounts: 3950000,
      netBilling: 44550000,
      paidAmount: 38920000,
      partiallyPaidAmount: 4180000,
      partiallyPaidInvoicesCount: 280,
      outstandingAmount: 5630000,
      refundsAmount: 540000,
    },
    paymentMethods: [
      { method: 'Cash', amount: 20950000, percentage: 53.8, icon: 'Banknote' },
      { method: 'Card (Debit / Credit)', amount: 9350000, percentage: 24.0, icon: 'CreditCard' },
      { method: 'Bank / Online Transfer', amount: 4980000, percentage: 12.8, icon: 'Building' },
      { method: 'Panel / Corporate Credit', amount: 3640000, percentage: 9.4, icon: 'Shield' },
    ],
    pharmacySummary: {
      salesAmount: 10280000,
      invoicesCount: 5520,
      medicinesDispensedCount: 18400,
      pendingRequestsCount: 8,
      returnsCount: 78,
      returnsAmount: 142000,
      nearExpiryAlertsCount: 14,
    },
    expenses: {
      todayAmount: 412500,
      monthAmount: 8420000,
      topCategories: [
        { category: 'Medicines & Clinical Consumables', amount: 3780000, percentage: 44.9, allocatedBudget: 4500000 },
        { category: 'Biomedical Gases & Liquid Oxygen', amount: 1650000, percentage: 19.6, allocatedBudget: 2000000 },
        { category: 'Staff Operational Shifts & Nursing', amount: 1510000, percentage: 17.9, allocatedBudget: 1800000 },
        { category: 'Laboratory Reagents & Diagnostics', amount: 1000000, percentage: 11.9, allocatedBudget: 1200000 },
        { category: 'Facility Sterilization & Housekeeping', amount: 480000, percentage: 5.7, allocatedBudget: 600000 },
      ],
    },
    corporatePanels: {
      activePanelsCount: 14,
      panelPatientsCount: 1240,
      panelBillingAmount: 11680000,
      panelOutstandingAmount: 1450000,
      topPanels: [
        { name: 'State Life Insurance (National Health Card)', patients: 530, billing: 5180000 },
        { name: 'EFU General Insurance Ltd.', patients: 280, billing: 2810000 },
        { name: 'Jubilee Life Health Insurance', patients: 240, billing: 2110000 },
        { name: 'Pak-Qatar Family Takaful', patients: 190, billing: 1580000 },
      ],
    },
  },

  custom: {
    periodLabel: getDynamicPeriodLabel('custom'),
    kpis: [
      {
        id: 'kpi_today_patients',
        title: 'Patients',
        value: '3,850',
        numericValue: 3850,
        iconName: 'Users',
        contextText: 'custom selected timeframe',
        changeText: 'Filtered range',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_opd_visits',
        title: 'OPD Visits',
        value: '2,680',
        numericValue: 2680,
        iconName: 'Stethoscope',
        contextText: 'consultation clinic footfall',
        changeText: 'Active clinics',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#dff5ea] border-[#c2e7db]',
      },
      {
        id: 'kpi_observation_patients',
        title: 'Observation Patients',
        value: '465',
        numericValue: 465,
        iconName: 'Clock',
        contextText: 'short-stay protocol',
        changeText: 'Monitored',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_emergency_visits',
        title: 'Emergency Visits',
        value: '705',
        numericValue: 705,
        iconName: 'Activity',
        contextText: 'acute triage & resuscitation',
        changeText: '24/7 care',
        isPositive: true,
        colorClass: 'text-rose-700',
        accentBg: 'bg-rose-50 border-rose-200',
      },
      {
        id: 'kpi_current_admissions',
        title: 'Current Admissions',
        value: '189',
        numericValue: 189,
        iconName: 'Bed',
        contextText: 'current active inpatients',
        changeText: 'Current-state',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#effaf5] border-[#c2e7db]',
      },
      {
        id: 'kpi_bed_occupancy',
        title: 'Bed Occupancy',
        value: '75.6%',
        numericValue: 75.6,
        iconName: 'Layers',
        contextText: '189 of 250 total beds',
        changeText: '61 available beds',
        isPositive: true,
        colorClass: 'text-teal-700',
        accentBg: 'bg-teal-50 border-teal-200',
      },
      {
        id: 'kpi_today_billing',
        title: 'Billing',
        value: 'PKR 20,480,000',
        numericValue: 20480000,
        iconName: 'Receipt',
        contextText: 'total invoices in range',
        changeText: 'Audited range',
        isPositive: true,
        colorClass: 'text-emerald-700',
        accentBg: 'bg-emerald-50 border-emerald-200',
      },
      {
        id: 'kpi_today_collections',
        title: 'Collections',
        value: 'PKR 17,890,000',
        numericValue: 17890000,
        iconName: 'CreditCard',
        contextText: '87.3% collection rate',
        changeText: 'Deposited',
        isPositive: true,
        colorClass: 'text-emerald-800',
        accentBg: 'bg-emerald-50 border-emerald-200',
      },
      {
        id: 'kpi_outstanding_balance',
        title: 'Outstanding Balance',
        value: 'PKR 2,590,000',
        numericValue: 2590000,
        iconName: 'AlertCircle',
        contextText: 'aging receivables in scope',
        changeText: 'Under follow-up',
        isPositive: false,
        colorClass: 'text-amber-700',
        accentBg: 'bg-amber-50 border-amber-200',
      },
      {
        id: 'kpi_pharmacy_sales',
        title: 'Pharmacy Sales',
        value: 'PKR 4,720,000',
        numericValue: 4720000,
        iconName: 'Pill',
        contextText: 'prescriptions dispensed',
        changeText: 'Dispensary total',
        isPositive: true,
        colorClass: 'text-[#08775A]',
        accentBg: 'bg-[#dff5ea] border-[#c2e7db]',
      },
      {
        id: 'kpi_today_expenses',
        title: 'Expenses',
        value: 'PKR 3,920,000',
        numericValue: 3920000,
        iconName: 'DollarSign',
        contextText: 'expenses in custom range',
        changeText: 'Vouched',
        isPositive: true,
        colorClass: 'text-slate-700',
        accentBg: 'bg-slate-100 border-slate-200',
      },
      {
        id: 'kpi_low_stock_alerts',
        title: 'Low Stock Alerts',
        value: '8 Items',
        numericValue: 8,
        iconName: 'Package',
        contextText: 'current inventory state',
        changeText: 'Immediate attention',
        isPositive: false,
        colorClass: 'text-rose-700',
        accentBg: 'bg-rose-50 border-rose-200',
      },
    ],
    patientFlow: [
      { category: 'OPD', total: 2680, waiting: 28, completed: 2632, active: 20, peakHour: '11:00 AM', accentColor: '#129b70' },
      { category: 'Observation', total: 465, waiting: 6, completed: 449, active: 10, peakHour: '02:00 PM', accentColor: '#0e7d5a' },
      { category: 'Emergency', total: 705, waiting: 4, completed: 689, active: 12, peakHour: '09:00 PM', accentColor: '#e11d48' },
      { category: 'Admission', total: 215, waiting: 5, completed: 172, active: 38, peakHour: '12:00 PM', accentColor: '#14b885' },
    ],
    patientHourlyTrend: [
      { time: 'Period A', opd: 680, emergency: 180, observation: 115, admitted: 42 },
      { time: 'Period B', opd: 710, emergency: 195, observation: 120, admitted: 46 },
      { time: 'Period C', opd: 640, emergency: 160, observation: 110, admitted: 39 },
      { time: 'Period D', opd: 650, emergency: 170, observation: 120, admitted: 45 },
    ],
    revenueChart: [
      { label: 'Segment 1', billing: 5100000, collections: 4450000 },
      { label: 'Segment 2', billing: 5250000, collections: 4590000 },
      { label: 'Segment 3', billing: 4950000, collections: 4320000 },
      { label: 'Segment 4', billing: 5180000, collections: 4530000 },
    ],
    revenueChannels: {
      cash: 9650000,
      onlineBank: 4300000,
      panelCorporate: 3940000,
      outstanding: 2590000,
    },
    departmentActivity: [
      { id: 'DEP-CARDIO', name: 'Cardiology & Cath Lab', type: 'Clinical', patients: 620, billing: 6500000, status: 'High Volume', statusColor: 'bg-amber-50 text-amber-800' },
      { id: 'DEP-ORTHO', name: 'Orthopedics & Trauma', type: 'Surgical', patients: 510, billing: 4300000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-PEDS', name: 'Pediatrics & Neonatology', type: 'Specialized', patients: 570, billing: 2700000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-MED', name: 'General Medicine & Pulmonology', type: 'Clinical', patients: 760, billing: 2360000, status: 'Surge', statusColor: 'bg-rose-50 text-rose-800' },
      { id: 'DEP-SURG', name: 'General Surgery', type: 'Surgical', patients: 310, billing: 5300000, status: 'Optimal', statusColor: 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]' },
      { id: 'DEP-OBGYN', name: 'Obstetrics & Gynecology', type: 'Maternal', patients: 480, billing: 3080000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
      { id: 'DEP-ER', name: 'Emergency & Critical Care', type: 'Emergency', patients: 705, billing: 2480000, status: 'High Volume', statusColor: 'bg-amber-50 text-amber-800' },
      { id: 'DEP-RAD', name: 'Radiology & Diagnostics', type: 'Diagnostic', patients: 940, billing: 3360000, status: 'Normal Flow', statusColor: 'bg-emerald-50 text-emerald-800' },
    ],
    billingSummary: {
      totalInvoices: 3390,
      grossBilling: 22300000,
      discounts: 1820000,
      netBilling: 20480000,
      paidAmount: 17890000,
      partiallyPaidAmount: 1920000,
      partiallyPaidInvoicesCount: 145,
      outstandingAmount: 2590000,
      refundsAmount: 248000,
    },
    paymentMethods: [
      { method: 'Cash', amount: 9650000, percentage: 53.9, icon: 'Banknote' },
      { method: 'Card (Debit / Credit)', amount: 4300000, percentage: 24.0, icon: 'CreditCard' },
      { method: 'Bank / Online Transfer', amount: 2290000, percentage: 12.8, icon: 'Building' },
      { method: 'Panel / Corporate Credit', amount: 1650000, percentage: 9.3, icon: 'Shield' },
    ],
    pharmacySummary: {
      salesAmount: 4720000,
      invoicesCount: 2540,
      medicinesDispensedCount: 8450,
      pendingRequestsCount: 8,
      returnsCount: 36,
      returnsAmount: 65000,
      nearExpiryAlertsCount: 14,
    },
    expenses: {
      todayAmount: 412500,
      monthAmount: 8420000,
      topCategories: [
        { category: 'Medicines & Clinical Consumables', amount: 1740000, percentage: 44.4, allocatedBudget: 2200000 },
        { category: 'Biomedical Gases & Liquid Oxygen', amount: 770000, percentage: 19.6, allocatedBudget: 980000 },
        { category: 'Staff Operational Shifts & Nursing', amount: 700000, percentage: 17.9, allocatedBudget: 880000 },
        { category: 'Laboratory Reagents & Diagnostics', amount: 470000, percentage: 12.0, allocatedBudget: 590000 },
        { category: 'Facility Sterilization & Housekeeping', amount: 240000, percentage: 6.1, allocatedBudget: 320000 },
      ],
    },
    corporatePanels: {
      activePanelsCount: 14,
      panelPatientsCount: 570,
      panelBillingAmount: 5360000,
      panelOutstandingAmount: 1450000,
      topPanels: [
        { name: 'State Life Insurance (National Health Card)', patients: 244, billing: 2380000 },
        { name: 'EFU General Insurance Ltd.', patients: 128, billing: 1290000 },
        { name: 'Jubilee Life Health Insurance', patients: 110, billing: 970000 },
        { name: 'Pak-Qatar Family Takaful', patients: 88, billing: 720000 },
      ],
    },
  },
};

// Dynamic current date reference for activity and transaction timestamps
const CURRENT_DATE_FOR_LOGS = formatDisplayDate(getHospitalCurrentDate());

// USER & STAFF RECENT IMPORTANT ACTIVITY (Realistic hospital staff roles per Section 15 & 20)
export const RECENT_IMPORTANT_ACTIVITY: UserActivityItem[] = [
  {
    id: 'ACT-01',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 14:42`,
    user: 'Ahmed Raza',
    role: 'Billing Officer',
    action: 'Payment Collected (Cash settlement)',
    module: 'Billing',
    reference: 'REC-000125',
  },
  {
    id: 'ACT-02',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 14:15`,
    user: 'Sara Khan',
    role: 'Admission Officer',
    action: 'Patient Admitted to PICU (Bed 08)',
    module: 'Admission',
    reference: 'ADM-000082',
  },
  {
    id: 'ACT-03',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 13:50`,
    user: 'Usman Ali',
    role: 'Store Manager',
    action: 'Stock Issued to Emergency Triage (Ceftriaxone 1g)',
    module: 'Inventory',
    reference: 'ST-000041',
  },
  {
    id: 'ACT-04',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 13:22`,
    user: 'Dr. Ayesha Siddiqui',
    role: 'Consultant Physician',
    action: 'Discharge Summary Cleared (General Ward 04)',
    module: 'Inpatient',
    reference: 'DIS-000049',
  },
  {
    id: 'ACT-05',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 12:45`,
    user: 'Zainab Bibi',
    role: 'Pharmacy Cashier',
    action: 'Prescription Dispensed (Card settlement)',
    module: 'Pharmacy',
    reference: 'RX-000918',
  },
  {
    id: 'ACT-06',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 12:10`,
    user: 'Bilal Hassan',
    role: 'Triage Nurse',
    action: 'Acute Trauma Patient Triaged to Resuscitation Bay',
    module: 'Emergency',
    reference: 'ER-000304',
  },
  {
    id: 'ACT-07',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 11:35`,
    user: 'Farhan Qureshi',
    role: 'Accounts Officer',
    action: 'Corporate Pre-Authorization Verified (State Life)',
    module: 'Corporate Panel',
    reference: 'PNL-000874',
  },
  {
    id: 'ACT-08',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 10:50`,
    user: 'Khadija Malik',
    role: 'Front Desk Officer',
    action: 'New OPD Patient Registered (Cardiology clinic)',
    module: 'Registration',
    reference: 'REG-001490',
  },
];

// ATTENTION REQUIRED / EXECUTIVE ALERTS (Section 16)
export const ATTENTION_REQUIRED_ALERTS: AttentionAlertItem[] = [
  {
    id: 'ALT-01',
    severity: 'Critical',
    title: 'High Outstanding Corporate Balance',
    description: 'State Life & EFU panel receivables exceed credit limit threshold.',
    relevantMetric: 'PKR 1,450,000 Pending',
    actionLabel: 'View Panel aging',
    navModule: 'corporate_panels',
    detailedMessage:
      'Total outstanding claims across 14 active corporate panels stand at PKR 1,450,000. State Life claims of PKR 680,000 have matured past the 45-day SLA. Recommended action: Generate reconciliation summary and dispatch to corporate focal persons.',
  },
  {
    id: 'ALT-02',
    severity: 'Critical',
    title: 'Expired Medicines in Sub-Store',
    description: '2 batches in Operating Theatre pharmacy passed shelf life.',
    relevantMetric: '2 Batches Expired',
    actionLabel: 'Review Expired Stock',
    navModule: 'inventory_reports',
    detailedMessage:
      'Batch #BTH-8821 (Atracurium Inj) and #BTH-9014 (Sodium Bicarbonate) in OT-2 Sub-store passed shelf life. Immediate quarantine and write-off disposal protocol is mandatory under hospital safety standards.',
  },
  {
    id: 'ALT-03',
    severity: 'Warning',
    title: 'Critical Low Stock Items',
    description: '3 emergency consumables and life-saving ampoules below safety reserve.',
    relevantMetric: '8 Items Low / 3 Zero',
    actionLabel: 'Inspect Inventory',
    navModule: 'inventory_reports',
    detailedMessage:
      'Zero stock recorded for Epinephrine 1mg/ml (Emergency cart) and Arterial Line Kits 20G. 5 additional items are below min-threshold. Purchase requisition PR-2026-088 is awaiting store manager approval.',
  },
  {
    id: 'ALT-04',
    severity: 'Warning',
    title: 'High Bed Occupancy in Critical Care',
    description: 'NICU is at 85% capacity and PICU is at 81.3% capacity.',
    relevantMetric: '3 NICU / 3 PICU Left',
    actionLabel: 'Bed Allocation Matrix',
    navModule: 'wards_rooms_beds',
    detailedMessage:
      'Neonatal ICU has 17 of 20 beds occupied with 8 ventilators engaged. Pediatric ICU has 13 of 16 beds occupied. Recommended action: Prioritize stepdown ward transfers for stable neonates.',
  },
  {
    id: 'ALT-05',
    severity: 'Warning',
    title: 'Near Expiry Pharmaceuticals (< 30 Days)',
    description: '14 pharmaceutical batches nearing expiry within current billing cycle.',
    relevantMetric: '14 Batches Near Expiry',
    actionLabel: 'View Pharmacy Batches',
    navModule: 'pharmacy_reports',
    detailedMessage:
      'Total near-expiry inventory valuation is PKR 84,500 across 14 batches. Recommend immediate FIFO dispensary priority or supplier credit exchange before final expiration dates.',
  },
  {
    id: 'ALT-06',
    severity: 'Warning',
    title: 'Unusual Invoice Refund Flagged',
    description: 'Cash refund exceeding PKR 15,000 processed without second supervisor signature.',
    relevantMetric: 'PKR 18,500 Refunded',
    actionLabel: 'Review Audit Slip',
    navModule: 'billing_reports',
    detailedMessage:
      'Refund slip RF-000038 for PKR 18,500 was initiated on Invoice INV-001092 (Cath Lab Consumables canceled due to diagnostic reassessment). Requires Super Admin review according to hospital financial regulations.',
  },
  {
    id: 'ALT-07',
    severity: 'Info',
    title: 'Pending Purchase Approvals',
    description: '2 vendor supply orders awaiting management verification.',
    relevantMetric: '2 Orders Pending',
    actionLabel: 'View Requisitions',
    navModule: 'inventory_reports',
    detailedMessage:
      'Requisition PR-00412 (Medical Gases Supply - Pakistan Oxygen Ltd) for PKR 165,000 and PR-00413 (Sterile Surgical Drape Packs) for PKR 82,000 are in queue for executive clearance.',
  },
];

// RECENT TRANSACTIONS TABLE DATA (Realistic hospital staff roles & transactions per Section 17 & 20)
export const RECENT_TRANSACTIONS_DATA: RecentTransactionItem[] = [
  {
    reference: 'INV-2026-004182',
    patientName: 'Chaudhry Muhammad Aslam',
    transactionType: 'Invoice',
    amount: 85000,
    paymentStatus: 'Paid',
    user: 'Ahmed Raza',
    userRole: 'Billing Officer',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 14:40`,
  },
  {
    reference: 'PAY-2026-001924',
    patientName: 'Begum Naseem Akhtar',
    transactionType: 'Payment',
    amount: 35000,
    paymentStatus: 'Paid',
    user: 'Ahmed Raza',
    userRole: 'Billing Officer',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 14:28`,
  },
  {
    reference: 'RX-2026-009182',
    patientName: 'Malik Zafar Iqbal',
    transactionType: 'Pharmacy Sale',
    amount: 14850,
    paymentStatus: 'Paid',
    user: 'Zainab Bibi',
    userRole: 'Pharmacy Cashier',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 14:15`,
  },
  {
    reference: 'INV-2026-004181',
    patientName: 'Zubair Tariq',
    transactionType: 'Invoice',
    amount: 145000,
    paymentStatus: 'Partially Paid',
    user: 'Ahmed Raza',
    userRole: 'Billing Officer',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 13:52`,
  },
  {
    reference: 'RF-2026-000038',
    patientName: 'Mrs. Huma Farooq',
    transactionType: 'Refund',
    amount: 18500,
    paymentStatus: 'Refunded',
    user: 'Farhan Qureshi',
    userRole: 'Accounts Officer',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 13:30`,
  },
  {
    reference: 'RX-2026-009181',
    patientName: 'Shaheen Pervez',
    transactionType: 'Pharmacy Sale',
    amount: 8400,
    paymentStatus: 'Paid',
    user: 'Zainab Bibi',
    userRole: 'Pharmacy Cashier',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 13:10`,
  },
  {
    reference: 'INV-2026-004180',
    patientName: 'State Life / M. Irfan',
    transactionType: 'Invoice',
    amount: 62000,
    paymentStatus: 'Pending Settlement',
    user: 'Farhan Qureshi',
    userRole: 'Accounts Officer',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 12:45`,
  },
  {
    reference: 'PAY-2026-001923',
    patientName: 'Abdul Rehman',
    transactionType: 'Payment',
    amount: 12000,
    paymentStatus: 'Paid',
    user: 'Ahmed Raza',
    userRole: 'Billing Officer',
    timestamp: `${CURRENT_DATE_FOR_LOGS}, 12:20`,
  },
];
