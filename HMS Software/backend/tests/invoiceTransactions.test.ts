import { describe, expect, it } from 'vitest';
import { invoiceTransactions } from '../src/shared/invoiceTransactions';

const date = (day: number) => new Date(`2026-11-${String(day).padStart(2, '0')}T10:00:00Z`);
const receipt = (id: string, amount: number, day: number, isReversed = false) => ({ id, receiptNumber: `REC-${id}`, amount, collectedAt: date(day), isReversed, method: 'CASH', paymentAccount: null, collectedBy: { username: 'cashier' } });
const invoice = (receipts: ReturnType<typeof receipt>[]) => ({ id: 'invoice-1', createdAt: date(1), total: 1000, subtotal: 1000, discountTotal: 0, paymentReceipts: receipts });

describe('Hospital Invoices transaction projection', () => {
  it('keeps the initial 500 and displays the later 500 with zero new billing', () => {
    const source = invoice([receipt('1', 500, 1), receipt('2', 500, 16)]);
    const rows = invoiceTransactions([source]);
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.transactionType === 'Original Invoice')).toMatchObject({ collectedAmount: 500, billingAmount: 1000, transactionAt: date(1) });
    expect(rows.find(r => r.transactionType === 'Remaining Collection')).toMatchObject({ collectedAmount: 500, billingAmount: 0, transactionAt: date(16) });
    expect(rows.reduce((sum, r) => sum + r.billingAmount, 0)).toBe(1000);
    expect(rows.reduce((sum, r) => sum + r.collectedAmount, 0)).toBe(1000);
    expect(source.paymentReceipts).toHaveLength(2);
  });
  it('supports 500 + 200 + 300, stable unique IDs and chronological page boundaries', () => {
    const rows = invoiceTransactions([invoice([receipt('1', 500, 1), receipt('2', 200, 16), receipt('3', 300, 17)])]);
    expect(rows.map(r => r.collectedAmount)).toEqual([300, 200, 500]);
    expect(new Set(rows.map(r => r.transactionId)).size).toBe(3);
    expect(rows.slice(0, 2)).toHaveLength(2);
    expect(rows.slice(2).map(r => r.billingAmount)).toEqual([1000]);
  });
  it('shows an unpaid original separately when its first payment occurs later', () => {
    const rows = invoiceTransactions([invoice([receipt('1', 500, 16)])]);
    expect(rows.map(r => [r.billingAmount, r.collectedAmount])).toEqual([[0, 500], [1000, 0]]);
  });
  it('does not combine subsequent same-day receipts with the original collection', () => {
    const rows = invoiceTransactions([invoice([receipt('2', 200, 1), receipt('1', 500, 1)])]);
    expect(rows.find(r => r.transactionType === 'Original Invoice')?.collectedAmount).toBe(500);
    expect(rows.find(r => r.transactionType === 'Remaining Collection')?.collectedAmount).toBe(200);
  });
  it('keeps negative refunds as separate dated events without duplicate billing', () => {
    const rows = invoiceTransactions([invoice([receipt('1', 500, 1), receipt('2', 500, 16), receipt('3', -100, 17, true)])]);
    expect(rows[0]).toMatchObject({ transactionType: 'Refund / Reversal', collectedAmount: -100, billingAmount: 0 });
    expect(rows.reduce((sum, r) => sum + r.collectedAmount, 0)).toBe(900);
    expect(rows.reduce((sum, r) => sum + r.billingAmount, 0)).toBe(1000);
  });
  it('excludes reversed positive receipts from valid collections but preserves traceability', () => {
    const rows = invoiceTransactions([invoice([receipt('1', 500, 1, true), receipt('2', 100, 16, true)])]);
    expect(rows.every(r => r.collectedAmount === 0)).toBe(true);
    expect(rows.find(r => r.transactionId === 'receipt:2')?.transactionType).toBe('Reversed Receipt');
  });
  it('uses Pakistan calendar dates at midnight without changing original timestamps', () => {
    const source = invoice([receipt('1', 500, 1)]);
    source.createdAt = new Date('2026-10-31T20:00:00Z');
    expect(invoiceTransactions([source])).toHaveLength(1);
    expect(source.createdAt.toISOString()).toBe('2026-10-31T20:00:00.000Z');
  });
});
