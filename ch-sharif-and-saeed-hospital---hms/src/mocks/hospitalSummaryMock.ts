import apiClient from '../services/apiClient';
import { HospitalSystemAggregateCounts } from '../types/hospital';

export const DEFAULT_HOSPITAL_SYSTEM_AGGREGATES: HospitalSystemAggregateCounts = {
  departments: 0,
  doctors: 0,
  staffUsers: 0,
  inpatientWards: 0,
  hospitalRooms: 0,
  totalBeds: 0,
  activePanels: 0,
};

// Backwards-compatibility alias
export const MOCK_HOSPITAL_SYSTEM_AGGREGATES = DEFAULT_HOSPITAL_SYSTEM_AGGREGATES;

/**
 * Live service function to retrieve real database aggregate metrics
 * from GET /api/v1/setup/hospital-summary.
 */
export const getHospitalSystemSummaryAggregates = async (): Promise<HospitalSystemAggregateCounts> => {
  try {
    const res = await apiClient.get<{ data: HospitalSystemAggregateCounts }>('/setup/hospital-summary');
    return res.data.data;
  } catch (error) {
    console.error('Failed to fetch live hospital summary aggregates:', error);
    return DEFAULT_HOSPITAL_SYSTEM_AGGREGATES;
  }
};
