import { HospitalSystemAggregateCounts } from '../types/hospital';

/**
 * Centralized frontend mock aggregate data source for Hospital System Summary.
 * All overview statistics flow from this single source of truth,
 * prepared for future backend API aggregation.
 */
export const MOCK_HOSPITAL_SYSTEM_AGGREGATES: HospitalSystemAggregateCounts = {
  departments: 12,
  doctors: 48,
  staffUsers: 136,
  inpatientWards: 8,
  hospitalRooms: 24,
  totalBeds: 68,
  activePanels: 4,
};

/**
 * Service function to retrieve hospital system summary aggregate metrics.
 * Designed for immediate seamless replacement with a backend fetch call
 * (e.g. GET /api/v1/super-admin/hospital-summary) in subsequent releases.
 */
export const getHospitalSystemSummaryAggregates = async (): Promise<HospitalSystemAggregateCounts> => {
  return { ...MOCK_HOSPITAL_SYSTEM_AGGREGATES };
};
