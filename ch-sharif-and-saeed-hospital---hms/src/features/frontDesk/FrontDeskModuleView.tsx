import React from 'react';
import { NewAdmissionView } from './newAdmission/NewAdmissionView';
import { AppointmentsView } from './appointments/AppointmentsView';
import { AdmissionPaymentRequestsView } from './paymentRequests/AdmissionPaymentRequestsView';
import { FrontDeskBillingReportsView } from './reports/FrontDeskBillingReportsView';
import { MyAccountSettlementView } from './settlement/MyAccountSettlementView';
import { HospitalInvoicesView } from './billing/HospitalInvoicesView';
import { BillingPendingDischargesView } from './billing/BillingPendingDischargesView';
import { MyBalanceSheetView } from './billing/MyBalanceSheetView';
import { WalkInIntakeView } from './encounterIntake/WalkInIntakeView';
import { PanelBillingView } from './panelBilling/PanelBillingView';
import { ModulePlaceholderView } from '../shared/ModulePlaceholderView';

interface FrontDeskModuleViewProps {
  moduleId: string;
  moduleName: string;
  groupTitle: string;
}

/**
 * Front Desk portal dispatcher — mirrors `SuperAdminModuleView`'s pattern:
 * real, DB-backed pages first, falling back to `ModulePlaceholderView`
 * (100% hardcoded mock data) for modules not yet wired.
 *
 * `payments_receipts` / `discounts` / `refunds` all point at the same
 * `HospitalInvoicesView` + its `InvoiceDetailModal` — a deliberate
 * consolidation (those actions live per-invoice, not as separate global
 * lists) rather than four near-duplicate pages. `panel_billing` follows the
 * same idea: Panel Verification, Contract Resolution, Interim Statement and
 * Remittance all live as tabs on one `PanelBillingView`. Every Front Desk
 * nav item is now real — see HMS_V7.2_NEW_REQUIREMENTS.md's progress log
 * for the build history.
 */
export const FrontDeskModuleView: React.FC<FrontDeskModuleViewProps> = ({ moduleId, moduleName, groupTitle }) => {
  switch (moduleId) {
    case 'new_admission':
      return <NewAdmissionView />;
    case 'appointments':
      return <AppointmentsView />;
    case 'walk_in_intake':
      return <WalkInIntakeView />;
    case 'billing_pending_discharges':
      return <BillingPendingDischargesView />;
    case 'hospital_invoices':
    case 'payments_receipts':
    case 'discounts':
    case 'refunds':
      return <HospitalInvoicesView />;
    case 'outstanding_balances':
      return (
        <HospitalInvoicesView
          outstandingOnly
          title="Outstanding Balances"
          subtitle="Every invoice with a remaining balance due — open one to collect payment."
        />
      );
    case 'opd':
      return (
        <HospitalInvoicesView
          encounterTypeFilter="OPD"
          title="OPD Queue"
          subtitle="Outpatient encounters — invoices raised via Walk-In Intake or an Appointment Check-In."
        />
      );
    case 'observation':
      return (
        <HospitalInvoicesView
          encounterTypeFilter="OBSERVATION"
          title="Observation Queue"
          subtitle="Observation encounters — invoices raised via Walk-In Intake or an Appointment Check-In."
        />
      );
    case 'emergency':
      return (
        <HospitalInvoicesView
          encounterTypeFilter="EMERGENCY"
          title="Emergency Queue"
          subtitle="Emergency encounters — invoices raised via Walk-In Intake or an Appointment Check-In."
        />
      );
    case 'my_balance_sheet':
      return <MyBalanceSheetView />;
    case 'admission_payment_requests':
      return <AdmissionPaymentRequestsView />;
    case 'front_desk_billing_reports':
      return <FrontDeskBillingReportsView />;
    case 'my_account_settlement':
      return <MyAccountSettlementView />;
    case 'panel_billing':
      return <PanelBillingView />;
    default:
      return <ModulePlaceholderView moduleId={moduleId} moduleName={moduleName} groupTitle={groupTitle} />;
  }
};
