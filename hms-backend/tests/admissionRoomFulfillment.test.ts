import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authorize } from '../src/middleware/authorize';
import { Decimal } from '@prisma/client/runtime/library';
const { db, api } = vi.hoisted(() => ({ api: { get: vi.fn() }, db: {
  admissionRecord: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  bed: { findUnique: vi.fn(), update: vi.fn() },
  hospitalInvoice: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  invoiceLineItem: { create: vi.fn() },
  admissionRoomChargeLog: { findFirst: vi.fn(), create: vi.fn() },
  serviceRate: { findFirst: vi.fn() },
  paymentReceipt: { findMany: vi.fn() },
} }));
vi.mock('@/db/client', () => ({ prisma: { ...db, $transaction: (fn: any) => fn(db) } }));
vi.mock('@/shared/idGenerator', () => ({ generateAdmissionNumber: () => 'ADM-TEST', generateInvoiceNumber: () => 'INV-TEST' }));
vi.mock('../../ch-sharif-and-saeed-hospital---hms/src/services/apiClient', () => ({ default: api }));
vi.mock('../../ch-sharif-and-saeed-hospital---hms/src/services/patientRegistryService', () => ({ getPatientById: () => undefined, getAllPatients: () => [] }));
import { admissionService } from '../src/modules/admission/admission.service';
import { admissionBillingService } from '../src/modules/frontdesk/admissionBilling.service';
import { fetchInvoiceDetail } from '../../ch-sharif-and-saeed-hospital---hms/src/services/invoiceService';
import { fetchAdmissionLedger } from '../../ch-sharif-and-saeed-hospital---hms/src/services/admissionBillingService';
import { fetchAdmissions } from '../../ch-sharif-and-saeed-hospital---hms/src/services/admissionService';

const admission = { id: 'admission', departmentId: 'department', bedId: 'bed', medicationMode: 'HOSPITAL_MANAGED', status: 'PLANNED', dischargeClearances: [{}] };
beforeEach(() => {
  vi.resetAllMocks();
  db.admissionRecord.create.mockImplementation(async ({ data }) => ({ id: 'admission', ...data }));
  db.admissionRecord.findUnique.mockResolvedValue(admission);
  db.admissionRecord.update.mockResolvedValue({ ...admission, status: 'ACTIVE' });
  db.bed.findUnique.mockResolvedValue({ id: 'bed', status: 'AVAILABLE', operationalStatus: 'ACTIVE', room: { dailyRoomRate: new Decimal(1500), ward: null } });
  db.hospitalInvoice.create.mockImplementation(async ({ data }) => ({ id: 'invoice', ...data }));
  db.hospitalInvoice.findFirst.mockResolvedValue({ id: 'invoice', lines: [], paidTotal: new Decimal(0) });
  db.serviceRate.findFirst.mockResolvedValue({ id: 'room-charge' });
  db.invoiceLineItem.create.mockImplementation(async ({ data }) => ({ id: 'line', ...data }));
  db.paymentReceipt.findMany.mockResolvedValue([]);
});

