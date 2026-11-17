import { QueryClient } from '@tanstack/react-query';

/**
 * Global TanStack Query Client for Pharmacy ERP
 * Configured for instant navigation, background SWR, and request deduplication.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute default stale time
      gcTime: 30 * 60 * 1000, // 30 minutes garbage collection in memory
      refetchOnWindowFocus: false, // Avoid aggressive refetches during active POS / counter work
      refetchOnReconnect: true,
      retry: 1, // Graceful single retry on transient failures
    },
    mutations: {
      retry: 0, // Never auto-retry mutations to prevent duplicate financial or stock transactions
    },
  },
});

/**
 * Type-safe, centralized Query Keys matrix
 */
export const queryKeys = {
  medicines: {
    all: ['medicines'] as const,
    paginated: (params: Record<string, any>) => ['medicines', 'paginated', params] as const,
    units: () => ['medicines', 'units'] as const,
    categories: () => ['medicines', 'categories'] as const,
    batches: (id: string) => ['medicines', 'batches', id] as const,
    packaging: (id: string) => ['medicines', 'packaging', id] as const,
  },
  pos: {
    all: ['pos'] as const,
    catalog: () => ['pos', 'catalog'] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: (filters?: Record<string, any>) => ['invoices', 'list', filters || {}] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    management: () => ['dashboard', 'management'] as const,
    sales: () => ['dashboard', 'sales'] as const,
  },
  financial: {
    all: ['financial'] as const,
    balanceSheet: () => ['financial', 'balanceSheet'] as const,
    settlements: () => ['financial', 'settlements'] as const,
    expenses: () => ['financial', 'expenses'] as const,
    receivables: () => ['financial', 'receivables'] as const,
  },
  hms: {
    all: ['hms'] as const,
    requests: (status?: string) => ['hms', 'requests', status || 'ALL'] as const,
    settings: () => ['hms', 'settings'] as const,
  },
  settings: () => ['settings', 'pharmacy'] as const,
  vendors: {
    all: ['vendors'] as const,
    list: () => ['vendors', 'list'] as const,
    ledger: (id: string) => ['vendors', 'ledger', id] as const,
  },
  purchases: {
    all: ['purchases'] as const,
    list: () => ['purchases', 'list'] as const,
  },
};

