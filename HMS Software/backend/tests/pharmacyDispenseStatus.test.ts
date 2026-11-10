import { beforeEach, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
const db = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  admissionRecord: { findFirst: vi.fn() },
  hospitalInvoice: { findFirst: vi.fn(), update: vi.fn() },
  department: { findFirst: vi.fn() },
  serviceRate: { findUnique: vi.fn() },
  invoiceLineItem: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  paymentReceipt: { findMany: vi.fn() },
  pharmacyClearance: { updateMany: vi.fn(), count: vi.fn() },
  dualDischargeClearance: { upsert: vi.fn() },
  hmsPharmacyCharge: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock('@/db/client', () => ({ prisma: { ...db, $transaction: (fn: any) => fn(db) } }));
import { pharmacyBridgeService } from '@/modules/pharmacy-bridge/pharmacy-bridge.service';
const d = (n: number) => new Decimal(n);
let statuses: Record<string, string>;
let charge: any;
beforeEach(() => {
  vi.resetAllMocks();
  statuses = { 'REQ-1': 'REQUESTED', 'REQ-2': 'REQUESTED' };
  charge = null;
  db.admissionRecord.findFirst.mockResolvedValue({ id: 'admission', status: 'ACTIVE' });
  db.department.findFirst.mockResolvedValue({ id: 'pharmacy' });
  db.hospitalInvoice.findFirst.mockResolvedValue({ id: 'invoice', paidTotal: d(0), lines: [] });
  db.hospitalInvoice.update.mockImplementation(async ({ data }) => ({ id: 'invoice', ...data }));
  db.paymentReceipt.findMany.mockResolvedValue([]);
  db.invoiceLineItem.createMany.mockImplementation(async ({ data }) => {
    db.invoiceLineItem.findMany.mockResolvedValue(data); return { count: data.length };
  });
  db.hmsPharmacyCharge.findFirst.mockImplementation(async () => charge);
  db.hmsPharmacyCharge.findUnique.mockImplementation(async () => charge);
  db.hmsPharmacyCharge.create.mockImplementation(async ({ data }) => charge = { id: 'charge', ...data });
  db.hmsPharmacyCharge.update.mockImplementation(async ({ data }) => charge = { ...charge, ...data });
  db.pharmacyClearance.updateMany.mockImplementation(async ({ where, data }) => {
    if (data.status) {
      const ref = where.OR[0].medicineRequestNumber;
      for (const key of typeof ref === 'string' ? [ref] : ref.in) statuses[key] = data.status;
    }
    return { count: 1 };
  });
  db.pharmacyClearance.count.mockImplementation(async () => Object.values(statuses).filter(s => s !== 'DISPENSED').length);
});
function payload(event: string, amount: number, status: 'DISPENSED' | 'PARTIALLY_FULFILLED') {
  return {
    dispenseEventId: event, externalAdmissionRef: 'ADM', externalRequestRef: 'REQ-1',
    pharmacyInvoiceNumber: 'PHI', subtotal: amount, taxTotal: 0, discountTotal: 0, totalAmount: amount,
    requestStatuses: [{ externalRequestRef: 'REQ-1', status }],
    lines: [{ medicineName: 'Medicine', externalRequestRef: 'REQ-1', quantity: amount / 10, rate: 10, lineNet: amount }],
  };
}
it('charges only the dispensed request and keeps the other request and clearance pending', async () => {
  const result = await pharmacyBridgeService.handleDispensedCallback(payload('event-1', 120, 'DISPENSED'));
  expect(result.hospitalInvoice.total.toNumber()).toBe(120);
  expect(statuses).toEqual({ 'REQ-1': 'DISPENSED', 'REQ-2': 'REQUESTED' });
  expect(db.dualDischargeClearance.upsert).toHaveBeenCalledWith(expect.objectContaining({
    update: { status: 'PENDING', clearedAt: null },
  }));
});
it('accepts a later partial-dispense event for the same request, but ignores an exact replay', async () => {
  await pharmacyBridgeService.handleDispensedCallback(payload('event-1', 50, 'PARTIALLY_FULFILLED'));
  expect(statuses['REQ-1']).toBe('PARTIALLY_FULFILLED');
  const complete = await pharmacyBridgeService.handleDispensedCallback(payload('event-2', 120, 'DISPENSED'));
  expect(complete.alreadyProcessed).toBe(false);
  expect(complete.hospitalInvoice.total.toNumber()).toBe(120);
  expect(statuses['REQ-2']).toBe('REQUESTED');
  const duplicate = await pharmacyBridgeService.handleDispensedCallback(payload('event-2', 120, 'DISPENSED'));
  expect(duplicate.alreadyProcessed).toBe(true);
  expect(db.invoiceLineItem.createMany).toHaveBeenCalledTimes(2);
});
