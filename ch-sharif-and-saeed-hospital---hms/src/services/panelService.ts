import apiClient from './apiClient';
import { formatDisplayDate } from '../utils/dateConstants';

/**
 * Live Corporate Panels service — backed by `/api/v1/setup/corporate-panels`.
 * Same in-memory-cache pattern as the other rewired services — never a
 * hardcoded demo list.
 */
export interface PanelDiscountRule {
  id: string;
  serviceRateId: string;
  serviceCode?: string;
  serviceName?: string;
  discountPercent: number;
  // v7.2 Panel Management enhancements (HMS_V7.2_NEW_REQUIREMENTS.md §2.5) —
  // additive/optional; `discountPercent` above stays the legacy simple
  // knock-off. `coveragePercent` is what the panel actually pays — the
  // complement is the patient's co-pay share.
  coveragePercent?: number;
  preauthorizationRequired?: boolean;
  capAmount?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface CorporatePanel {
  id: string;
  code: string;
  name: string;
  category: string;
  discountAgreement: string;
  contact: string;
  address: string;
  notes: string;
  creditLimit: number;
  activePatientsCount: number;
  discountRules: PanelDiscountRule[];
  status: 'Active' | 'Inactive';
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dateStr = formatDisplayDate(d);
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

function toCorporatePanel(raw: Record<string, any>): CorporatePanel {
  return {
    id: raw.id,
    code: raw.code || raw.id.slice(0, 8).toUpperCase(),
    name: raw.organizationName,
    category: raw.category || 'Corporate Enterprise',
    discountAgreement: raw.discountAgreement || '',
    contact: raw.contact || '',
    address: raw.address || '',
    notes: raw.notes || '',
    creditLimit: Number(raw.creditLimit ?? 0),
    activePatientsCount: raw.activePatientsCount ?? 0,
    discountRules: (raw.discountRules || []).map((r: any) => ({
      id: r.id,
      serviceRateId: r.serviceRateId,
      discountPercent: Number(r.discountPercent),
      effectiveFrom: r.effectiveFrom ? String(r.effectiveFrom).slice(0, 10) : '',
      effectiveTo: r.effectiveTo ? String(r.effectiveTo).slice(0, 10) : undefined,
    })),
    status: raw.isActive ? 'Active' : 'Inactive',
    createdBy: raw.createdByLabel || 'System',
    createdAt: formatTimestamp(raw.createdAt),
    updatedBy: raw.updatedByLabel || 'System',
    updatedAt: formatTimestamp(raw.updatedAt),
  };
}

let cachedPanels: CorporatePanel[] = [];

export async function fetchCorporatePanels(): Promise<CorporatePanel[]> {
  const res = await apiClient.get<{ data: Record<string, any>[] }>('/setup/corporate-panels');
  cachedPanels = res.data.data.map(toCorporatePanel);
  return cachedPanels;
}

export async function primeCorporatePanelsCache(): Promise<void> {
  try {
    await fetchCorporatePanels();
  } catch {
    // Leave cache empty; consuming pages surface the real error on their own fetch.
  }
}

export function getActiveCorporatePanels(): CorporatePanel[] {
  return cachedPanels.filter((p) => p.status === 'Active');
}

export function getAllCorporatePanels(): CorporatePanel[] {
  return cachedPanels;
}

export function getPanelById(id: string): CorporatePanel | undefined {
  return cachedPanels.find((p) => p.id === id);
}

export function getPanelByCode(code: string): CorporatePanel | undefined {
  const norm = code.trim().toUpperCase();
  return cachedPanels.find((p) => p.code.toUpperCase() === norm || p.id.toUpperCase() === norm);
}

export interface CorporatePanelFormValues {
  code: string;
  organizationName: string;
  category: string;
  discountAgreement: string;
  contact: string;
  address: string;
  notes: string;
  creditLimit: number;
  isActive: boolean;
}

/** `POST /setup/corporate-panels` */
export async function createCorporatePanel(values: CorporatePanelFormValues): Promise<CorporatePanel> {
  const res = await apiClient.post<{ data: Record<string, any> }>('/setup/corporate-panels', {
    code: values.code.trim().toUpperCase() || undefined,
    organizationName: values.organizationName.trim(),
    category: values.category || undefined,
    discountAgreement: values.discountAgreement?.trim() || undefined,
    contact: values.contact?.trim() || undefined,
    address: values.address?.trim() || undefined,
    notes: values.notes?.trim() || undefined,
    creditLimit: values.creditLimit,
  });
  const created = toCorporatePanel(res.data.data);
  cachedPanels = [created, ...cachedPanels];
  return created;
}

/** `PATCH /setup/corporate-panels/:id` */
export async function updateCorporatePanel(id: string, values: CorporatePanelFormValues): Promise<CorporatePanel> {
  const res = await apiClient.patch<{ data: Record<string, any> }>(`/setup/corporate-panels/${id}`, {
    code: values.code.trim().toUpperCase() || undefined,
    organizationName: values.organizationName.trim(),
    category: values.category || undefined,
    discountAgreement: values.discountAgreement?.trim() || undefined,
    contact: values.contact?.trim() || undefined,
    address: values.address?.trim() || undefined,
    notes: values.notes?.trim() || undefined,
    creditLimit: values.creditLimit,
    isActive: values.isActive,
  });
  const updated = toCorporatePanel(res.data.data);
  cachedPanels = cachedPanels.map((p) => (p.id === id ? updated : p));
  return updated;
}

/** `PATCH /setup/corporate-panels/:id` (isActive toggle only) */
export async function toggleCorporatePanelStatus(id: string, isActive: boolean): Promise<CorporatePanel> {
  const res = await apiClient.patch<{ data: Record<string, any> }>(`/setup/corporate-panels/${id}`, { isActive });
  const updated = toCorporatePanel(res.data.data);
  cachedPanels = cachedPanels.map((p) => (p.id === id ? updated : p));
  return updated;
}

/** `PUT /setup/corporate-panels/:id/discount-rules` — replaces the full rule set for the panel. */
export async function replaceDiscountRules(
  id: string,
  rules: {
    serviceRateId: string;
    discountPercent: number;
    coveragePercent?: number;
    preauthorizationRequired?: boolean;
    capAmount?: number;
    effectiveFrom: string;
    effectiveTo?: string;
  }[]
): Promise<PanelDiscountRule[]> {
  const res = await apiClient.put<{ data: Record<string, any>[] }>(`/setup/corporate-panels/${id}/discount-rules`, { rules });
  const discountRules = res.data.data.map((r) => ({
    id: r.id,
    serviceRateId: r.serviceRateId,
    discountPercent: Number(r.discountPercent),
    coveragePercent: r.coveragePercent != null ? Number(r.coveragePercent) : undefined,
    preauthorizationRequired: !!r.preauthorizationRequired,
    capAmount: r.capAmount != null ? Number(r.capAmount) : undefined,
    effectiveFrom: String(r.effectiveFrom).slice(0, 10),
    effectiveTo: r.effectiveTo ? String(r.effectiveTo).slice(0, 10) : undefined,
  }));
  cachedPanels = cachedPanels.map((p) => (p.id === id ? { ...p, discountRules } : p));
  return discountRules;
}

/** `DELETE /setup/corporate-panels/:id` */
export async function deleteCorporatePanel(id: string): Promise<void> {
  await apiClient.delete(`/setup/corporate-panels/${id}`);
  cachedPanels = cachedPanels.filter((p) => p.id !== id);
}
