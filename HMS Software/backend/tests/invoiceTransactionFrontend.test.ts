import { expect, it, vi } from 'vitest';
const client = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../frontend/src/services/apiClient', () => ({ default: client }));
vi.mock('../../frontend/src/services/patientRegistryService', () => ({ getPatientById: () => undefined }));
import { fetchInvoices } from '../../frontend/src/services/invoiceService';
import { invoiceTransactions } from '../src/shared/invoiceTransactions';

it('carries unified API transaction amounts, dates and receipt details through the real frontend parser', async () => {
  const receipt = (id: string, day: string) => ({ id, receiptNumber: id, amount: 500, collectedAt: new Date(day), isReversed: false, method: 'BANK', paymentAccount: 'HMS Account', collectedBy: { username: 'billing-user' } });
  const rows = invoiceTransactions([{ id: 'invoice', invoiceNumber: 'INV-001', sourceType: 'WALK_IN', createdAt: new Date('2026-11-01T10:00:00Z'), total: 1000, subtotal: 1000, discountTotal: 0, paidTotal: 1000, paymentReceipts: [receipt('REC-1', '2026-11-01T12:00:00Z'), receipt('REC-2', '2026-11-16T12:00:00Z')] }]);
  client.get.mockResolvedValue({ data: { data: JSON.parse(JSON.stringify(rows)) } });
  const view = await fetchInvoices({ transactions: true });
  expect(client.get).toHaveBeenCalledWith('/invoices', { params: { transactions: true } });
  expect(view).toHaveLength(2);
  expect(view[0]).toMatchObject({ id: 'invoice', transactionId: 'receipt:REC-2', transactionType: 'Remaining Collection', billingAmount: 0, collectedAmount: 500, paidTotal: 1000, balanceDue: 0, transactionAtIso: '2026-11-16T12:00:00.000Z', receiptCollector: 'billing-user', receiptAccount: 'HMS Account', receiptMethod: 'BANK' });
  expect(view[1]).toMatchObject({ transactionId: 'invoice:invoice', billingAmount: 1000, collectedAmount: 500, balanceDue: 0, transactionAtIso: '2026-11-01T10:00:00.000Z' });
});
