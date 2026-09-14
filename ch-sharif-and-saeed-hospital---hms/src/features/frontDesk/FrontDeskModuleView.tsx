import React from 'react';
import { NewAdmissionView } from './newAdmission/NewAdmissionView';
import { HospitalInvoicesView } from './billing/HospitalInvoicesView';
import { BillingPendingDischargesView } from './billing/BillingPendingDischargesView';
import { MyBalanceSheetView } from './billing/MyBalanceSheetView';
import { WalkInIntakeView } from './encounterIntake/WalkInIntakeView';
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
 * lists) rather than four near-duplicate pages; see
 * HMS_V7.2_NEW_REQUIREMENTS.md's progress log for the reasoning and what's
 * still a placeholder (Appointments, OPD/Observation/Emergency queues,
 * Panel Billing, Admission Payment Requests, Reports).
 */
export const FrontDeskModuleView: React.FC<FrontDeskModuleViewProps> = ({ moduleId, moduleName, groupTitle }) => {
  switch (moduleId) {
    case 'new_admission':
      return <NewAdmissionView />;
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
    case 'my_balance_sheet':
      return <MyBalanceSheetView />;
    default:
      return <ModulePlaceholderView moduleId={moduleId} moduleName={moduleName} groupTitle={groupTitle} />;
  }
};
