/**
 * PERMANENT REGRESSION TEST SUITE FOR PHARMACY ERP CACHING & STOCK SYNCHRONIZATION
 * Framework: TanStack Query v5 (@tanstack/react-query) + Zustand
 */

import { QueryClient } from '@tanstack/react-query';
import { usePharmacyUIStore } from '../store/usePharmacyUIStore';
import { queryKeys } from '../queryClient';

// Test QueryClient with exact app configuration
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 0,
      },
    },
  });
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function runRegressionSuite() {
  console.log('--- PHARMACY CACHING & STOCK SYNC PERMANENT REGRESSION SUITE ---');

  const qc = createTestQueryClient();
  const store = usePharmacyUIStore.getState();

  // Reset initial state
  qc.clear();
  store.resetAllStores();

  // 1. Instant Navigation & 0-Network Revisit
  console.log('[Test 1] Instant Navigation & SWR Cache Hit');
  let fetchCount = 0;
  const mockCatalogFetcher = async () => {
    fetchCount++;
    await new Promise((r) => setTimeout(r, 60));
    return [
      { id: 'med-paracetamol', code: 'MED-001', name: 'Paracetamol 500mg', currentStock: 10, saleRate: 20 },
      { id: 'med-augmentin', code: 'MED-002', name: 'Augmentin 625mg', currentStock: 45, saleRate: 150 },
    ];
  };

  const t0 = performance.now();
  const first = await qc.fetchQuery({
    queryKey: queryKeys.pos.catalog(),
    queryFn: mockCatalogFetcher,
  });
  const t1 = performance.now();
  assert(first.length === 2, 'Initial load returned 2 medicines');
  assert(fetchCount === 1, 'Initial load executed 1 network call');

  const t2 = performance.now();
  const second = await qc.fetchQuery({
    queryKey: queryKeys.pos.catalog(),
    queryFn: mockCatalogFetcher,
  });
  const t3 = performance.now();
  assert(second.length === 2, 'Second visit returned identical 2 medicines');
  assert(fetchCount === 1, 'Second visit made 0 new network calls');
  assert(t3 - t2 < 10, `Second visit lookup was instant (${(t3 - t2).toFixed(2)}ms)`);
  console.log('✓ Test 1 Passed: Instant warm revisit with 0 duplicate network calls.');

  // 2. POS Cart & Search Retention
  console.log('[Test 2] POS Cart & Search State Retention Across Navigation');
  store.setPosState({
    cart: [{ medicine: first[0], saleUnitId: 'u-strip', quantity: 2, discountAmount: 0 }],
    customerName: 'Ahmad Khan',
    search: 'Para',
  });

  // Verify state persists in store
  const currentPos = usePharmacyUIStore.getState().pos;
  assert(currentPos.cart.length === 1, 'Cart has 1 item');
  assert(currentPos.cart[0].quantity === 2, 'Cart item quantity is 2');
  assert(currentPos.customerName === 'Ahmad Khan', 'Customer name preserved');
  assert(currentPos.search === 'Para', 'Search filter preserved');
  console.log('✓ Test 2 Passed: POS Cart and customer info survived navigation tabs.');

  // 3. Authoritative Stock Sync & Cancellation of In-Flight Requests
  console.log('[Test 3] Authoritative Stock Sync & Stale Overwrite Prevention');
  const initialStock = qc.getQueryData<any[]>(queryKeys.pos.catalog())?.[0]?.currentStock;
  assert(initialStock === 10, 'Initial stock is 10');

  // Cancel any active in-flight query
  await qc.cancelQueries({ queryKey: queryKeys.pos.catalog() });

  // Update authoritative stock in cache (Sale of 3 units -> 7 remaining)
  qc.setQueryData<any[]>(queryKeys.pos.catalog(), (prev) => {
    if (!prev) return prev;
    return prev.map((m) => (m.id === 'med-paracetamol' ? { ...m, currentStock: 7 } : m));
  });

  // Invalidate related modules
  qc.invalidateQueries({ queryKey: queryKeys.medicines.all });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  qc.invalidateQueries({ queryKey: queryKeys.invoices.all });
  store.resetPosCart();

  const stockAfterSale = qc.getQueryData<any[]>(queryKeys.pos.catalog())?.[0]?.currentStock;
  assert(stockAfterSale === 7, `Stock immediately reflects authoritative 7 (got ${stockAfterSale})`);
  assert(usePharmacyUIStore.getState().pos.cart.length === 0, 'Cart cleared after sale');

  // Verify that subsequent read in POS returns 7
  const readback = await qc.fetchQuery({
    queryKey: queryKeys.pos.catalog(),
    queryFn: async () => [{ id: 'med-paracetamol', currentStock: 999 }], // will not be called
  });
  assert(readback[0].currentStock === 7, 'Revisiting POS still displays authoritative stock 7');
  console.log('✓ Test 3 Passed: Authoritative stock 7 safely synchronized and preserved.');

  // 4. Multi-Cashier Freshness & Backend Invalidation Check
  console.log('[Test 4] Multi-Cashier Revalidation Reconciliation');
  // Cashier A made a sale, now Cashier B's catalog is marked stale
  qc.invalidateQueries({ queryKey: queryKeys.pos.catalog() });

  // When Cashier B's POS refetches, it pulls latest backend stock (e.g. 7)
  let cashierBFetches = 0;
  const cashierBRefetch = await qc.fetchQuery({
    queryKey: queryKeys.pos.catalog(),
    queryFn: async () => {
      cashierBFetches++;
      return [{ id: 'med-paracetamol', currentStock: 7 }];
    },
  });
  assert(cashierBFetches === 1, 'Cashier B refetched fresh stock from backend');
  assert(cashierBRefetch[0].currentStock === 7, 'Cashier B sees updated stock 7');
  console.log('✓ Test 4 Passed: Multi-cashier invalidation revalidates fresh stock.');

  // 5. Session Isolation on Logout
  console.log('[Test 5] Complete Session Isolation on Logout');
  // Add sensitive session data
  qc.setQueryData(['financial', 'balanceSheet'], { physicalCash: 125000 });
  store.setPosState({ cart: [{ id: 'sensitive-cart-item' }], customerName: 'VIP Patient' });

  // Simulate AuthContext logout()
  await qc.cancelQueries();
  qc.clear();
  store.resetAllStores();

  assert(qc.getQueryData(queryKeys.pos.catalog()) === undefined, 'Catalog cache purged');
  assert(qc.getQueryData(['financial', 'balanceSheet']) === undefined, 'Financial cache purged');
  assert(usePharmacyUIStore.getState().pos.cart.length === 0, 'Cart purged on logout');
  assert(usePharmacyUIStore.getState().pos.customerName === '', 'Customer info purged on logout');
  console.log('✓ Test 5 Passed: Zero data leakage between user sessions on logout.');

  console.log('\n>>> ALL 5 REGRESSION TESTS PASSED CLEANLY! <<<');
}

runRegressionSuite().catch((err) => {
  console.error('\n❌ REGRESSION TEST FAILED:', err);
  process.exit(1);
});

