import apiClient from './apiClient';
import {
  HospitalService,
  ServiceCategory,
  BillingUnit,
  ServiceFilterState,
  ServiceFormValues,
  ServiceImportRow,
  ServiceImportValidationResult,
} from '../types/serviceRates';
import { User } from '../types';
import { DepartmentService } from './departmentService';
import { getHospitalProfile } from './hospitalProfileService';
import { formatDisplayDate } from '../utils/dateConstants';
import { generateNextCode } from '../utils/codeGenerator';

/**
 * Live Services & Rates service — every read/write round-trips through
 * `/api/v1/setup/services-rates*`. Same in-memory-cache pattern as
 * `departmentService.ts`: `cachedServices` mirrors the last real fetch
 * (never localStorage) so synchronous readers (`getServices`, `getKPIs`,
 * `filterServices`) keep working for the KPI bar / filter bar.
 */

export const VALID_SERVICE_CATEGORIES: ServiceCategory[] = [
  'Consultation',
  'Emergency',
  'Observation',
  'Admission',
  'Room / Bed',
  'Procedure',
  'Surgery',
  'Diagnostic',
  'Laboratory',
  'Radiology',
  'Nursing',
  'Miscellaneous',
  'Other',
];

export const VALID_BILLING_UNITS: BillingUnit[] = [
  'Per Visit',
  'Per Consultation',
  'Per Procedure',
  'Per Test',
  'Per Day',
  'Per Hour',
  'Per Session',
  'Per Unit',
  'One-Time',
  'Other',
];

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dateStr = formatDisplayDate(d);
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

/** Maps a backend service-rate row (as returned by `setup.service.ts`) onto the frontend `HospitalService` shape. */
function toHospitalService(raw: Record<string, any>): HospitalService {
  return {
    providerType: raw.providerType,
    billingSource: raw.billingSource,
    selectable: raw.selectable,
    outsourcedProviderId: raw.department?.outsourcedProviderId,
    id: raw.id,
    code: raw.code,
    name: raw.name,
    description: raw.description || '',
    departmentId: raw.departmentId ?? null,
    departmentName: raw.department?.name || '',
    category: (raw.category as ServiceCategory) || 'Other',
    standardRate: Number(raw.standardRate ?? 0),
    currency: getHospitalProfile().currency || 'PKR',
    billingUnit: (raw.billingUnit as BillingUnit) || 'Other',
    panelEligible: !!raw.panelEligible,
    manualRateOverrideAllowed: !!raw.manualRateOverrideAllowed,
    discountAllowed: !!raw.discountAllowed,
    status: raw.isActive ? 'Active' : 'Inactive',
    encounterType: (raw.encounterType as any) || 'NONE',
    isDefaultEncounterService: !!raw.isDefaultEncounterService,
    serviceStream: raw.serviceStream || (
      raw.category === 'Laboratory' ||
      raw.category === 'Diagnostic' ||
      raw.category === 'Radiology' ||
      (raw.department?.name || '').toLowerCase().includes('lab')
        ? 'LAB'
        : 'HOSPITAL'
    ),
    linkedInvoiceCount: raw.linkedInvoiceCount ?? 0,
    linkedPanelRuleCount: raw.linkedPanelRuleCount ?? 0,
    createdBy: raw.createdByLabel || 'System',
    createdAt: formatTimestamp(raw.createdAt),
    updatedBy: raw.updatedByLabel || 'System',
    updatedAt: formatTimestamp(raw.updatedAt),
    statusChangedBy: raw.statusChangedBy || undefined,
    statusChangedAt: raw.statusChangedAt ? formatTimestamp(raw.statusChangedAt) : undefined,
  };
}

