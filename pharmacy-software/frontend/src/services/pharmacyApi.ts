import apiClient from './apiClient';

export interface MedicineRow {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  unit: string;
  batchManaged: boolean;
  reorderLevel: string | number;
  saleRate: string | number;
  taxPercent: string | number;
  isActive: boolean;
  currentStock: string | number;
  batchesCount: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  hasExpiredBatch: boolean;
  hasNearExpiryBatch: boolean;
}

export interface ManagementDashboard {
  salesToday: string | number;
  salesCountToday: number;
  purchasesToday: string | number;
  purchasesCountToday: number;
  currentStockValue: string | number;
  lowStockCount: number;
  outOfStockCount: number;
  nearExpiryCount: number;
  expiredCount: number;
  vendorPayable: string | number;
  pendingSettlements: number;
  pendingHmsRequests: number;
  expectedCash: string | number;
}

export interface SalesDashboard {
  mySalesToday: string | number;
  mySalesCountToday: number;
  cashCollectionToday: string | number;
  cardOnlineCollectionToday: string | number;
  pendingHmsRequests: number;
  expectedCash: string | number;
}

export const pharmacyApi = {
  getManagementDashboard: () => apiClient.get<{ data: ManagementDashboard }>('/dashboard/management').then((r) => r.data.data),
  getSalesDashboard: () => apiClient.get<{ data: SalesDashboard }>('/dashboard/sales').then((r) => r.data.data),

  listMedicines: (search?: string) => apiClient.get<{ data: MedicineRow[] }>('/pharmacy/medicines', { params: { search } }).then((r) => r.data.data),
  createMedicine: (body: Record<string, unknown>) => apiClient.post('/pharmacy/medicines', body).then((r) => r.data.data),

  listVendors: (search?: string) => apiClient.get('/vendors', { params: { search } }).then((r) => r.data.data),
  createVendor: (body: Record<string, unknown>) => apiClient.post('/vendors', body).then((r) => r.data.data),

  listInvoices: () => apiClient.get('/pharmacy/invoices').then((r) => r.data.data),
  getInvoiceById: (id: string) => apiClient.get(`/pharmacy/invoices/${id}`).then((r) => r.data.data),
  dispenseRetail: (body: Record<string, unknown>) => apiClient.post('/pharmacy/dispense', body).then((r) => r.data.data),
  salesReturn: (body: Record<string, unknown>) => apiClient.post('/pharmacy/sales-returns', body).then((r) => r.data.data),

  getBalanceSheet: () => apiClient.get('/cash/balance-sheet').then((r) => r.data.data),
  listSettlements: () => apiClient.get('/cash/settlements').then((r) => r.data.data),
  submitSettlement: (body: Record<string, unknown>) => apiClient.post('/cash/settlements', body).then((r) => r.data.data),

  listExpenses: () => apiClient.get('/expenses').then((r) => r.data.data),
  createExpense: (body: Record<string, unknown>) => apiClient.post('/expenses', body).then((r) => r.data.data),

  listUsers: () => apiClient.get('/users').then((r) => r.data.data),
  createUser: (body: Record<string, unknown>) => apiClient.post('/users', body).then((r) => r.data.data),

  // HMS Requests (pharmacy.md §7)
  getHmsSettings: () => apiClient.get('/hms-requests/settings').then((r) => r.data.data),
  updateHmsSettings: (body: Record<string, unknown>) => apiClient.put('/hms-requests/settings', body).then((r) => r.data.data),
  listHmsRequests: (status?: string) => apiClient.get('/hms-requests', { params: { status } }).then((r) => r.data.data),
  createHmsRequest: (body: Record<string, unknown>) => apiClient.post('/hms-requests', body).then((r) => r.data.data),
  approveHmsRequest: (id: string) => apiClient.post(`/hms-requests/${id}/approve`).then((r) => r.data.data),
  rejectHmsRequest: (id: string, reason: string) => apiClient.post(`/hms-requests/${id}/reject`, { reason }).then((r) => r.data.data),
  fulfillHmsRequest: (id: string, lines: { requestLineId: string; dispenseQuantity: number }[]) =>
    apiClient.post(`/hms-requests/${id}/fulfill`, { lines }).then((r) => r.data.data),
};
