import React from 'react';
import { AdmissionDashboardView } from './AdmissionDashboardView';
import { PlannedAdmissionsView } from './PlannedAdmissionsView';
import { ActiveAdmissionsView } from './ActiveAdmissionsView';
import { BedBoardView } from './BedBoardView';
import { MedicationFulfillmentModeView } from './MedicationFulfillmentModeView';
import { PharmacyRequestsView } from './PharmacyRequestsView';
import { DischargeClearancesView } from './DischargeClearancesView';
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
 * `active_admissions` / `hospital_services_procedures` still point at the
 * shared `ActiveAdmissionsView` + `AdmissionDetailModal` (pre-selecting a
 * different tab), since posting a service charge or reading full detail
 * genuinely requires picking one admission first. `medication_fulfillment_mode`,
 * `pharmacy_requests` and `discharge_clearances` each got their own
 * purpose-built view instead, so they show real, distinct data (mode
 * split, a flat cross-admission request feed, a 3-gate status board) rather
 * than looking like a copy of Active Admissions with a different title.
 * Every nav item is real; none fall through to `ModulePlaceholderView` —
 * `dashboard` was the one gap (silently falling through to the hardcoded
 * placeholder), fixed by routing it to `AdmissionDashboardView`.
 */
export const AdmissionModuleView: React.FC<AdmissionModuleViewProps> = ({ moduleId, moduleName, groupTitle }) => {
  switch (moduleId) {
    case 'dashboard':
      return <AdmissionDashboardView />;
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
      return <MedicationFulfillmentModeView />;
    case 'pharmacy_requests':
      return <PharmacyRequestsView />;
    case 'hospital_payment_requests':
      return <AdmissionPaymentRequestsView />;
    case 'discharge_clearances':
      return <DischargeClearancesView />;
    case 'final_discharge':
      return <FinalDischargeView />;
    case 'admission_reports':
      return <AdmissionReportsView />;
    default:
      return <ModulePlaceholderView moduleId={moduleId} moduleName={moduleName} groupTitle={groupTitle} />;
  }
};
