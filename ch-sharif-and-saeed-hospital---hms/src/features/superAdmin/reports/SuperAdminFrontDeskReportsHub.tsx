import React from 'react';
import {
  BarChart2,
  ClipboardList,
  Receipt,
  Wallet,
  AlertTriangle,
  Percent,
  RotateCcw,
  Building2,
  CreditCard,
  Building,
  Printer,
  UserCheck,
} from 'lucide-react';
import { ReportsHubShell, ReportsHubItem } from './ReportsHubShell';
import { FrontDeskBillingReportsView } from '../../frontDesk/reports/FrontDeskBillingReportsView';
import {
  EncounterRegisterView,
  InvoiceRegisterView,
  CollectionReportViewPage,
  OutstandingInvoicesView,
  DiscountReportViewPage,
  RefundVoidReportViewPage,
  DepartmentRevenueReportView,
  AdmissionPaymentCollectionsView,
  PanelPayerReportView,
  ReceiptExceptionLogView,
  CashierPerformanceReportView,
} from '../../frontDesk/reports/FrontDeskExtraReports';

const ITEMS: ReportsHubItem[] = [
  { id: 'summary', label: 'Billing Summary', icon: BarChart2, Component: FrontDeskBillingReportsView },
  { id: 'encounter_register', label: 'Encounter Register', icon: ClipboardList, Component: EncounterRegisterView },
  { id: 'invoice_register', label: 'Invoice Register', icon: Receipt, Component: InvoiceRegisterView },
  { id: 'collection_report', label: 'Collection & Receipt', icon: Wallet, Component: CollectionReportViewPage },
  { id: 'outstanding_invoices', label: 'Outstanding / Partial Invoices', icon: AlertTriangle, Component: OutstandingInvoicesView },
  { id: 'discount_report', label: 'Discount Report', icon: Percent, Component: DiscountReportViewPage },
  { id: 'refund_void_report', label: 'Refund / Void Report', icon: RotateCcw, Component: RefundVoidReportViewPage },
  { id: 'department_revenue', label: 'Department / Service Revenue', icon: Building2, Component: DepartmentRevenueReportView },
  { id: 'admission_payment_collections', label: 'Admission Payment Collections', icon: CreditCard, Component: AdmissionPaymentCollectionsView },
  { id: 'panel_payer', label: 'Panel / Payer Report', icon: Building, Component: PanelPayerReportView },
  { id: 'receipt_exceptions', label: 'Receipt Reprint / Exception Log', icon: Printer, Component: ReceiptExceptionLogView },
  { id: 'cashier_performance', label: 'Cashier / User Performance', icon: UserCheck, Component: CashierPerformanceReportView },
];

/**
 * Super Admin/Admin oversight of every real Front Desk/Billing report
 * (Reporting Guide v7.5 §3–4) — reuses the exact components Front Desk's
 * own nav renders, so numbers never drift between what a cashier sees and
 * what oversight sees. Read-only: no collection controls here, per §1's
 * ownership rule (Front Desk/Billing is the sole cash-collection owner).
 */
export const SuperAdminFrontDeskReportsHub: React.FC = () => (
  <ReportsHubShell
    icon={BarChart2}
    title="Billing Reports"
    subtitle="Front Desk / Billing's full report set — the same live figures the portal itself reports on."
    items={ITEMS}
  />
);
