import apiClient from './apiClient';

interface DateRangeParams {
  preset?: string;
  fromDate?: string;
  toDate?: string;
}

/** Wraps `/reports/inventory/*` (inventory.md §7/§8, §9 step 7) — reused both
 * by the Reports screen (step 14) and as the read side for Stock Movement
 * Center's per-tab history tables (step 11), so those tabs show real posted
 * data without a separate "list" endpoint per transaction type. */
export const inventoryReportsApiService = {
  async getSummary(params?: DateRangeParams & { category?: string; nearExpiryDays?: number }) {
    const res = await apiClient.get<{ data: any }>('/reports/inventory/summary', { params });
    return res.data.data;
  },

  async getStockMovement(params?: DateRangeParams & { movementType?: string; stockItemId?: string; category?: string; actorId?: string }) {
    const res = await apiClient.get<{ data: any }>('/reports/inventory/stock-movement', { params });
    return res.data.data;
  },

  async getPurchases(params?: DateRangeParams & { supplierId?: string; paymentMethod?: string; createdById?: string }) {
    const res = await apiClient.get<{ data: any }>('/reports/inventory/purchases', { params });
    return res.data.data;
  },

  async getDepartmentIssueReturn(params?: DateRangeParams & { departmentId?: string; status?: string; issuedById?: string }) {
    const res = await apiClient.get<{ data: any }>('/reports/inventory/department-issue-return', { params });
    return res.data.data;
  },

  async getSuppliers(params?: DateRangeParams & { supplierId?: string; transactionType?: string }) {
    const res = await apiClient.get<{ data: any }>('/reports/inventory/suppliers', { params });
    return res.data.data;
  },

  async getExpenses(params?: DateRangeParams & { category?: string; paymentMethod?: string; createdById?: string }) {
    const res = await apiClient.get<{ data: any }>('/reports/inventory/expenses', { params });
    return res.data.data;
  },

  async getStockStatus(params?: { category?: string; stockItemId?: string; status?: string; expiryWindowDays?: number }) {
    const res = await apiClient.get<{ data: any }>('/reports/inventory/stock-status', { params });
    return res.data.data;
  },

  async getCashSettlement(params?: DateRangeParams & { status?: string }) {
    const res = await apiClient.get<{ data: any }>('/reports/inventory/cash-settlement', { params });
    return res.data.data;
  },
};
