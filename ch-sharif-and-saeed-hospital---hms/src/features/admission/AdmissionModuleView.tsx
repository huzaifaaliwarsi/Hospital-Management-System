import React from 'react';
import { PlannedAdmissionsView } from './PlannedAdmissionsView';
import { ActiveAdmissionsView } from './ActiveAdmissionsView';
import { BedBoardView } from './BedBoardView';
import { AdmissionPaymentRequestsView } from './AdmissionPaymentRequestsView';
import { FinalDischargeView } from './FinalDischargeView';
import { AdmissionReportsView } from './AdmissionReportsView';
import { ModulePlaceholderView } from '../shared/ModulePlaceholderView';

interface AdmissionModuleViewProps {
  moduleId: string;
  moduleName: string;
  groupTitle: string;
}

/**
 * Admission portal dispatcher — mirrors `FrontDeskModuleView`'s pattern.
 * `active_admissions` / `hospital_services_procedures` /
 * `medication_fulfillment_mode` / `pharmacy_requests` / `discharge_clearances`
 * all point at the same `ActiveAdmissionsView` + `AdmissionDetailModal`,
 * each just pre-selecting a different tab — same consolidation
 * `HospitalInvoicesView` uses in Front Desk. Every nav item is real; none
 * fall through to `ModulePlaceholderView` anymore.
 */
export const AdmissionModuleView: React.FC<AdmissionModuleViewProps> = ({ moduleId, moduleName, groupTitle }) => {
  switch (moduleId) {
    case 'planned_admissions':
      return <PlannedAdmissionsView title="Planned Admissions" subtitle="Admissions created at Front Desk, awaiting check-in." />;
    case 'admission_check_in':
      return (
        <PlannedAdmissionsView
          title="Admission Check-In"
          subtitle="Assign a bed to move a planned admission to Active."
          showCheckIn
        />
      );
    case 'active_admissions':
      return <ActiveAdmissionsView title="Active Admissions" subtitle="Every currently admitted inpatient." initialTab="overview" />;
    case 'bed_board_transfers':
      return <BedBoardView />;
    case 'hospital_services_procedures':
      return (
        <ActiveAdmissionsView
          title="Hospital Services / Procedures"
          subtitle="Post running hospital charges against an active admission."
          initialTab="services"
        />
      );
    case 'medication_fulfillment_mode':
      return (
        <ActiveAdmissionsView
          title="Medication Fulfillment Mode"
          subtitle="Toggle Self vs Hospital Managed medication sourcing per admission."
          initialTab="medication"
        />
      );
    case 'pharmacy_requests':
      return (
        <ActiveAdmissionsView
          title="Pharmacy Requests"
          subtitle="Request inpatient medicines for Hospital Managed admissions."
          initialTab="pharmacy"
        />
      );
    case 'hospital_payment_requests':
      return <AdmissionPaymentRequestsView />;
    case 'discharge_clearances':
      return (
        <ActiveAdmissionsView
          title="Discharge Clearances"
          subtitle="Clinical, Hospital Billing and Pharmacy clearance gates per admission."
          initialTab="clearances"
        />
      );
    case 'final_discharge':
      return <FinalDischargeView />;
    case 'admission_reports':
      return <AdmissionReportsView />;
    default:
      return <ModulePlaceholderView moduleId={moduleId} moduleName={moduleName} groupTitle={groupTitle} />;
  }
};