describe('initial room charge and fulfillment', () => {
  it.each(['selected-department', undefined])('preserves assigned department %s and only falls back to the ward when omitted', async (departmentId) => {
    db.bed.findUnique.mockResolvedValue({ id: 'bed', status: 'AVAILABLE', operationalStatus: 'ACTIVE', ward: { departmentId: 'ward-department' }, room: null });
    const result = await admissionService.createPlannedAdmission({ departmentId, preferredBedId: 'bed', selfPayEncounterId: 'patient', medicationMode: 'HOSPITAL_MANAGED', outsourcedFulfillmentMode: 'HOSPITAL_MANAGED' }, 'actor');
    expect(result.admission.departmentId).toBe(departmentId ?? 'ward-department');
    expect(db.hospitalInvoice.create.mock.calls[0][0].data.departmentId).toBe(departmentId ?? 'ward-department');
  });
  it('exposes the assigned department in the ledger independently of service invoice departments', async () => {
    db.admissionRecord.findUnique.mockResolvedValue({ ...admission, department: { id: 'department', name: 'Assigned Department' }, hospitalInvoices: [] });
    const raw = await admissionBillingService.getLedger('admission');
    expect(raw.departmentName).toBe('Assigned Department');
    api.get.mockResolvedValue({ data: { data: raw } });
    expect((await fetchAdmissionLedger('admission')).departmentName).toBe('Assigned Department');
    api.get.mockResolvedValue({ data: { data: { sourceType: 'ADMISSION', department: { name: 'Service Department' }, admissionRecord: { department: { name: 'Assigned Department' } } } } });
    const invoice = await fetchInvoiceDetail('invoice');
    expect(invoice.admissionDepartmentName).toBe('Assigned Department');
    expect(invoice.departmentName).toBe('Service Department');
  });
  it('preserves the real patient MR and department in admission details', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'admission', departmentId: 'department', department: { name: 'Assigned Department' }, panelPatient: { fullName: 'Patient', mrNumber: 'MR-REAL-123' } }] } });
    const [record] = await fetchAdmissions();
    expect(record.patientMrNumber).toBe('MR-REAL-123');
    expect(record.departmentName).toBe('Assigned Department');
  });
  it('posts standalone room pricing at front desk registration', async () => {
    const result = await admissionService.createPlannedAdmission({ departmentId: 'department', preferredBedId: 'bed', selfPayEncounterId: 'patient', medicationMode: 'HOSPITAL_MANAGED' }, 'actor');
    expect(result.admission.medicationMode).toBe('HOSPITAL_MANAGED');
    expect(db.invoiceLineItem.create.mock.calls[0][0].data.lineNet.toNumber()).toBe(1500);
    expect(db.hospitalInvoice.update.mock.calls[0][0].data.total.toNumber()).toBe(1500);
    expect(db.admissionRoomChargeLog.create).toHaveBeenCalledTimes(1);
  });
  it('posts room pricing at check-in when it was not posted at intake', async () => {
    await admissionService.checkInAdmission('admission', { bedId: 'bed' }, 'actor');
    expect(db.invoiceLineItem.create.mock.calls[0][0].data.rateSnapshot.toNumber()).toBe(1500);
  });
  it('does not post the initial charge twice when checking in', async () => {
    db.admissionRoomChargeLog.findFirst.mockResolvedValue({ id: 'existing' });
    await admissionService.checkInAdmission('admission', { bedId: 'bed' }, 'actor');
    expect(db.invoiceLineItem.create).not.toHaveBeenCalled();
  });
  it.each([null, 0])('does not charge an optional room rate of %s', async (rate) => {
    db.bed.findUnique.mockResolvedValue({ id: 'bed', status: 'AVAILABLE', operationalStatus: 'ACTIVE', room: { dailyRoomRate: rate === null ? null : new Decimal(rate) } });
    await admissionService.checkInAdmission('admission', { bedId: 'bed' }, 'actor');
    expect(db.invoiceLineItem.create).not.toHaveBeenCalled();
  });
  it.each([[null, 'PAID'], ['[Self-Arranged]', 'SELF']])('classifies zero-price line with marker %s as %s', async (discountReason, status) => {
    db.admissionRecord.findUnique.mockResolvedValue({ ...admission, hospitalInvoices: [{ id: 'invoice', invoiceNumber: 'INV', total: new Decimal(0), lines: [{
      id: 'line', createdAt: new Date(), serviceRate: { name: 'Service' }, discountReason,
      lineNet: new Decimal(0), lineGross: new Decimal(0), discountAmount: new Decimal(0), rateSnapshot: new Decimal(0), quantity: new Decimal(1),
    }] }] });
    const ledger = await admissionBillingService.getLedger('admission');
    expect(ledger.medicationMode).toBe('HOSPITAL_MANAGED');
    expect(ledger.entries[0].status).toBe(status);
    api.get.mockResolvedValue({ data: { data: ledger } });
    expect((await fetchAdmissionLedger('admission')).medicationMode).toBe('HOSPITAL_MANAGED');
  });
  it('maps saved fulfillment to invoice documents independently of self-pay payer', async () => {
    api.get.mockResolvedValue({ data: { data: { id: 'invoice', sourceType: 'ADMISSION', admissionRecord: { medicationMode: 'HOSPITAL_MANAGED' } } } });
    const invoice = await fetchInvoiceDetail('invoice');
    expect(invoice.admissionMedicationMode).toBe('HOSPITAL_MANAGED');
    expect(invoice.payerType).toBe('Self Pay');
  });
});


