import { describe, it, expect } from 'vitest';
import { managementReportsService } from '../src/modules/reports/managementReports.service';

describe('M01: Income & Expense Ledger Backend Integration', () => {
  it('fetches income & expense ledger with today preset (Asia/Karachi default)', async () => {
    const res = await managementReportsService.getIncomeExpenseLedger({ preset: 'today' });
    expect(res).toBeDefined();
    expect(res.period).toBeDefined();
    expect(res.period.label).toContain('Today');
    expect(Array.isArray(res.items)).toBe(true);
    expect(res.columnTotals).toBeDefined();
    expect(res.totals).toBeDefined();
    expect(res.totals.hospitalRevenue).toBeDefined();
    expect(res.totals.collectionsReceivables).toBeDefined();
    expect(res.totals.hospitalCosts).toBeDefined();
    expect(res.totals.profit).toBeDefined();
    expect(res.totals.cashMovement).toBeDefined();
  });

  it('fetches all_time ledger and verifies transaction rows have required attributes', async () => {
    const res = await managementReportsService.getIncomeExpenseLedger({ preset: 'all_time' });
    expect(res.totalRecords).toBeGreaterThan(0);
    expect(res.items.length).toBeGreaterThan(0);

    const first = res.items[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('date');
    expect(first).toHaveProperty('reference');
    expect(first).toHaveProperty('transactionType');
    expect(first).toHaveProperty('typeLabel');
    expect(first).toHaveProperty('patientPayeeDescription');
    expect(first).toHaveProperty('encounterInvoiceRef');
    expect(first).toHaveProperty('department');
    expect(first).toHaveProperty('portalUser');
    expect(first).toHaveProperty('status');
    expect(first).toHaveProperty('grossBilling');
    expect(first).toHaveProperty('discountCredit');
    expect(first).toHaveProperty('tax');
    expect(first).toHaveProperty('netRevenue');
    expect(first).toHaveProperty('collectionsReceived');
    expect(first).toHaveProperty('recognizedExpense');
    expect(first).toHaveProperty('expensePaid');
    expect(first).toHaveProperty('cashIn');
    expect(first).toHaveProperty('cashOut');
    expect(first).toHaveProperty('outstandingPayable');
    expect(first).toHaveProperty('paymentMethod');
  });

  it('filters by transactionType correctly', async () => {
    const revRes = await managementReportsService.getIncomeExpenseLedger({ preset: 'all_time', transactionType: 'REVENUE' });
    for (const item of revRes.items) {
      expect(item.transactionType).toBe('REVENUE');
      expect(item.collectionsReceived).toBe(0); // Invoices do not record collections
    }

    const colRes = await managementReportsService.getIncomeExpenseLedger({ preset: 'all_time', transactionType: 'COLLECTION' });
    for (const item of colRes.items) {
      expect(item.transactionType).toBe('COLLECTION');
      expect(item.netRevenue).toBe(0); // Collections do not create duplicate revenue
    }
  });

  it('searches across references and descriptions', async () => {
    const res = await managementReportsService.getIncomeExpenseLedger({ preset: 'all_time', search: 'INV' });
    for (const item of res.items) {
      const match =
        item.reference.toLowerCase().includes('inv') ||
        item.patientPayeeDescription.toLowerCase().includes('inv') ||
        item.encounterInvoiceRef.toLowerCase().includes('inv');
      expect(match).toBe(true);
    }
  });

  it('reconciles operating profit formula: Gross Profit - Total Operating Costs', async () => {
    const res = await managementReportsService.getIncomeExpenseLedger({ preset: 'all_time' });
    const { profit, hospitalRevenue, hospitalCosts } = res.totals;

    expect(profit.grossProfit).toBeCloseTo(hospitalRevenue.netEarnedRevenue - hospitalCosts.directConsumables, 2);
    expect(profit.operatingProfit).toBeCloseTo(profit.grossProfit - hospitalCosts.totalOperatingCosts, 2);
  });

  it('reconciles physical cash movement and internal settlement netting at hospital level', async () => {
    const res = await managementReportsService.getIncomeExpenseLedger({ preset: 'today' });
    const { cashMovement, collectionsReceivables } = res.totals;

    // Internal custody settlements net to 0 at hospital level
    expect(cashMovement.nonOperatingCashOutflows).toBe(0);

    // Customer collections match external cash inflows
    expect(cashMovement.totalCustomerCollections).toBeGreaterThanOrEqual(0);
    expect(collectionsReceivables.cashCollections).toBe(cashMovement.totalCustomerCollections);

    // Mathematical consistency: netPhysicalCashMovement = cashCollections - cashPaidOperatingExpenses - nonOperatingCashOutflows
    const expectedNet = collectionsReceivables.cashCollections - (cashMovement.cashPaidOperatingExpenses ?? 0) - cashMovement.nonOperatingCashOutflows;
    expect(cashMovement.netPhysicalCashMovement).toBe(expectedNet);
    expect(cashMovement.netCashMovement).toBe(expectedNet);

    // Settlement rows at hospital level have net zero impact
    const settlements = res.items.filter((it) => it.transactionType === 'SETTLEMENT');
    for (const st of settlements) {
      expect(st.cashIn).toBe(0);
      expect(st.cashOut).toBe(0);
      expect(st.details).toBeDefined();
    }
  });
});
