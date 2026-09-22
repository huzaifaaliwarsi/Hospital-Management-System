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
