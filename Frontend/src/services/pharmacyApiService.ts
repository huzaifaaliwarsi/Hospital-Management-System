import apiClient from './apiClient';

export interface BackendMedicine {
  id: string;
  code: string;
  name: string;
  category?: string;
  unit: string;
  batchManaged: boolean;
  purchaseRate?: string | number;
  saleRate?: string | number;
  currentStock: string | number;
  batchesCount: number;
}

export interface BackendBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  costRate: string | number;
  currentStock: string | number;
  isExpired: boolean;
}

export const pharmacyApiService = {
  // Medicine catalog
  async getMedicines(search?: string) {
    const res = await apiClient.get<{ data: BackendMedicine[] }>('/pharmacy/medicines', {
      params: { search },
    });
    return res.data.data;
  },

  async createMedicine(data: {
    code: string;
    name: string;
    category?: string;
    unit: string;
    batchManaged?: boolean;
    purchaseRate?: number;
    saleRate?: number;
  }) {
    const res = await apiClient.post<{ data: BackendMedicine }>('/pharmacy/medicines', data);
    return res.data.data;
  },

  async getMedicineBatches(medicineId: string) {
    const res = await apiClient.get<{ data: BackendBatch[] }>(`/pharmacy/medicines/${medicineId}/batches`);
    return res.data.data;
  },

  async createBatch(
    medicineId: string,
    data: {
      batchNumber: string;
      expiryDate: string;
      costRate: number;
    },
  ) {
    const res = await apiClient.post<{ data: any }>(`/pharmacy/medicines/${medicineId}/batches`, data);
    return res.data.data;
  },

  async receiveBatchStock(
    medicineId: string,
    batchId: string,
    data: {
      quantity: number;
      referenceInvoice?: string;
    },
  ) {
    const res = await apiClient.post<{ data: any }>(
      `/pharmacy/medicines/${medicineId}/batches/${batchId}/receipt`,
      data,
    );
    return res.data.data;
  },

  // FEFO Dispensing
  async dispenseRetail(data: {
    customerName?: string;
    lines: Array<{
      medicineId: string;
      quantity: number;
      discountAmount?: number;
    }>;
  }) {
    const res = await apiClient.post<{ data: any }>('/pharmacy/dispense', data);
    return res.data.data;
  },

  // HMS Pharmacy Bridge — read-only here (§ pharmacy-bridge.routes.ts).
  // Requests are created via admissionService's pharmacy-requests endpoint,
  // which dispatches to the standalone Pharmacy system; dispensing happens
  // there too and lands back on the admission invoice via webhook.
  async getInpatientRequests(status?: string, admissionRecordId?: string) {
    const res = await apiClient.get<{ data: any[] }>('/pharmacy-bridge/requests', {
      params: { status, admissionRecordId },
    });
    return res.data.data;
  },
};
