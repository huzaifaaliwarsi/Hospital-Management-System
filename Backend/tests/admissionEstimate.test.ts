import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const mocks = vi.hoisted(() => {
  const tx = {
    admissionRecord: { create: vi.fn() },
    hospitalInvoice: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    invoiceLineItem: { create: vi.fn() },
    serviceRate: { findFirst: vi.fn() },
    ward: { findUnique: vi.fn() },
    paymentReceipt: { create: vi.fn() },
    userCashBalance: { create: vi.fn() },
  };
  return { tx, get: vi.fn() };
});
vi.mock('@/db/client', () => ({ prisma: { $transaction: (callback: any) => callback(mocks.tx) } }));
vi.mock('@/shared/idGenerator', () => ({
  generateAdmissionNumber: () => 'ADM-TEST', generateInvoiceNumber: () => 'INV-TEST',
  generateReceiptNumber: () => 'REC-TEST', generateMedicineRequestNumber: () => 'REQ-TEST',
}));
vi.mock('../../ch-sharif-and-saeed-hospital---hms/src/services/apiClient', () => ({ default: { get: mocks.get } }));
vi.mock('../../ch-sharif-and-saeed-hospital---hms/src/services/patientRegistryService', () => ({ getPatientById: () => undefined }));
import { admissionService } from '../src/modules/admission/admission.service';
import { createPlannedAdmissionSchema } from '../src/modules/admission/admission.schemas';
import { fetchInvoiceDetail } from '../../ch-sharif-and-saeed-hospital---hms/src/services/invoiceService';
import { invoicePaymentStatus } from '../src/shared/invoicePaymentStatus';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.admissionRecord.create.mockImplementation(async ({ data }) => ({ id: 'admission', ...data }));
  mocks.tx.hospitalInvoice.create.mockImplementation(async ({ data }) => ({ id: 'invoice', ...data }));
  mocks.tx.serviceRate.findFirst.mockResolvedValue({ id: 'configured-service' });
  mocks.tx.paymentReceipt.create.mockImplementation(async ({ data }) => ({ id: 'receipt', ...data }));
  mocks.tx.invoiceLineItem.create.mockImplementation(async ({ data }) => ({ id: 'line', ...data }));
  mocks.tx.ward.findUnique.mockResolvedValue({ id: 'ward', departmentId: 'department', fixedPrice: new Decimal(750) });
  mocks.tx.hospitalInvoice.findFirst.mockResolvedValue({ id: 'invoice', lines: [], total: new Decimal(0), paidTotal: new Decimal(0) });
});

const base = { departmentId: 'department', selfPayEncounterId: 'patient', medicationMode: 'SELF' as const };

describe('admission advance payment and invoice status', () => {
  it.each([[500, 5000, 'PAID'], [500, 100, 'PARTIALLY_PAID'], [500, 0, 'UNPAID'], [0, 0, 'PAID']])(
    'derives status for charges %s and payments %s', async (total, paid, status) => {
      expect(invoicePaymentStatus(new Decimal(total), new Decimal(paid))).toBe(status);
      mocks.get.mockResolvedValue({ data: { data: {
        id: 'invoice', sourceType: 'ADMISSION', total, paidTotal: paid, status: 'PAID',
        lines: [{ id: 'old-advance', serviceRate: { code: 'ADM-ADVANCE' } },
          { id: 'ward', serviceRate: { code: 'WARD-FIXED' }, lineNet: total }],
        paymentReceipts: [{ admissionRecordId: 'admission', amount: paid }],
      } } });
      const invoice = await fetchInvoiceDetail('invoice');
      expect(invoice.status).toBe(status);
      expect(invoice.balanceDue).toBe(Math.max(0, Number(total) - Number(paid)));
      expect(invoice.advancePaid).toBe(Number(paid));
      expect(invoice.lines.map((line) => line.id)).toEqual(['ward']);
    },
  );

  it('keeps a 5000 advance as credit against the unchanged 500 ward charge', async () => {
    mocks.tx.ward.findUnique.mockResolvedValue({ id: 'ward', fixedPrice: new Decimal(500) });
    mocks.tx.hospitalInvoice.findFirst.mockResolvedValue({ id: 'invoice', total: new Decimal(0), paidTotal: new Decimal(5000), lines: [] });
    await admissionService.createPlannedAdmission({ ...base, wardId: 'ward', advanceAmount: 5000 }, 'actor');
    expect(mocks.tx.invoiceLineItem.create).toHaveBeenCalledTimes(1);
    expect(mocks.tx.invoiceLineItem.create.mock.calls[0][0].data.lineNet.toNumber()).toBe(500);
    expect(mocks.tx.hospitalInvoice.create.mock.calls[0][0].data.total.toNumber()).toBe(0);
    expect(mocks.tx.hospitalInvoice.create.mock.calls[0][0].data.paidTotal.toNumber()).toBe(5000);
    expect(mocks.tx.hospitalInvoice.update.mock.calls[0][0].data.status).toBe('PAID');
    expect(mocks.tx.paymentReceipt.create.mock.calls[0][0].data.amount.toNumber()).toBe(5000);
  });
});

