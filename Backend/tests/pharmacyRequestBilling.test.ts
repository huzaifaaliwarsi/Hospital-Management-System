import { beforeEach, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
const db = vi.hoisted(() => ({
  admissionRecord: { findUnique: vi.fn(), findMany: vi.fn() },
  hmsPharmacyCharge: { findFirst: vi.fn() },
  paymentReceipt: { findMany: vi.fn(), aggregate: vi.fn() },
}));
vi.mock('@/db/client', () => ({ prisma: db }));
import { admissionBillingService } from '@/modules/frontdesk/admissionBilling.service';
const d = (n: number) => new Decimal(n);

beforeEach(() => {
  vi.resetAllMocks();
  db.paymentReceipt.findMany.mockResolvedValue([]);
  db.paymentReceipt.aggregate.mockResolvedValue({ _sum: { amount: d(0) } });
});

it.each([0, 120])('bills only posted dispenses (%s), never the other pending request', async (dispensedAmount) => {
  const line = {
    id: 'dispensed', billingSource: 'PHARMACY', descriptionSnapshot: 'Dispensed medicine',
    quantity: d(10), rateSnapshot: d(12), lineGross: d(120), discountAmount: d(0),
    lineNet: d(120), patientShare: d(120), panelReceivable: d(0), createdAt: new Date(),
  };
  const admission = {
    id: 'admission', admissionNumber: 'ADM', status: 'ACTIVE', bed: null,
    hospitalInvoices: [{
      id: 'invoice', invoiceNumber: 'INV', subtotal: d(dispensedAmount), discountTotal: d(0),
      total: d(dispensedAmount), patientShare: d(dispensedAmount), panelReceivable: d(0),
      paidTotal: d(0), lines: dispensedAmount ? [line] : [],
    }],
    pharmacyClearances: [{ status: 'REQUESTED', medicineRequestNumber: 'REQ-2', requestedAt: new Date(),
      lines: [{ id: 'pending', requestedQuantity: d(20), medicine: { name: 'Not dispensed', saleRate: d(12) } }] }],
  };
  db.admissionRecord.findUnique.mockResolvedValue(admission);
  db.admissionRecord.findMany.mockResolvedValue([admission]);
  db.hmsPharmacyCharge.findFirst.mockResolvedValue(dispensedAmount ? {
    totalAmount: d(120), subtotal: d(120), patientPaid: d(0), patientOutstanding: d(120), itemsJson: [],
  } : null);
  const statement = await admissionBillingService.getStatement('admission');
  const ledger = await admissionBillingService.getLedger('admission', true);
  const records = await admissionBillingService.listAdmissionRecords();
  expect(statement.consolidated.total.toNumber()).toBe(dispensedAmount);
  expect(statement.consolidated.outstanding.toNumber()).toBe(dispensedAmount);
  expect(ledger.summary.totalCharges.toNumber()).toBe(dispensedAmount);
  expect(ledger.entries).toHaveLength(dispensedAmount ? 1 : 0);
  expect(records[0].currentCharges.toNumber()).toBe(dispensedAmount);
  expect(records[0].outstanding.toNumber()).toBe(dispensedAmount);
});