describe('Admission portal read-only ledger', () => {
  it.each([[10000, 0, 5000], [2000, 3000, 0], [5000, 0, 0]])('shows real payments %s as outstanding %s and remaining credit %s without changing admission', async (paid, outstanding, credit) => {
    db.admissionRecord.findUnique.mockResolvedValue({ ...admission, status: 'DISCHARGE_PENDING', hospitalInvoices: [{ id: 'invoice', total: new Decimal(5000), lines: [] }] });
    db.paymentReceipt.findMany.mockResolvedValue([{ id: 'receipt', amount: new Decimal(paid), collectedAt: new Date(), collectedBy: null }]);
    const raw = await admissionBillingService.getLedger('admission', true);
    expect(raw.summary.outstandingBalance.toNumber()).toBe(outstanding);
    expect(raw.summary.availableCredit.toNumber()).toBe(credit);
    expect(raw.status).toBe('DISCHARGE_PENDING');
    expect(db.admissionRecord.update).not.toHaveBeenCalled();
    expect(db.bed.update).not.toHaveBeenCalled();
    api.get.mockResolvedValue({ data: { data: raw } });
    const ledger = await fetchAdmissionLedger('admission', true);
    expect(api.get).toHaveBeenCalledWith('/admissions/admission/ledger');
    expect(ledger.summary).toEqual({ totalCharges: 5000, totalPaid: paid, outstandingBalance: outstanding, availableCredit: credit });
  });
  it('allows Admission to read ledgers but rejects collecting payments', () => {
    const req = { user: { role: 'ADMISSION' } } as any;
    const next = vi.fn();
    authorize('admission', 'view')(req, {} as any, next);
    expect(next).toHaveBeenCalledOnce();
    expect(() => authorize('frontdesk', 'create')(req, {} as any, next)).toThrow();
  });
});


describe('Discharged patients directory', () => {
  it('fetches only discharged admissions without truncating historical records', async () => {
    const rows = Array.from({ length: 125 }, (_, i) => ({ id: String(i), status: 'DISCHARGED' }));
    db.admissionRecord.findMany.mockResolvedValue(rows);
    expect(await admissionService.listAdmissions({ status: 'DISCHARGED' })).toHaveLength(125);
    const query = db.admissionRecord.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ status: 'DISCHARGED' });
    expect(query.take).toBeUndefined();
  });
  it('preserves existing active list limits', async () => {
    db.admissionRecord.findMany.mockResolvedValue([]);
    await admissionService.listAdmissions({ status: 'ACTIVE' });
    expect(db.admissionRecord.findMany.mock.calls[0][0].take).toBe(100);
  });
  it('loads discharged dates and patient identity through the real admission API mapping', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'admission', status: 'DISCHARGED', dischargedAt: '2026-09-22T10:00:00Z', panelPatient: { fullName: 'Patient', mrNumber: 'MR-123' } }] } });
    const rows = await fetchAdmissions({ status: 'DISCHARGED' });
    expect(api.get).toHaveBeenCalledWith('/admissions', { params: { status: 'DISCHARGED' } });
    expect(rows[0].patientMrNumber).toBe('MR-123');
    expect(rows[0].dischargedAt).not.toBe('');
  });
});