describe('informational admission estimate', () => {
  it.each([undefined, 0, 99999.25])('stores estimate %s without adding any charge or receipt', async (estimatedAmount) => {
    const result = await admissionService.createPlannedAdmission({ ...base, estimatedAmount }, 'actor');
    expect(result.admission.estimatedAmount?.toString() ?? null).toBe(estimatedAmount === undefined ? null : String(estimatedAmount));
    expect(result.invoice.total.toString()).toBe('0');
    expect(result.invoice.paidTotal.toString()).toBe('0');
    expect(mocks.tx.invoiceLineItem.create).not.toHaveBeenCalled();
    expect(mocks.tx.paymentReceipt.create).not.toHaveBeenCalled();
    expect(mocks.tx.userCashBalance.create).not.toHaveBeenCalled();
  });

  it.each([0, 100, 100000])('keeps advance independent of estimate %s, including an advance greater than the estimate', async (estimatedAmount) => {
    await admissionService.createPlannedAdmission({ ...base, estimatedAmount, advanceAmount: 2500 }, 'actor');
    const receipt = mocks.tx.paymentReceipt.create.mock.calls[0][0].data;
    expect(receipt.amount.toString()).toBe('2500');
    expect(mocks.tx.userCashBalance.create.mock.calls[0][0].data.amount.toString()).toBe('2500');
    expect(mocks.tx.invoiceLineItem.create).not.toHaveBeenCalled();
    expect(mocks.tx.hospitalInvoice.create.mock.calls[0][0].data.total.toString()).toBe('0');
  });

  it.each([0, 90000])('preserves the configured ward charge independently of estimate %s', async (estimatedAmount) => {
    await admissionService.createPlannedAdmission({ ...base, estimatedAmount, wardId: 'ward' }, 'actor');
    expect(mocks.tx.invoiceLineItem.create.mock.calls[0][0].data.rateSnapshot.toString()).toBe('750');
    expect(mocks.tx.hospitalInvoice.update.mock.calls[0][0].data.total.increment.toString()).toBe('750');
    expect(mocks.tx.paymentReceipt.create).not.toHaveBeenCalled();
  });

  it('allows omitted/zero estimates and rejects negative estimates', () => {
    const patient = { newSelfPayPatient: { fullName: 'Test Patient' } };
    expect(createPlannedAdmissionSchema.safeParse(patient).success).toBe(true);
    expect(createPlannedAdmissionSchema.safeParse({ ...patient, estimatedAmount: 0 }).success).toBe(true);
    expect(createPlannedAdmissionSchema.safeParse({ ...patient, estimatedAmount: -1 }).success).toBe(false);
  });

  it.each([null, '0', '100000'])('maps estimate %s for documents without altering invoice amounts', async (estimatedAmount) => {
    mocks.get.mockResolvedValue({ data: { data: {
      id: 'invoice', sourceType: 'ADMISSION', admissionRecord: { admissionNumber: 'ADM-TEST', estimatedAmount },
      subtotal: '750', total: '750', paidTotal: '250', balanceDue: '500', lines: [], paymentReceipts: [],
    } } });
    const invoice = await fetchInvoiceDetail('invoice');
    expect(invoice.admissionEstimatedAmount).toBe(estimatedAmount === null ? null : Number(estimatedAmount));
    expect(invoice).toMatchObject({ subtotal: 750, total: 750, paidTotal: 250, balanceDue: 500 });
  });
});
