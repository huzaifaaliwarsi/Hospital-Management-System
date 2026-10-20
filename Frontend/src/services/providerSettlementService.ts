import apiClient from './apiClient';
import { formatDisplayDate } from '../utils/dateConstants';
import type { PaymentMethod } from './outsourcedProviderService';

/** Provider eligibility and settlement limits are computed by the server. */

export interface ProviderSettlement {
  id: string;
  outsourcedProviderId: string;
  providerName: string;
  providerCode: string;
  departmentId: string | null;
  departmentName: string | null;
  periodLabel: string;
  eligibleRealizedAmount: number;
  alreadySettledAmount: number;
  settlementAmount: number;
  remainingAfter: number;
  status: 'FULL' | 'PARTIAL';
  paymentMethod: PaymentMethod;
  paymentReference: string;
  representativeName: string;
  representativeDesignation: string;
  remarks: string;
  settledBy: string;
  settledAt: string;
}

export interface ProviderSettlementFormValues {
  requestKey: string;
  outsourcedProviderId: string;
  departmentId: string;
  periodLabel: string;
  eligibleRealizedAmount: number;
  settlementAmount: number;
  status: 'FULL' | 'PARTIAL';
  paymentMethod: PaymentMethod;
  paymentReference: string;
  representativeName: string;
  representativeDesignation: string;
  remarks: string;
}

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dateStr = formatDisplayDate(d);
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

function toSettlement(raw: Record<string, any>): ProviderSettlement {
  const eligible = Number(raw.eligibleRealizedAmount ?? 0);
  const alreadySettled = Number(raw.alreadySettledAmount ?? 0);
  const settlementAmount = Number(raw.settlementAmount ?? 0);
  return {
    id: raw.id,
    outsourcedProviderId: raw.outsourcedProviderId,
    providerName: raw.outsourcedProvider?.name || '',
    providerCode: raw.outsourcedProvider?.code || '',
    departmentId: raw.departmentId || null,
    departmentName: raw.department?.name || null,
    periodLabel: raw.periodLabel || '',
    eligibleRealizedAmount: eligible,
    alreadySettledAmount: alreadySettled,
    settlementAmount,
    remainingAfter: Math.max(0, eligible - alreadySettled - settlementAmount),
    status: raw.status,
    paymentMethod: raw.paymentMethod,
    paymentReference: raw.paymentReference || '',
    representativeName: raw.representativeName || '',
    representativeDesignation: raw.representativeDesignation || '',
    remarks: raw.remarks || '',
    settledBy: raw.settledByLabel || 'System',
    settledAt: formatTimestamp(raw.settledAt),
  };
}

export async function fetchProviderSettlements(outsourcedProviderId?: string): Promise<ProviderSettlement[]> {
  const res = await apiClient.get<{ data: Record<string, any>[] }>('/setup/provider-settlements', {
    params: outsourcedProviderId ? { outsourcedProviderId } : undefined,
  });
  return res.data.data.map(toSettlement);
}

export async function createProviderSettlement(values: ProviderSettlementFormValues): Promise<ProviderSettlement> {
  const res = await apiClient.post<{ data: Record<string, any> }>('/setup/provider-settlements', {
    requestKey: values.requestKey,
    outsourcedProviderId: values.outsourcedProviderId,
    departmentId: values.departmentId || undefined,
    periodLabel: values.periodLabel?.trim() || undefined,
    eligibleRealizedAmount: values.eligibleRealizedAmount,
    settlementAmount: values.settlementAmount,
    status: values.status,
    paymentMethod: values.paymentMethod,
    paymentReference: values.paymentReference?.trim() || undefined,
    representativeName: values.representativeName?.trim() || undefined,
    representativeDesignation: values.representativeDesignation?.trim() || undefined,
    remarks: values.remarks?.trim() || undefined,
  });
  return toSettlement(res.data.data);
}

export interface DepartmentPayableRow {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  fulfillmentOwnership: 'INTERNAL' | 'OUTSOURCED';
  outsourcedProvider: {
    id: string;
    name: string;
    code: string;
    allowedPaymentMethods: PaymentMethod[];
    settlementCycle: string | null;
    isActive: boolean;
  } | null;
  invoicesCount: number;
  servicesCount: number;
  periodGross: number;
  periodDiscount: number;
  periodBilled: number;
  periodRealized: number;
  alreadySettled: number;
  remainingPayable: number;
  cumulativeRealized: number;
  periodSettled: number;
  openingBalance: number;
  closingBalance: number;
  requiresSettlementReconciliation: boolean;
}

export interface DepartmentPayablesResponse {
  period: { label: string; start: string; end: string };
  kpis: {
    totalBilled: number;
    totalRealized: number;
    totalSettled: number;
    totalRemaining: number;
  };
  departments: DepartmentPayableRow[];
}

export async function fetchDepartmentPayablesSummary(params: {
  preset?: string;
  fromDate?: string;
  toDate?: string;
  type?: string;
}): Promise<DepartmentPayablesResponse> {
  const res = await apiClient.get<{ data: DepartmentPayablesResponse }>('/setup/department-payables-summary', {
    params,
  });
  return res.data.data;
}