function toBackendPayload(values: ServiceFormValues): Record<string, unknown> {
  return {
    code: values.code.trim() ? values.code.trim().toUpperCase() : undefined,
    name: values.name.trim(),
    providerType: values.providerType,
    description: values.description?.trim() || undefined,
    departmentId: values.departmentId || null,
    category: values.category,
    billingUnit: values.billingUnit,
    standardRate: Number(values.standardRate) || 0,
    panelEligible: values.panelEligible,
    discountAllowed: values.discountAllowed,
    manualRateOverrideAllowed: values.manualRateOverrideAllowed,
    isActive: values.status === undefined ? undefined : values.status === 'Active',
    encounterType: values.encounterType || 'NONE',
    isDefaultEncounterService: !!values.isDefaultEncounterService,
    serviceStream: values.serviceStream || 'HOSPITAL',
  };
}

let cachedServices: HospitalService[] = [];

export async function fetchNextServiceCode(): Promise<string> {
  try {
    const res = await apiClient.get<{ data: { nextCode: string } }>('/setup/services-rates/next-code');
    return res.data?.data?.nextCode || '';
  } catch {
    return '';
  }
}

export interface ServiceQuery { providerType?: 'INTERNAL' | 'OUTSOURCED'; departmentId?: string; outsourcedProviderId?: string; status?: 'ACTIVE' | 'INACTIVE' }
export async function fetchServices(filters: ServiceQuery = {}): Promise<HospitalService[]> {
  const res = await apiClient.get<{ data: Record<string, any>[] }>('/setup/services-rates', { params: { providerType: 'INTERNAL', status: 'ACTIVE', ...filters, selectable: true } });
  const rows = res.data.data.map(toHospitalService);
  const existingMap = new Map(cachedServices.map((s) => [s.id, s]));
  rows.forEach((r) => existingMap.set(r.id, r));
  cachedServices = Array.from(existingMap.values());
  return rows;
}

/** Async warm-up — call once at app startup so sync readers below have real data. */
export async function primeServicesCache(): Promise<void> {
  try {
    await fetchServices();
  } catch {
    // Leave cache empty; the Services & Rates page itself will surface the real error on its own fetch.
  }
}

export class ServiceRatesService {
  /** Synchronous read of the last real fetch — never localStorage. */
  static getServices(): HospitalService[] {
    return cachedServices;
  }

  static async getNextCode(existingServices?: HospitalService[]): Promise<string> {
    const serverCode = await fetchNextServiceCode();
    if (serverCode) return serverCode;
    const allKnown = [
      ...cachedServices,
      ...(existingServices || []),
    ];
    return generateNextCode(allKnown.map((s) => s.code), 'SRV', 3);
  }

  /** No-op kept for interface stability: persistence now happens per-mutation against the real backend. */
  static saveServices(_services: HospitalService[]): void {
    // Intentionally empty.
  }

  static getServiceById(id: string): HospitalService | undefined {
    return cachedServices.find((s) => s.id === id);
  }

  static validateServiceCode(code: string, currentId?: string, additionalServices?: HospitalService[]): { isValid: boolean; message?: string } {
    const trimmed = code.trim().toUpperCase();
    // Optional — left blank, the backend auto-generates a unique code.
    if (!trimmed) return { isValid: true };
    const validPattern = /^[A-Z0-9-]+$/;
    if (!validPattern.test(trimmed)) {
      return { isValid: false, message: 'Code must contain uppercase letters, numbers, and hyphens only.' };
    }
    const all = [...cachedServices, ...(additionalServices || [])];
    const isDuplicate = all.some((s) => s.code.toUpperCase() === trimmed && s.id !== currentId);
    if (isDuplicate) {
      return { isValid: false, message: `Service code "${trimmed}" already exists in master catalog.` };
    }
    return { isValid: true };
  }

  /** `POST /setup/services-rates` */
  static async createService(values: ServiceFormValues, _currentUser?: User | null): Promise<HospitalService> {
    if (values.standardRate < 0) throw new Error('Standard rate cannot be negative.');
    const dept = DepartmentService.getDepartmentById(values.departmentId);
    if (dept && dept.status !== 'Active') {
      throw new Error('Cannot create new service under an Inactive department.');
    }
    const res = await apiClient.post<{ data: Record<string, any> }>('/setup/services-rates', toBackendPayload(values));
    const created = toHospitalService(res.data.data);
    cachedServices = [created, ...cachedServices];
    return created;
  }

