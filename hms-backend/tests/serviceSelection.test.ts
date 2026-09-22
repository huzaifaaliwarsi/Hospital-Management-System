import { describe, expect, it } from 'vitest';
import {
  HOSPITAL_SERVICE_SOURCE, OUTSOURCED_SERVICE_SOURCE, serviceSourceOptions, servicesForSource, retainAvailableServiceIds,
} from '../../ch-sharif-and-saeed-hospital---hms/src/utils/serviceSelection';
import type { HospitalService } from '../../ch-sharif-and-saeed-hospital---hms/src/types/serviceRates';
import type { Department } from '../../ch-sharif-and-saeed-hospital---hms/src/types/department';

function service(id: string, departmentId: string | null, overrides: Partial<HospitalService> = {}): HospitalService {
  return {
    id, departmentId, code: id, name: id, departmentName: departmentId ?? '',
    category: 'Other', standardRate: 0, currency: 'PKR', billingUnit: 'Per Visit',
    panelEligible: true, manualRateOverrideAllowed: false, discountAllowed: true,
    status: 'Active', serviceStream: 'HOSPITAL',
    createdBy: '', createdAt: '', updatedBy: '', updatedAt: '', ...overrides,
  };
}

const catalog = [
  service('nicu-care', 'nicu-id'),
  service('picu-care', 'picu-id'),
  service('inactive', 'nicu-id', { status: 'Inactive' }),
  service('lab-test', 'lab-id', { serviceStream: 'LAB', category: 'Laboratory' }),
  service('neuro-test', 'neuro-id', { serviceStream: 'LAB', category: 'Diagnostic' }),
  service('misleading-name', 'other-id', { name: 'NICU Lab X-Ray', departmentName: 'nicu-id', category: 'Radiology' }),
];

describe('shared service source filtering', () => {
  it('shows every active Hospital stream service regardless of category or name', () => {
    expect(servicesForSource(catalog, HOSPITAL_SERVICE_SOURCE).map((s) => s.id))
      .toEqual(['nicu-care', 'picu-care', 'misleading-name']);
  });

  it.each([
    ['nicu-id', 'nicu-care'], ['picu-id', 'picu-care'],
    ['lab-id', 'lab-test'], ['neuro-id', 'neuro-test'],
  ])('shows only active services for exact department %s', (departmentId, expected) => {
    expect(servicesForSource(catalog, departmentId).map((s) => s.id)).toEqual([expected]);
  });

  it.each(['', 'unconfigured-id', 'LAB', 'RADIOLOGY'])('does not fall back to other services for %s', (source) => {
    expect(servicesForSource(catalog, source)).toEqual([]);
  });

  it('returns no services for a department with only inactive services', () => {
    expect(servicesForSource([service('old', 'empty-id', { status: 'Inactive' })], 'empty-id')).toEqual([]);
  });

  it('builds all department options from database IDs, including newly configured and renamed departments', () => {
    const departments = [
      { id: 'lab-id', name: 'Renamed Diagnostics', status: 'Active', fulfillmentOwnership: 'Outsourced' },
      { id: 'new-id', name: 'New Unit', status: 'Active', fulfillmentOwnership: 'Internal' },
      { id: 'inactive-id', name: 'Closed Unit', status: 'Inactive', fulfillmentOwnership: 'Internal' },
    ] as Department[];
    expect(serviceSourceOptions(departments)).toEqual([
      { label: 'Hospital', value: HOSPITAL_SERVICE_SOURCE },
      { label: 'Outsourced', value: OUTSOURCED_SERVICE_SOURCE },
      { label: 'Renamed Diagnostics (Outsourced)', value: 'lab-id' },
      { label: 'New Unit (Internal)', value: 'new-id' },
    ]);
    expect(serviceSourceOptions([])).toHaveLength(2);
  });

  it('keeps department-free services in their saved stream and out of department-specific lists', () => {
    const services = [
      ...catalog,
      service('general-hospital', null),
      service('general-outsourced', null, { serviceStream: 'LAB' }),
      service('inactive-outsourced', null, { serviceStream: 'LAB', status: 'Inactive' }),
    ];
    expect(servicesForSource(services, HOSPITAL_SERVICE_SOURCE).map((s) => s.id))
      .toEqual(['nicu-care', 'picu-care', 'misleading-name', 'general-hospital']);
    expect(servicesForSource(services, OUTSOURCED_SERVICE_SOURCE).map((s) => s.id))
      .toEqual(['lab-test', 'neuro-test', 'general-outsourced']);
    expect(servicesForSource(services, 'nicu-id').map((s) => s.id)).toEqual(['nicu-care']);
    expect(servicesForSource(services, '')).toEqual([]);
  });

  it('clears selections from other departments and inactive or removed services on a source change', () => {
    const selected = ['nicu-care', 'picu-care', 'inactive', 'removed'];
    expect(retainAvailableServiceIds(selected, servicesForSource(catalog, 'nicu-id'))).toEqual(['nicu-care']);
    expect(retainAvailableServiceIds(selected, servicesForSource(catalog, 'empty-id'))).toEqual([]);
  });

  it('keeps valid selections when changing back to Hospital', () => {
    expect(retainAvailableServiceIds(['nicu-care', 'lab-test'], servicesForSource(catalog, HOSPITAL_SERVICE_SOURCE)))
      .toEqual(['nicu-care']);
  });

  it.each(['OPD', 'OBSERVATION', 'EMERGENCY'] as const)('does not leak another department default into %s selection', (encounterType) => {
    const services = [
      service('other-default', 'other-id', { encounterType, isDefaultEncounterService: true }),
      service('own-default', 'nicu-id', { encounterType, isDefaultEncounterService: true }),
    ];
    expect(servicesForSource(services, 'nicu-id').find((s) => s.encounterType === encounterType)?.id).toBe('own-default');
    expect(servicesForSource(services, 'empty-id')).toEqual([]);
  });
});
