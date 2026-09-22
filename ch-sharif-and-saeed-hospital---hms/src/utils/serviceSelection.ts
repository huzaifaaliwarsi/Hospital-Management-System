import type { Department } from '../types/department';
import type { HospitalService } from '../types/serviceRates';

export const HOSPITAL_SERVICE_SOURCE = 'HOSPITAL_SERVICES';
export const OUTSOURCED_SERVICE_SOURCE = 'OUTSOURCED_SERVICES';
export const NO_ACTIVE_DEPARTMENT_SERVICES = 'No active services configured for this department.';

export function serviceSourceOptions(departments: Department[]) {
  return [
    { label: 'Hospital', value: HOSPITAL_SERVICE_SOURCE },
    { label: 'Outsourced', value: OUTSOURCED_SERVICE_SOURCE },
    ...departments.filter((department) => department.status === 'Active').map((department) => ({
      label: `${department.name} (${department.fulfillmentOwnership === 'Outsourced' ? 'Outsourced' : 'Internal'})`,
      value: department.id,
    })),
  ];
}

export function servicesForSource(services: HospitalService[], source: string): HospitalService[] {
  return services.filter((service) => service.status === 'Active' && (
    source === HOSPITAL_SERVICE_SOURCE
      ? service.serviceStream === 'HOSPITAL'
      : source === OUTSOURCED_SERVICE_SOURCE
      ? service.serviceStream === 'LAB'
      : service.departmentId === source
  ));
}

export function retainAvailableServiceIds(ids: string[], availableServices: HospitalService[]): string[] {
  const availableIds = new Set(availableServices.map((service) => service.id));
  const retained = ids.filter((id) => availableIds.has(id));
  return retained.length === ids.length ? ids : retained;
}
