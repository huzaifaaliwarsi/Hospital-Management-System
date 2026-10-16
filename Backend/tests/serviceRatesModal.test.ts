import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServiceRateSchema, updateServiceRateSchema } from '../src/modules/setup/setup.schemas';

const { post, patch } = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
vi.mock('../../ch-sharif-and-saeed-hospital---hms/src/services/apiClient', () => ({
  default: { post, patch },
}));
vi.mock('../../ch-sharif-and-saeed-hospital---hms/src/services/departmentService', () => ({
  DepartmentService: { getDepartmentById: vi.fn() },
}));
vi.mock('../../ch-sharif-and-saeed-hospital---hms/src/services/hospitalProfileService', () => ({
  getHospitalProfile: () => ({ currency: 'PKR' }),
}));
import { ServiceRatesService } from '../../ch-sharif-and-saeed-hospital---hms/src/services/serviceRatesService';
import type { ServiceFormValues } from '../../ch-sharif-and-saeed-hospital---hms/src/types/serviceRates';

const values: ServiceFormValues = {
  code: '', name: 'Database service', description: '',
  departmentId: 'ba77644a-58ba-4c86-bf16-dc46d7227b16',
  standardRate: 0, billingUnit: 'Per Visit', panelEligible: true,
  discountAllowed: true, manualRateOverrideAllowed: false,
  serviceStream: 'HOSPITAL',
};

beforeEach(() => {
  vi.clearAllMocks();
  const response = { data: { data: { ...values, id: 'service-id', isActive: true } } };
  post.mockResolvedValue(response);
  patch.mockResolvedValue(response);
});

describe('Services & Rates modal save compatibility', () => {
  it.each(['HOSPITAL', 'LAB'] as const)('saves a department-free service under %s', async (serviceStream) => {
    await ServiceRatesService.createService({ ...values, departmentId: '', serviceStream });
    expect(createServiceRateSchema.parse(post.mock.calls[0][1])).toMatchObject({
      departmentId: null, serviceStream,
    });
  });

  it('explicitly clears an existing department link on edit', async () => {
    await ServiceRatesService.updateService('service-id', { ...values, departmentId: '' });
    expect(updateServiceRateSchema.parse(patch.mock.calls[0][1])).toHaveProperty('departmentId', null);
  });

  it('allows omitted departments on create and leaves omitted edit links untouched', () => {
    const { departmentId, ...withoutDepartment } = values;
    expect(createServiceRateSchema.parse(withoutDepartment)).not.toHaveProperty('departmentId');
    expect(updateServiceRateSchema.parse({ name: 'Renamed' })).not.toHaveProperty('departmentId');
    expect(createServiceRateSchema.safeParse({ ...values, departmentId: 'invalid-id' }).success).toBe(false);
  });

  it.each([0, 0.01, 125.5])('accepts rate %s without category or status', async (standardRate) => {
    await ServiceRatesService.createService({ ...values, standardRate });
    const payload = JSON.parse(JSON.stringify(post.mock.calls[0][1]));
    expect(payload).not.toHaveProperty('category');
    expect(payload).not.toHaveProperty('isActive');
    expect(createServiceRateSchema.parse(payload)).toMatchObject({ standardRate, serviceStream: 'HOSPITAL' });
  });

  it('omits category and status on edit so existing database values survive', async () => {
    await ServiceRatesService.updateService('service-id', values);
    const payload = JSON.parse(JSON.stringify(patch.mock.calls[0][1]));
    const parsed = updateServiceRateSchema.parse(payload);
    expect(parsed).not.toHaveProperty('category');
    expect(parsed).not.toHaveProperty('isActive');
    expect({ category: 'Diagnostic', isActive: false, ...parsed }).toMatchObject({
      category: 'Diagnostic', isActive: false, standardRate: 0,
    });
  });

  it('retains the existing outsourced storage stream and chosen database department', async () => {
    await ServiceRatesService.createService({ ...values, serviceStream: 'LAB' });
    expect(createServiceRateSchema.parse(post.mock.calls[0][1])).toMatchObject({
      serviceStream: 'LAB', departmentId: values.departmentId,
    });
  });

  it('continues to accept explicit category and status from existing import callers', async () => {
    await ServiceRatesService.createService({ ...values, category: 'Other', status: 'Inactive' });
    expect(createServiceRateSchema.parse(post.mock.calls[0][1])).toMatchObject({
      category: 'Other', isActive: false,
    });
  });

  it('rejects negative rates before sending a save request', async () => {
    await expect(ServiceRatesService.createService({ ...values, standardRate: -1 })).rejects.toThrow();
    await expect(ServiceRatesService.updateService('service-id', { ...values, standardRate: -1 })).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    expect(createServiceRateSchema.safeParse({ ...values, standardRate: -1 }).success).toBe(false);
  });
});
