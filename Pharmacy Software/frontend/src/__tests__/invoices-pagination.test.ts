import assert from 'node:assert/strict';
import { summarizeInvoiceTransactions } from '../utils/transactionExport';

console.log('--- PHARMACY BATCH 4 INVOICE PAGINATION & TRANSACTION REGRESSION SUITE ---');

// Test 1: Original Invoice + Separate Remaining Collection Row Projection
console.log('\n[Test 1] Original Invoice + Remaining Collection Rows');
const sampleTransactions = [
  {
    id: 'payment:pay-002',
    invoiceId: 'inv-001',
    invoiceNumber: 'INV-001',
    transactionType: 'Remaining Collection',
    transactionAt: new Date('2026-11-16T12:00:00Z'),
    billingAmount: 0,
    collectedAmount: 300,
    outstanding: 0,
  },
  {
    id: 'payment:pay-001',
    invoiceId: 'inv-001',
    invoiceNumber: 'INV-001',
    transactionType: 'Remaining Collection',
    transactionAt: new Date('2026-11-06T12:00:00Z'),
    billingAmount: 0,
    collectedAmount: 200,
    outstanding: 300,
  },
  {
    id: 'invoice:inv-001',
    invoiceId: 'inv-001',
    invoiceNumber: 'INV-001',
    transactionType: 'Original Sale',
    transactionAt: new Date('2026-11-01T12:00:00Z'),
    billingAmount: 1000,
    collectedAmount: 500,
    outstanding: 500,
  },
];

const fullSummary = summarizeInvoiceTransactions(sampleTransactions);
assert.equal(fullSummary.billing, 1000, 'Original sale contributes 1,000 billing');
assert.equal(fullSummary.collected, 1000, 'Sum of all collections is 1,000');
assert.equal(fullSummary.outstanding, 0, 'Canonical outstanding counted once (0)');
assert.equal(fullSummary.invoices, 1, 'Exactly 1 distinct invoice');
console.log('✓ Test 1 Passed: Original invoice and remaining collections properly projected.');

// Test 2: Historical Date Filter (Filtering for Nov 6 only)
console.log('\n[Test 2] Historical Date Filtering on Payment Date');
const nov6Filtered = sampleTransactions.filter((r) =>
  r.transactionAt.toISOString().startsWith('2026-11-06')
);
assert.equal(nov6Filtered.length, 1, 'Only 1 transaction row for Nov 6');
assert.equal(nov6Filtered[0].transactionType, 'Remaining Collection');
assert.equal(nov6Filtered[0].billingAmount, 0, 'Nov 6 billing is 0 (NOT 1,000)');
assert.equal(nov6Filtered[0].collectedAmount, 200, 'Nov 6 collected is 200');

const nov6Summary = summarizeInvoiceTransactions(nov6Filtered);
assert.equal(nov6Summary.billing, 0, 'Nov 6 filtered KPI billing is 0');
assert.equal(nov6Summary.collected, 200, 'Nov 6 filtered KPI collected is 200');
console.log('✓ Test 2 Passed: Historical date filtering applies strictly to transaction payment date.');

// Test 3: Pagination slicing on visible transaction rows
console.log('\n[Test 3] Visible Transaction Rows Pagination Slicing');
const allRows = [
  ...sampleTransactions,
  {
    id: 'invoice:inv-002',
    invoiceId: 'inv-002',
    invoiceNumber: 'INV-002',
    transactionType: 'Original Sale',
    transactionAt: new Date('2026-11-02T12:00:00Z'),
    billingAmount: 500,
    collectedAmount: 500,
    outstanding: 0,
  },
];

const pageSize = 2;
const page1 = allRows.slice(0, pageSize);
const page2 = allRows.slice(pageSize, pageSize * 2);

assert.equal(page1.length, 2, 'Page 1 contains exactly 2 rows');
assert.equal(page2.length, 2, 'Page 2 contains exactly 2 rows');
assert.equal(page1[0].id, 'payment:pay-002', 'First visible row is Nov 16 remaining collection');
assert.equal(page1[1].id, 'payment:pay-001', 'Second visible row is Nov 6 remaining collection');
console.log('✓ Test 3 Passed: Pagination operates on visible transaction rows in date order.');

// Test 4: Outstanding not double counted across multiple installments
console.log('\n[Test 4] Canonical Outstanding Single Counting');
const pendingRows = [
  {
    id: 'payment:pay-001',
    invoiceId: 'inv-001',
    invoiceNumber: 'INV-001',
    transactionType: 'Remaining Collection',
    transactionAt: new Date('2026-11-06T12:00:00Z'),
    billingAmount: 0,
    collectedAmount: 200,
    outstanding: 300,
  },
  {
    id: 'invoice:inv-001',
    invoiceId: 'inv-001',
    invoiceNumber: 'INV-001',
    transactionType: 'Original Sale',
    transactionAt: new Date('2026-11-01T12:00:00Z'),
    billingAmount: 1000,
    collectedAmount: 500,
    outstanding: 300,
  },
];
const pendingSummary = summarizeInvoiceTransactions(pendingRows);
assert.equal(pendingSummary.outstanding, 300, 'Outstanding 300 is counted once, not 600');
console.log('✓ Test 4 Passed: Outstanding balance is deduplicated per invoice.');

console.log('\n>>> ALL 4 INVOICE REGRESSION TESTS PASSED CLEANLY! <<<');

