import { create } from 'zustand';

export interface MedicinesUIState {
  currentPage: number;
  pageSize: number;
  searchInput: string;
  categoryInput: string;
  stockStatusInput: string;
  unitInput: string;
  appliedFilters: {
    search: string;
    category: string;
    stockStatus: string;
    unit: string;
  };
  inResultSearch: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
}

export interface PosUIState {
  cart: any[];
  customerName: string;
  invoiceDiscount: string;
  invoiceDiscountType: 'PKR' | 'PERCENT';
  payments: any[];
  search: string;
  selectedCategory: string;
}

export interface InvoicesUIState {
  statusFilter: string;
  channelFilter: string;
  fromDate: string;
  toDate: string;
  page: number;
  pageSize: number;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface DashboardUIState {
  timeframe: '7d' | '14d' | '30d' | '6m';
  tableSearch: string;
}

export interface PharmacyUIStore {
  medicines: MedicinesUIState;
  pos: PosUIState;
  invoices: InvoicesUIState;
  dashboard: DashboardUIState;

  setMedicinesState: (partial: Partial<MedicinesUIState>) => void;
  setPosState: (partial: Partial<PosUIState>) => void;
  resetPosCart: () => void;
  setInvoicesState: (partial: Partial<InvoicesUIState>) => void;
  setDashboardState: (partial: Partial<DashboardUIState>) => void;
  resetAllStores: () => void;
}

const initialMedicinesState: MedicinesUIState = {
  currentPage: 1,
  pageSize: 25,
  searchInput: '',
  categoryInput: 'ALL',
  stockStatusInput: 'ALL',
  unitInput: 'ALL',
  appliedFilters: {
    search: '',
    category: 'ALL',
    stockStatus: 'ALL',
    unit: 'ALL',
  },
  inResultSearch: '',
  sortField: 'name',
  sortOrder: 'asc',
};

const initialPosState: PosUIState = {
  cart: [],
  customerName: '',
  invoiceDiscount: '0',
  invoiceDiscountType: 'PKR',
  payments: [{ method: 'CASH', amount: '' }],
  search: '',
  selectedCategory: 'ALL',
};

const initialInvoicesState: InvoicesUIState = {
  statusFilter: 'ALL',
  channelFilter: 'ALL',
  fromDate: '',
  toDate: '',
  page: 1,
  pageSize: 25,
  search: '',
  sortBy: 'date',
  sortOrder: 'desc',
};

const initialDashboardState: DashboardUIState = {
  timeframe: '7d',
  tableSearch: '',
};

export const usePharmacyUIStore = create<PharmacyUIStore>((set) => ({
  medicines: initialMedicinesState,
  pos: initialPosState,
  invoices: initialInvoicesState,
  dashboard: initialDashboardState,

  setMedicinesState: (partial) =>
    set((state) => ({ medicines: { ...state.medicines, ...partial } })),

  setPosState: (partial) =>
    set((state) => ({ pos: { ...state.pos, ...partial } })),

  resetPosCart: () =>
    set(() => ({
      pos: {
        ...initialPosState,
      },
    })),

  setInvoicesState: (partial) =>
    set((state) => ({ invoices: { ...state.invoices, ...partial } })),

  setDashboardState: (partial) =>
    set((state) => ({ dashboard: { ...state.dashboard, ...partial } })),

  resetAllStores: () =>
    set(() => ({
      medicines: initialMedicinesState,
      pos: initialPosState,
      invoices: initialInvoicesState,
      dashboard: initialDashboardState,
    })),
}));

