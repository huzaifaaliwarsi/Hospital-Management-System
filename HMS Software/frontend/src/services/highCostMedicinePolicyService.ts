import apiClient from './apiClient';

/**
 * Live High-Cost Medicine Authorization Policy service — singleton config
 * backed by `/api/v1/setup/high-cost-medicine-policy`
 * (HMS_V7.2_NEW_REQUIREMENTS.md §2.6).
 */

export type ThresholdBasis = 'LINE_TOTAL' | 'PER_UNIT';
export type CombinedLogic = 'ATTENDANT_ONLY' | 'MANAGEMENT_ONLY' | 'EITHER' | 'BOTH';

export const COMBINED_LOGIC_LABELS: Record<CombinedLogic, string> = {
  ATTENDANT_ONLY: 'Attendant Confirmation Only',
  MANAGEMENT_ONLY: 'Admin / Super Admin Approval Only',
  EITHER: 'Either One (Attendant OR Management)',
  BOTH: 'Both Required (Attendant AND Management)',
};

export interface HighCostMedicinePolicy {
  id: string;
  enabled: boolean;
  thresholdAmount: number;
  thresholdBasis: ThresholdBasis;
  attendantConfirmationRequired: boolean;
  managementApprovalRequired: boolean;
  combinedLogic: CombinedLogic;
  panelPreauthRequired: boolean;
  updatedBy: string;
  updatedAt: string;
}

function toPolicy(raw: Record<string, any>): HighCostMedicinePolicy {
  return {
    id: raw.id,
    enabled: !!raw.enabled,
    thresholdAmount: Number(raw.thresholdAmount ?? 0),
    thresholdBasis: raw.thresholdBasis || 'LINE_TOTAL',
    attendantConfirmationRequired: !!raw.attendantConfirmationRequired,
    managementApprovalRequired: !!raw.managementApprovalRequired,
    combinedLogic: raw.combinedLogic || 'BOTH',
    panelPreauthRequired: !!raw.panelPreauthRequired,
    updatedBy: raw.updatedByLabel || 'System',
    updatedAt: raw.updatedAt || '',
  };
}

export async function fetchHighCostMedicinePolicy(): Promise<HighCostMedicinePolicy> {
  const res = await apiClient.get<{ data: Record<string, any> }>('/setup/high-cost-medicine-policy');
  return toPolicy(res.data.data);
}

export async function updateHighCostMedicinePolicy(values: {
  enabled: boolean;
  thresholdAmount: number;
  thresholdBasis: ThresholdBasis;
  attendantConfirmationRequired: boolean;
  managementApprovalRequired: boolean;
  combinedLogic: CombinedLogic;
  panelPreauthRequired: boolean;
}): Promise<HighCostMedicinePolicy> {
  const res = await apiClient.put<{ data: Record<string, any> }>('/setup/high-cost-medicine-policy', values);
  return toPolicy(res.data.data);
}
