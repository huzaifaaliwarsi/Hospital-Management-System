import React from 'react';
import { AdmissionDashboard } from '../dashboard/AdmissionDashboard';

/**
 * Admission Portal Dashboard View — unified with AdmissionDashboard.
 * Displays ward occupancy cards (rooms/beds ratio), incoming planned admissions,
 * and active inpatients with real-time live database updates.
 */
export const AdmissionDashboardView: React.FC = () => {
  return <AdmissionDashboard />;
};
