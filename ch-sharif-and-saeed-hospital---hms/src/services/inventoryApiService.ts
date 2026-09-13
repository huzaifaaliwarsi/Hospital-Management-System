import apiClient from './apiClient';

export interface BackendSupplier {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  address?: string;
  terms?: string;
  isActive: boolean;
  outstandingBalance: string | number;
}

export interface BackendStockItem {
  id: string;
  code: string;
  name: string;
  category?: string;
  unit: string;
  reorderLevel: string | number;
  currentStock: string | number;
  isLowStock: boolean;
}

export const inventoryApiService = {
  // Suppliers
  async getSuppliers(search?: string) {
    const res = await apiClient.get<{ data: BackendSupplier[] }>('/inventory/suppliers', {
      params: { search },
    });
    return res.data.data;
  },

  async createSupplier(data: {
    name: string;
    contact?: string;
    phone?: string;
    address?: string;
    terms?: string;
  }) {
    const res = await apiClient.post<{ data: BackendSupplier }>('/inventory/suppliers', data);
    return res.data.data;
  },

  async getSupplierLedger(id: string) {
    const res = await apiClient.get<{ data: any }>(`/inventory/suppliers/${id}/ledger`);
    return res.data.data;
  },

  // Stock Items
  async getStockItems(search?: string) {
    const res = await apiClient.get<{ data: BackendStockItem[] }>('/inventory/items', {
      params: { search },
    });
    return res.data.data;
  },

  async createStockItem(data: {
    code: string;
    name: string;
    category?: string;
    unit: string;
    reorderLevel?: number;
  }) {
    const res = await apiClient.post<{ data: BackendStockItem }>('/inventory/items', data);
    return res.data.data;
  },

  async getItemLedger(id: string) {
    const res = await apiClient.get<{ data: any }>(`/inventory/items/${id}/ledger`);
    return res.data.data;
  },

  // Purchases
  async createPurchase(data: {
    supplierId: string;
    invoiceReference?: string;
    paymentMethod: 'PETTY_CASH' | 'MANAGEMENT_DIRECT' | 'ONLINE' | 'CREDIT';
    lines: Array<{
      stockItemId: string;
      quantity: number;
      rate: number;
    }>;
  }) {
    const res = await apiClient.post<{ data: any }>('/inventory/purchases', data);
    return res.data.data;
  },

  // Department Issues
  async issueToDepartment(data: {
    departmentId: string;
    receivedByName?: string;
    lines: Array<{
      stockItemId: string;
      quantity: number;
    }>;
  }) {
    const res = await apiClient.post<{ data: any }>('/inventory/department-issues', data);
    return res.data.data;
  },
};
