import React from 'react';
import {
  LineChart,
  LayoutDashboard,
  ClipboardList,
  Users,
  Bed,
  ArrowLeftRight,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Pill,
  ClipboardCheck,
  ShieldAlert,
  PackageCheck,
} from 'lucide-react';
import { ReportsHubShell, ReportsHubItem } from './ReportsHubShell';
import { AdmissionReportsView } from '../../admission/AdmissionReportsView';
import {
  AdmissionDailySummaryView,
  AdmissionRegisterReportView,
  InpatientCensusReportView,
  BedOccupancyReportView,
  BedTransferHistoryReportView,
  LengthOfStayReportView,
  ServiceConsumptionReportView,
  InpatientOutstandingReportView,
  DischargeClearanceReportView,
} from '../../admission/AdmissionExtraReports';
import {
  PharmacyMedicineRequestsView,
  MedicineFulfillmentReportView,
  HighValueApprovalReportView,
  PharmacyClearanceStatusView,
  AdmissionPaymentRequestStatusView,
} from '../../admission/AdmissionPharmacyReports';

const ITEMS: ReportsHubItem[] = [
  { id: 'summary', label: 'Admission Summary', icon: LineChart, Component: AdmissionReportsView },
  { id: 'daily_summary', label: 'Admission Daily Summary', icon: LayoutDashboard, Component: AdmissionDailySummaryView },
  { id: 'register', label: 'Admission Register', icon: ClipboardList, Component: AdmissionRegisterReportView },
  { id: 'census', label: 'Inpatient Census', icon: Users, Component: InpatientCensusReportView },
  { id: 'bed_occupancy', label: 'Bed Occupancy / Ward Utilization', icon: Bed, Component: BedOccupancyReportView },
  { id: 'bed_transfers', label: 'Bed / Ward Transfer History', icon: ArrowLeftRight, Component: BedTransferHistoryReportView },
  { id: 'length_of_stay', label: 'Length of Stay', icon: Clock, Component: LengthOfStayReportView },
  { id: 'service_consumption', label: 'Service Consumption', icon: Layers, Component: ServiceConsumptionReportView },
  { id: 'outstanding_balance', label: 'Inpatient Outstanding Balance', icon: AlertTriangle, Component: InpatientOutstandingReportView },
  { id: 'discharge_clearance', label: 'Discharge Clearance', icon: CheckCircle2, Component: DischargeClearanceReportView },
  { id: 'payment_request_status', label: 'Hospital Payment Request & Status', icon: CreditCard, Component: AdmissionPaymentRequestStatusView },
  { id: 'pharmacy_requests', label: 'Pharmacy Medicine Requests', icon: Pill, Component: PharmacyMedicineRequestsView },
  { id: 'medicine_fulfillment', label: 'Medicine Request Fulfillment', icon: ClipboardCheck, Component: MedicineFulfillmentReportView },
  { id: 'high_value_approvals', label: 'High-Value Medicine Approvals', icon: ShieldAlert, Component: HighValueApprovalReportView },
  { id: 'pharmacy_clearance_status', label: 'Pharmacy Clearance Status', icon: PackageCheck, Component: PharmacyClearanceStatusView },
];

/**
 * Super Admin/Admin oversight of every real Admission report (Reporting
 * Guide v7.5 §5) — reuses the exact components Admission's own nav renders,
 * including the 4 Pharmacy-linked read-only reports. No admission/transfer/
 * discharge controls here, per §1's ownership rule (Admission owns the
 * case; this is read-only oversight).
 */
export const SuperAdminAdmissionReportsHub: React.FC = () => (
  <ReportsHubShell
    icon={LineChart}
    title="Admission Reports"
    subtitle="Admission's full report set — the same live figures the portal itself reports on."
    items={ITEMS}
  />
);
