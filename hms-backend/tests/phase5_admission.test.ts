import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

// Mock prisma client
vi.mock('@/db/client', () => {
  const mockTx: any = {};
  const mockPrisma: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockTx)),
    admissionRecord: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    selfPayEncounter: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    bed: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    bedTransferHistory: {
      create: vi.fn(),
    },
    admissionPaymentRequest: {
      create: vi.fn(),
    },
    medicationModeHistory: {
      create: vi.fn(),
    },
    pharmacyClearance: {
      create: vi.fn(),
    },
    dualDischargeClearance: {
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    hospitalInvoice: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoiceLineItem: {
      create: vi.fn(),
    },
    serviceRate: {
      findUnique: vi.fn(),
    },
  };

  Object.keys(mockPrisma).forEach((key) => {
    if (key !== '$transaction') {
      mockTx[key] = mockPrisma[key];
    }
  });

  return { prisma: mockPrisma };
});

import { prisma } from '@/db/client';
import { admissionService } from '@/modules/admission/admission.service';

describe('Phase 5: Inpatient Admission, Bed Lifecycle & Dual Clearance Discharge Workflow', () => {
  const staffUserId = 'user-admission-staff-1';
  const doctorStaffId = 'staff-dr-specialist-1';
  const departmentId = 'dept-general-surgery';
  const bedId1 = 'bed-ward-a-01';
  const bedId2 = 'bed-ward-a-02';

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.selfPayEncounter.create as any).mockResolvedValue({
      id: 'self-pay-encounter-1',
      fullName: 'Kamran Akmal',
    });
  });

  describe('1. Planned Admission & Billing Hand-off (§4.7, D16 p.10)', () => {
    it('creates planned admission without occupying bed at booking time', async () => {
      (prisma.admissionRecord.create as any).mockResolvedValue({
        id: 'adm-001',
        admissionNumber: 'ADM-TEST-001',
        departmentId,
        doctorStaffId,
        bedId: bedId1,
        status: 'PLANNED',
        medicationMode: 'SELF',
        diagnosis: 'Acute Appendicitis',
      });

      const result = await admissionService.createPlannedAdmission(
        {
          departmentId,
          doctorStaffId,
          preferredBedId: bedId1,
          diagnosis: 'Acute Appendicitis',
          medicationMode: 'SELF',
          newSelfPayPatient: {
            fullName: 'Kamran Akmal',
            phone: '03211234567',
          },
        },
        staffUserId,
      );

      expect(prisma.admissionRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PLANNED',
            medicationMode: 'SELF',
          }),
        }),
      );
      // Confirms bed status was NOT updated to OCCUPIED during planned booking
      expect(prisma.bed.update).not.toHaveBeenCalled();
      expect(result.status).toBe('PLANNED');
    });

    it('raises payment request to Billing queue without collecting cash in admission', async () => {
      (prisma.admissionRecord.findUnique as any).mockResolvedValue({
        id: 'adm-001',
        admissionNumber: 'ADM-TEST-001',
      });

      (prisma.admissionPaymentRequest.create as any).mockResolvedValue({
        id: 'pay-req-001',
        admissionRecordId: 'adm-001',
        requestType: 'ADVANCE',
        requestedAmount: new Decimal(25000),
        status: 'PENDING',
      });

      const request = await admissionService.requestPayment(
        'adm-001',
        { requestType: 'ADVANCE', requestedAmount: 25000, notes: 'Admission initial deposit' },
        staffUserId,
      );

      expect(prisma.admissionPaymentRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            admissionRecordId: 'adm-001',
            requestType: 'ADVANCE',
            requestedAmount: new Decimal(25000),
            status: 'PENDING',
            requestedById: staffUserId,
          }),
        }),
      );
      expect(request.status).toBe('PENDING');
    });
  });

  describe('2. Bed Lifecycle: Check-in, Transfer & Running Charges (§4.7, D16 p.11)', () => {
    it('checks in admission, marks bed OCCUPIED, and initializes 3 clearance streams', async () => {
      (prisma.admissionRecord.findUnique as any).mockResolvedValue({
        id: 'adm-001',
        status: 'PLANNED',
        medicationMode: 'SELF',
        dischargeClearances: [],
      });

      (prisma.bed.findUnique as any).mockResolvedValue({
        id: bedId1,
        status: 'AVAILABLE',
      });

      (prisma.bed.update as any).mockResolvedValue({
        id: bedId1,
        status: 'OCCUPIED',
      });

      (prisma.admissionRecord.update as any).mockResolvedValue({
        id: 'adm-001',
        status: 'ACTIVE',
        bedId: bedId1,
      });

      (prisma.hospitalInvoice.findFirst as any).mockResolvedValue(null);
      (prisma.hospitalInvoice.create as any).mockResolvedValue({
        id: 'inv-adm-001',
        sourceType: 'ADMISSION',
      });

      const updated = await admissionService.checkInAdmission(
        'adm-001',
        { bedId: bedId1 },
        staffUserId,
      );

      // Bed is marked OCCUPIED on check-in
      expect(prisma.bed.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: bedId1 },
          data: { status: 'OCCUPIED' },
        }),
      );

      // Admission status becomes ACTIVE
      expect(prisma.admissionRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'adm-001' },
          data: expect.objectContaining({
            status: 'ACTIVE',
            bedId: bedId1,
          }),
        }),
      );

      // 3 Clearance streams are initialized
      expect(prisma.dualDischargeClearance.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ clearanceType: 'CLINICAL', status: 'PENDING' }),
            expect.objectContaining({ clearanceType: 'HOSPITAL_BILLING', status: 'PENDING' }),
            expect.objectContaining({ clearanceType: 'PHARMACY', status: 'NOT_APPLICABLE' }), // SELF mode
          ]),
        }),
      );

      expect(updated.status).toBe('ACTIVE');
    });

    it('transfers patient to new bed: frees old bed to AVAILABLE, occupies new bed, and logs transfer history', async () => {
      (prisma.admissionRecord.findUnique as any).mockResolvedValue({
        id: 'adm-001',
        status: 'ACTIVE',
        bedId: bedId1,
      });

      (prisma.bed.findUnique as any).mockResolvedValue({
        id: bedId2,
        status: 'AVAILABLE',
      });

      (prisma.bed.update as any)
        .mockResolvedValueOnce({ id: bedId1, status: 'AVAILABLE' }) // old bed freed
        .mockResolvedValueOnce({ id: bedId2, status: 'OCCUPIED' }); // new bed occupied

      (prisma.bedTransferHistory.create as any).mockResolvedValue({
        id: 'transfer-001',
        fromBedId: bedId1,
        toBedId: bedId2,
        reason: 'Shifted to private room',
      });

      (prisma.admissionRecord.update as any).mockResolvedValue({
        id: 'adm-001',
        bedId: bedId2,
      });

      const result = await admissionService.transferBed(
        'adm-001',
        { targetBedId: bedId2, reason: 'Shifted to private room' },
        staffUserId,
      );

      // Old bed freed
      expect(prisma.bed.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: bedId1 },
          data: { status: 'AVAILABLE' },
        }),
      );

      // New bed occupied
      expect(prisma.bed.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: bedId2 },
          data: { status: 'OCCUPIED' },
        }),
      );

      // Transfer history logged
      expect(prisma.bedTransferHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            admissionRecordId: 'adm-001',
            fromBedId: bedId1,
            toBedId: bedId2,
            reason: 'Shifted to private room',
            transferredById: staffUserId,
          }),
        }),
      );

      expect(result.admission.bedId).toBe(bedId2);
    });

    it('appends billable hospital service to running admission invoice', async () => {
      (prisma.admissionRecord.findUnique as any).mockResolvedValue({
        id: 'adm-001',
        status: 'ACTIVE',
        hospitalInvoices: [
          {
            id: 'inv-adm-1',
            subtotal: new Decimal(10000),
            total: new Decimal(10000),
            paidTotal: new Decimal(5000),
            lines: [],
          },
        ],
        panelPatient: null,
      });

      (prisma.serviceRate.findUnique as any).mockResolvedValue({
        id: 'srv-rate-ecg',
        standardRate: new Decimal(3000),
        isActive: true,
      });

      (prisma.invoiceLineItem.create as any).mockResolvedValue({
        id: 'line-srv-1',
        lineGross: new Decimal(3000),
        discountAmount: new Decimal(0),
        lineNet: new Decimal(3000),
      });

      const line = await admissionService.addAdmissionService(
        'adm-001',
        { serviceRateId: 'srv-rate-ecg', quantity: 1, notes: 'Daily doctor rounds' },
        staffUserId,
      );

      expect(prisma.invoiceLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rateSnapshot: new Decimal(3000),
            lineGross: new Decimal(3000),
            lineNet: new Decimal(3000),
          }),
        }),
      );
      expect(line.lineNet).toEqual(new Decimal(3000));
    });
  });

  describe('3. Medication Mode & Pharmacy Integration (§4.7 Sub-flow C, D16 p.12)', () => {
    it('toggles mode to HOSPITAL_MANAGED with immutable reason and updates pharmacy clearance', async () => {
      (prisma.admissionRecord.findUnique as any).mockResolvedValue({
        id: 'adm-001',
        status: 'ACTIVE',
        medicationMode: 'SELF',
        dischargeClearances: [],
      });

      (prisma.medicationModeHistory.create as any).mockResolvedValue({
        id: 'mode-hist-1',
        previousMode: 'SELF',
        newMode: 'HOSPITAL_MANAGED',
        reason: 'Patient requested hospital medicines for surgery',
      });

      (prisma.admissionRecord.update as any).mockResolvedValue({
        id: 'adm-001',
        medicationMode: 'HOSPITAL_MANAGED',
      });

      const result = await admissionService.changeMedicationMode(
        'adm-001',
        { mode: 'HOSPITAL_MANAGED', reason: 'Patient requested hospital medicines for surgery' },
        staffUserId,
      );

      expect(prisma.medicationModeHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            admissionRecordId: 'adm-001',
            previousMode: 'SELF',
            newMode: 'HOSPITAL_MANAGED',
            reason: 'Patient requested hospital medicines for surgery',
            changedById: staffUserId,
          }),
        }),
      );

      // Updates Pharmacy clearance stream to PENDING
      expect(prisma.dualDischargeClearance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { admissionRecordId: 'adm-001', clearanceType: 'PHARMACY' },
          data: { status: 'PENDING' },
        }),
      );

      expect(result.admission.medicationMode).toBe('HOSPITAL_MANAGED');
    });

    it('blocks pharmacy request when medication mode is SELF', async () => {
      (prisma.admissionRecord.findUnique as any).mockResolvedValue({
        id: 'adm-001',
        medicationMode: 'SELF',
      });

      await expect(
        admissionService.createPharmacyRequest(
          'adm-001',
          {
            lines: [{ medicineId: 'med-001', requestedQuantity: 2 }],
          },
          staffUserId,
        ),
      ).rejects.toThrow(/permitted only when Medication Mode is HOSPITAL_MANAGED/);
    });

    it('creates pharmacy request when mode is HOSPITAL_MANAGED', async () => {
      (prisma.admissionRecord.findUnique as any).mockResolvedValue({
        id: 'adm-001',
        medicationMode: 'HOSPITAL_MANAGED',
      });

      (prisma.pharmacyClearance.create as any).mockResolvedValue({
        id: 'pharm-req-001',
        status: 'REQUESTED',
      });

      const req = await admissionService.createPharmacyRequest(
        'adm-001',
        {
          lines: [{ medicineId: 'med-paracetamol', requestedQuantity: 5 }],
          notes: 'Post-op analgesics',
        },
        staffUserId,
      );

      expect(prisma.pharmacyClearance.create).toHaveBeenCalled();
      expect(req.status).toBe('REQUESTED');
    });
  });

  describe('4. Dual / 3-Key Discharge Gate (§4.7 Sub-flow D, D16 p.13)', () => {
    it('blocks discharge when clearances are still pending', async () => {
      (prisma.admissionRecord.findUnique as any).mockResolvedValue({
        id: 'adm-001',
        status: 'ACTIVE',
        dischargeClearances: [
          { clearanceType: 'CLINICAL', status: 'CLEARED' },
          { clearanceType: 'HOSPITAL_BILLING', status: 'PENDING' }, // Still unpaid
          { clearanceType: 'PHARMACY', status: 'PENDING' }, // Medicines not cleared
        ],
      });

      await expect(
        admissionService.dischargePatient('adm-001', staffUserId),
      ).rejects.toThrow(/The following clearances are still pending: \[HOSPITAL_BILLING, PHARMACY\]/);
    });

    it('blocks hospital billing clearance if patient has outstanding unpaid invoices', async () => {
      (prisma.admissionRecord.findUnique as any).mockResolvedValue({
        id: 'adm-001',
        hospitalInvoices: [
          { total: new Decimal(20000), paidTotal: new Decimal(10000) }, // 10,000 outstanding
        ],
        dischargeClearances: [
          { id: 'dc-1', clearanceType: 'HOSPITAL_BILLING', status: 'PENDING' },
        ],
      });

      await expect(
        admissionService.grantClearance(
          'adm-001',
          { clearanceType: 'HOSPITAL_BILLING' },
          staffUserId,
        ),
      ).rejects.toThrow(/patient has unpaid hospital invoices/);
    });

    it('allows final discharge when all 3 clearances are cleared and automatically frees bed to AVAILABLE', async () => {
      (prisma.admissionRecord.findUnique as any).mockResolvedValue({
        id: 'adm-001',
        status: 'ACTIVE',
        bedId: bedId1,
        dischargeClearances: [
          { clearanceType: 'CLINICAL', status: 'CLEARED' },
          { clearanceType: 'HOSPITAL_BILLING', status: 'CLEARED' },
          { clearanceType: 'PHARMACY', status: 'CLEARED' },
        ],
      });

      (prisma.admissionRecord.update as any).mockResolvedValue({
        id: 'adm-001',
        status: 'DISCHARGED',
        dischargedAt: new Date(),
      });

      (prisma.bed.update as any).mockResolvedValue({
        id: bedId1,
        status: 'AVAILABLE',
      });

      const result = await admissionService.dischargePatient('adm-001', staffUserId);

      // Admission status set to DISCHARGED
      expect(prisma.admissionRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'adm-001' },
          data: expect.objectContaining({ status: 'DISCHARGED' }),
        }),
      );

      // Bed is automatically freed to AVAILABLE
      expect(prisma.bed.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: bedId1 },
          data: { status: 'AVAILABLE' },
        }),
      );

      expect(result.admission.status).toBe('DISCHARGED');
    });
  });
});