  /** `PATCH /setup/services-rates/:id` */
  static async updateService(id: string, values: ServiceFormValues, _currentUser?: User | null): Promise<HospitalService> {
    if (values.standardRate < 0) throw new Error('Standard rate cannot be negative.');
    const res = await apiClient.patch<{ data: Record<string, any> }>(`/setup/services-rates/${id}`, toBackendPayload(values));
    const updated = toHospitalService(res.data.data);
    cachedServices = cachedServices.map((s) => (s.id === id ? updated : s));
    return updated;
  }

  /** `PATCH /setup/services-rates/:id` (isActive:true) or `POST /setup/services-rates/:id/deactivate` */
  static async changeServiceStatus(id: string, newStatus: 'Active' | 'Inactive', _currentUser?: User | null): Promise<HospitalService> {
    const res =
      newStatus === 'Inactive'
        ? await apiClient.post<{ data: Record<string, any> }>(`/setup/services-rates/${id}/deactivate`)
        : await apiClient.patch<{ data: Record<string, any> }>(`/setup/services-rates/${id}`, { isActive: true });
    const updated = toHospitalService(res.data.data);
    cachedServices = cachedServices.map((s) => (s.id === id ? updated : s));
    return updated;
  }

  /** Permanently deletes an unbilled service from the database. */
  static async deleteService(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      await apiClient.delete(`/setup/services-rates/${id}`);
      cachedServices = cachedServices.filter((s) => s.id !== id);
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to delete service.';
      return { success: false, message: msg };
    }
  }

  static async updateBulkDiscount(payload: {
    scope: 'ALL' | 'DEPARTMENT' | 'SERVICE';
    departmentId?: string;
    serviceRateIds?: string[];
    discountAllowed: boolean;
  }): Promise<{ count: number; discountAllowed: boolean }> {
    const res = await apiClient.post<{ data: { count: number; discountAllowed: boolean } }>(
      '/setup/services-rates/bulk-discount',
      payload
    );
    // Invalidate local cachedServices so next fetch gets latest
    cachedServices = cachedServices.map((s) => {
      if (payload.scope === 'ALL') {
        return { ...s, discountAllowed: payload.discountAllowed };
      }
      if (payload.scope === 'DEPARTMENT' && s.departmentId === payload.departmentId) {
        return { ...s, discountAllowed: payload.discountAllowed };
      }
      if (payload.scope === 'SERVICE' && payload.serviceRateIds?.includes(s.id)) {
        return { ...s, discountAllowed: payload.discountAllowed };
      }
      return s;
    });
    return res.data.data;
  }

  static filterServices(services: HospitalService[], filters: ServiceFilterState): HospitalService[] {
    return services.filter((s) => {
      if (s.providerType !== (filters.providerType ?? 'INTERNAL')) return false;
      if (filters.searchTerm.trim()) {
        const query = filters.searchTerm.toLowerCase().trim();
        const matchCode = s.code.toLowerCase().includes(query);
        const matchName = s.name.toLowerCase().includes(query);
        const matchDept = s.departmentName.toLowerCase().includes(query);
        if (!matchCode && !matchName && !matchDept) return false;
      }
      if (filters.departmentId !== 'All' && String(s.departmentId) !== String(filters.departmentId)) return false;
      if (filters.category !== 'All' && s.category !== filters.category) return false;
      if (filters.panelEligible !== 'All') {
        const isEligible = filters.panelEligible === 'Yes';
        if (s.panelEligible !== isEligible) return false;
      }
      if (filters.status !== 'All' && s.status !== filters.status) return false;
      return true;
    });
  }

  static getKPIs(services: HospitalService[]) {
    const totalServices = services.length;
    const activeServices = services.filter((s) => s.status === 'Active').length;
    const clinicalServices = services.filter((s) =>
      ['Consultation', 'Emergency', 'Observation', 'Admission', 'Room / Bed'].includes(s.category)
    ).length;
    const diagnosticProcedureServices = services.filter((s) =>
      ['Diagnostic', 'Laboratory', 'Radiology', 'Procedure', 'Surgery'].includes(s.category)
    ).length;
    const panelEligibleServices = services.filter((s) => s.panelEligible).length;

    return { totalServices, activeServices, clinicalServices, diagnosticProcedureServices, panelEligibleServices };
  }

  static validateImportRows(
    rawRows: any[],
    existingServices: HospitalService[],
    departmentsList?: { id: string; code: string; name: string; status?: string }[]
  ): ServiceImportValidationResult {
    const departments = departmentsList && departmentsList.length > 0 ? departmentsList : DepartmentService.getDepartments();
    const deptMap = new Map<string, any>();
    departments.forEach((d) => {
      if (d.code) deptMap.set(d.code.toUpperCase().trim(), d);
      if (d.name) deptMap.set(d.name.toUpperCase().trim(), d);
    });

    const existingCodeSet = new Set(existingServices.map((s) => s.code.toUpperCase()));
    const seenFileCodes = new Set<string>();

    const validRows: ServiceImportRow[] = [];
    const invalidRows: ServiceImportRow[] = [];

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const errors: string[] = [];

      // Support camelCase, snake_case, and spaced Excel title headers
      const rawCode = String(row.service_code || row.code || row['Service Code'] || row['Code'] || '').trim().toUpperCase();
      const rawName = String(row.service_name || row.name || row['Service Name'] || row['Name'] || '').trim();
      const rawDeptKey = String(row.department_code || row.dept_code || row.department || row['Department Code'] || row['Department'] || row['Dept Code'] || '').trim().toUpperCase();
      const rawCatInput = String(row.category || row['Category'] || '').trim();
      const rawDesc = String(row.description || row['Description'] || '').trim();
      const rawUnitInput = String(row.billing_unit || row.unit || row['Billing Unit'] || row['Unit'] || 'Per Procedure').trim();
      const rawRate = Number(row.standard_rate ?? row.rate ?? row['Standard Rate'] ?? row['Rate'] ?? row['Price']);
      const rawPanel = String(row.panel_eligible || row['Panel Eligible'] || '').trim().toLowerCase();
      const rawDiscount = String(row.discount_allowed || row['Discount Allowed'] || '').trim().toLowerCase();
      const rawOverride = String(row.manual_rate_override_allowed || row['Manual Rate Override Allowed'] || '').trim().toLowerCase();
      const rawStatus = String(row.status || row['Status'] || 'Active').trim();

      // Normalize category (case-insensitive lookup against valid categories)
      const matchedCat = VALID_SERVICE_CATEGORIES.find(
        (c) => c.toLowerCase() === rawCatInput.toLowerCase()
      ) || (rawCatInput ? (VALID_SERVICE_CATEGORIES.find((c) => c.toLowerCase().includes(rawCatInput.toLowerCase())) || 'Other') : undefined);

      // Normalize billing unit (case-insensitive lookup against valid units)
      const matchedUnit = VALID_BILLING_UNITS.find(
        (u) => u.toLowerCase() === rawUnitInput.toLowerCase()
      ) || (VALID_BILLING_UNITS.find((u) => u.toLowerCase().includes(rawUnitInput.toLowerCase())) || 'One-Time');

      // Code is optional — left blank, auto-generated
      if (rawCode) {
        if (!/^[A-Z0-9_-]+$/.test(rawCode)) {
          errors.push('Code must contain uppercase letters, numbers, hyphens, and underscores only.');
        } else if (existingCodeSet.has(rawCode)) {
          errors.push(`Service code "${rawCode}" already exists in master catalog.`);
        } else if (seenFileCodes.has(rawCode)) {
          errors.push(`Duplicate code "${rawCode}" found within uploaded file.`);
        } else {
          seenFileCodes.add(rawCode);
        }
      }

      if (!rawName) errors.push('Missing service name.');

      const matchedDept = rawDeptKey ? deptMap.get(rawDeptKey) : (departments.length > 0 ? departments[0] : undefined);
      if (!rawDeptKey && departments.length === 0) {
        errors.push('Missing department code or name.');
      } else if (rawDeptKey && !matchedDept) {
        errors.push(`Department "${rawDeptKey}" not recognized in hospital directory.`);
      }

      if (!matchedCat) {
        errors.push(`Missing or invalid category "${rawCatInput}". Valid: ${VALID_SERVICE_CATEGORIES.join(', ')}.`);
      }

      if (isNaN(rawRate) || rawRate < 0) errors.push('Standard rate must be a non-negative number.');

      const normalizedStatus: 'Active' | 'Inactive' = rawStatus.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
      const panelEligible = ['true', 'yes', '1', 'y'].includes(rawPanel);
      const discountAllowed = ['true', 'yes', '1', 'y'].includes(rawDiscount);
      const manualRateOverrideAllowed = ['true', 'yes', '1', 'y'].includes(rawOverride);

      const parsedRow: ServiceImportRow = {
        rowNumber: rowNum,
        serviceCode: rawCode || `SRV-${Date.now().toString(36).toUpperCase()}-${idx + 1}`,
        serviceName: rawName,
        departmentCode: matchedDept ? matchedDept.code : rawDeptKey,
        category: (matchedCat || 'Other') as ServiceCategory,
        description: rawDesc,
        billingUnit: (matchedUnit || 'One-Time') as BillingUnit,
        standardRate: isNaN(rawRate) ? 0 : rawRate,
        panelEligible,
        discountAllowed,
        manualRateOverrideAllowed,
        status: normalizedStatus,
        isValid: errors.length === 0,
        errors,
      };

      if (errors.length === 0) validRows.push(parsedRow);
      else invalidRows.push(parsedRow);
    });

    return { totalRows: rawRows.length, validRows, invalidRows };
  }

  /**
   * Persists each validated import row against the real backend, one
   * `POST /setup/services-rates` at a time. Returns { imported, failures }.
   */
  static async importServices(
    validRows: ServiceImportRow[],
    _currentUser?: User | null,
    departmentsList?: { id: string; code: string; name: string }[]
  ): Promise<{ imported: number; failures: string[] }> {
    const departments = departmentsList && departmentsList.length > 0 ? departmentsList : DepartmentService.getDepartments();
    const deptMap = new Map<string, any>();
    departments.forEach((d) => {
      if (d.code) deptMap.set(d.code.toUpperCase().trim(), d);
      if (d.name) deptMap.set(d.name.toUpperCase().trim(), d);
    });

    const failures: string[] = [];
    let imported = 0;

    for (const r of validRows) {
      const dept = deptMap.get(r.departmentCode.toUpperCase().trim()) || (departments.length > 0 ? departments[0] : null);
      if (!dept) {
        failures.push(`${r.serviceCode}: department "${r.departmentCode}" not found`);
        continue;
      }
      try {
        await ServiceRatesService.createService({
          code: r.serviceCode,
          name: r.serviceName,
          description: r.description || '',
          departmentId: dept.id,
          category: r.category as ServiceCategory,
          standardRate: r.standardRate,
          billingUnit: r.billingUnit as BillingUnit,
          panelEligible: r.panelEligible,
          manualRateOverrideAllowed: r.manualRateOverrideAllowed,
          discountAllowed: r.discountAllowed,
          status: r.status,
        });
        imported += 1;
      } catch (err: any) {
        failures.push(`${r.serviceCode}: ${err?.message || 'Failed to import'}`);
      }
    }

    return { imported, failures };
  }
}
