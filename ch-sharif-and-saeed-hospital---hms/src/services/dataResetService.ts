import apiClient from './apiClient';

export interface ResetSummary {
  appointments: number;
  invoices: number;
  invoiceLines: number;
  paymentReceipts: number;
  userCashBalances: number;
  accountSettlements: number;
  providerSettlements: number;
  admissions: number;
  selfPayEncounters: number;
  panelPatients: number;
  corporatePanels: number;
  pharmacyClearances: number;
  pharmacyDispenses: number;
  pharmacyDispenseLines: number;
  resetBeds: number;
}

export interface ResetResponse {
  success: boolean;
  summary: ResetSummary;
}

export const dataResetService = {
  resetTransactionalData: async (): Promise<ResetResponse> => {
    const res = await apiClient.post<{ data: ResetResponse }>('/setup/reset-transactional-data');
    return res.data.data;
  },
};
