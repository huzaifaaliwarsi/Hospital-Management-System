import apiClient from './apiClient';
import { formatDisplayDate } from '../utils/dateConstants';

/**
 * Live Doctor Commission service — backed by `/api/v1/commission/rules`
 * (already-existing backend, unused by the frontend until now). Commission
 * Tax fields are new (HMS_V7.2_NEW_REQUIREMENTS.md §2.7) — independent of
 * any Salary Tax on the doctor's Salary Profile.
 */

export type CommissionRuleType = 'FIXED_PER_SERVICE' | 'PERCENTAGE';
export type CommissionBasis = 'GROSS' | 'NET';
export type CommissionTaxMethod = 'PERCENTAGE' | 'FIXED' | '';

export interface CommissionRule {
  id: string;
  staffId: string;
  doctorName: string;
  doctorDesignation: string;
  serviceRateId: string | null;
  serviceName: string | null;
  ruleType: CommissionRuleType;
  rate: number;
  basis: CommissionBasis;
  commissionTaxMethod: CommissionTaxMethod;
  commissionTaxValue: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
}

export interface CommissionRuleFormValues {
  staffId: string;
  serviceRateId: string;
  ruleType: CommissionRuleType;
  rate: number | '';
  basis: CommissionBasis;
  commissionTaxMethod: CommissionTaxMethod;
  commissionTaxValue: number | '';
  effectiveFrom: string;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDisplayDate(d);
}

function toCommissionRule(raw: Record<string, any>): CommissionRule {
  return {
    id: raw.id,
    staffId: raw.staffId,
    doctorName: raw.doctor?.fullName || '',
    doctorDesignation: raw.doctor?.designation || '',
    serviceRateId: raw.serviceRateId || null,
    serviceName: raw.serviceRate?.name || null,
    ruleType: raw.ruleType,
    rate: Number(raw.rate ?? 0),
    basis: raw.basis,
    commissionTaxMethod: raw.commissionTaxMethod || '',
    commissionTaxValue: raw.commissionTaxValue != null ? Number(raw.commissionTaxValue) : null,
    effectiveFrom: formatDate(raw.effectiveFrom),
    effectiveTo: raw.effectiveTo ? formatDate(raw.effectiveTo) : null,
    createdAt: formatDate(raw.createdAt),
  };
}

export async function fetchCommissionRules(staffId?: string): Promise<CommissionRule[]> {
  const res = await apiClient.get<{ data: Record<string, any>[] }>('/commission/rules', {
    params: staffId ? { staffId } : undefined,
  });
  return res.data.data.map(toCommissionRule);
}

export async function createCommissionRule(values: CommissionRuleFormValues): Promise<CommissionRule> {
  const res = await apiClient.post<{ data: Record<string, any> }>('/commission/rules', {
    staffId: values.staffId,
    serviceRateId: values.serviceRateId || undefined,
    ruleType: values.ruleType,
    rate: Number(values.rate) || 0,
    basis: values.basis,
    commissionTaxMethod: values.commissionTaxMethod || undefined,
    commissionTaxValue: values.commissionTaxValue === '' ? undefined : Number(values.commissionTaxValue),
    effectiveFrom: values.effectiveFrom,
  });
  return toCommissionRule(res.data.data);
}
