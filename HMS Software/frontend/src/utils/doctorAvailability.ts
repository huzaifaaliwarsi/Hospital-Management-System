import type { StaffUser } from '../types/staffUser';

export const DOCTOR_AVAILABILITY_OPTIONS = [
  { label: 'OPD', field: 'availableForOpd' },
  { label: 'Observation', field: 'availableForObservation' },
  { label: 'Emergency', field: 'availableForEmergency' },
] as const;

export function doctorsForEncounter(staff: StaffUser[], encounterType: string): StaffUser[] {
  return staff.filter((doctor) => {
    if (doctor.staffCategory !== 'Doctor' || doctor.status !== 'ACTIVE') return false;
    switch (encounterType) {
      case 'OPD': return doctor.availableForOpd === true;
      case 'OBSERVATION': return doctor.availableForObservation === true;
      case 'EMERGENCY': return doctor.availableForEmergency === true;
      case 'ADMISSION':
      case 'CUSTOM': return true;
      default: return false;
    }
  });
}

/**
 * Returns RMOs eligible for a given encounter workflow.
 * STRICT REQUIREMENT: RMOs are eligible ONLY for EMERGENCY and ADMISSION.
 * RMOs must NEVER appear in OPD, Observation, or Custom encounters.
 */
export function rmosForEncounter(staff: StaffUser[], encounterType: string): StaffUser[] {
  if (encounterType !== 'EMERGENCY' && encounterType !== 'ADMISSION') {
    return [];
  }
  return staff.filter((s) => {
    if (s.staffCategory !== 'RMO' || s.status !== 'ACTIVE') return false;
    if (encounterType === 'EMERGENCY') {
      return s.availableForEmergency !== false;
    }
    return true;
  });
}
