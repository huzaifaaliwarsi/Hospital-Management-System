import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

// Mock prisma client
vi.mock('@/db/client', () => {
  const mockTx: any = {};
  const mockPrisma: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockTx)),
    appointment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    selfPayEncounter: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    serviceRate: {
      findUnique: vi.fn(),
    },
    hospitalInvoice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoiceLineItem: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    paymentReceipt: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    userCashBalance: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    doctorCommissionRule: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    doctorCommissionAccrual: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    commissionReversal: {
      create: vi.fn(),
    },
    hospitalProfile: {
      findFirst: vi.fn(),
    },
  };

  // Bind transaction methods to mockPrisma methods for testing
  Object.keys(mockPrisma).forEach((key) => {
    if (key !== '$transaction') {
      mockTx[key] = mockPrisma[key];
    }
  });

  return { prisma: mockPrisma };
});

import { prisma } from '@/db/client';
import { appointmentsService } from '@/modules/frontdesk/appointments.service';
import { invoicesService } from '@/modules/frontdesk/invoices.service';
import { commissionService } from '@/modules/commission/commission.service';
import { cashService } from '@/modules/cash/cash.service';

describe('Phase 4: Front Desk Billing, Appointments & Doctor Commission Engine', () => {
  const cashierId = 'user-cashier-123';
  const doctorStaffId = 'staff-dr-456';
  const serviceRateId = 'service-rate-789';

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.selfPayEncounter.create as any).mockResolvedValue({
      id: 'self-pay-mock-id',
      fullName: 'Ahmad Khan',
    });
  });

  describe('1. Appointments Flow & Advance Collection (§4.6, D16 p.8)', () => {
    it('books an appointment with advance payment and logs cashier physical cash', async () => {
      (prisma.serviceRate.findUnique as any).mockResolvedValue({
        id: serviceRateId,
        name: 'Consultation - General OPD',
        standardRate: new Decimal(2000),
        isActive: true,
      });

      (prisma.appointment.create as any).mockResolvedValue({
        id: 'apt-001',
        departmentId: 'dept-1',
        doctorStaffId,
        serviceRateId,
        status: 'CONFIRMED',
        estimatedAmount: new Decimal(2000),
      });

      (prisma.paymentReceipt.create as any).mockResolvedValue({
        id: 'rec-001',
        receiptNumber: 'REC-TEST-001',
        amount: new Decimal(500),
        method: 'CASH',
      });

      (prisma.userCashBalance.create as any).mockResolvedValue({
        id: 'cash-001',
        amount: new Decimal(500),
        isPhysicalCash: true,
      });

      const result = await appointmentsService.bookAppointment(
        {
          departmentId: 'dept-1',
          doctorStaffId,
          serviceRateId,
          slotAt: new Date(),
          advanceAmount: 500,
          paymentMethod: 'CASH',
          newSelfPayPatient: {
            fullName: 'Ahmad Khan',
            phone: '03001234567',
          },
        },
        cashierId,
      );

      expect(prisma.selfPayEncounter.create).toHaveBeenCalled();
      expect(prisma.appointment.create).toHaveBeenCalled();
      expect(prisma.paymentReceipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: new Decimal(500),
            method: 'CASH',
            collectedById: cashierId,
          }),
        }),
      );
      // Confirms cashier physical cash ledger is updated
      expect(prisma.userCashBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            portalUserId: cashierId,
            moduleScope: 'BILLING',
            direction: 'IN',
            amount: new Decimal(500),
            isPhysicalCash: true,
          }),
        }),
      );
      expect(result.advanceReceipt).toBeDefined();
    });

    it('collects advance via digital payment without inflating physical cash', async () => {
      (prisma.appointment.findUnique as any).mockResolvedValue({
        id: 'apt-002',
        hospitalInvoices: [],
      });

      (prisma.paymentReceipt.create as any).mockResolvedValue({
        id: 'rec-002',
        receiptNumber: 'REC-TEST-002',
        amount: new Decimal(1000),
        method: 'CARD',
      });

      await appointmentsService.collectAdvance(
        'apt-002',
        { amount: 1000, paymentMethod: 'CARD' },
        cashierId,
      );

      expect(prisma.userCashBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            portalUserId: cashierId,
            amount: new Decimal(1000),
            isPhysicalCash: false, // Card tracked as non-physical
          }),
        }),
      );
    });

    it('checks in appointment and converts to encounter with advance credited', async () => {
      (prisma.appointment.findUnique as any).mockResolvedValue({
        id: 'apt-001',
        serviceRateId,
        doctorStaffId,
        panelPatientId: null,
        selfPayEncounterId: 'self-pay-1',
        serviceRate: { id: serviceRateId, standardRate: new Decimal(2000) },
        hospitalInvoices: [],
        panelPatient: null,
      });

      // Mock prior advance receipt of 500 PKR
      (prisma.paymentReceipt.findMany as any).mockResolvedValue([
        { id: 'rec-001', amount: new Decimal(500) },
      ]);

      (prisma.hospitalInvoice.create as any).mockResolvedValue({
        id: 'inv-001',
        invoiceNumber: 'INV-TEST-001',
        subtotal: new Decimal(2000),
        total: new Decimal(2000),
        paidTotal: new Decimal(500),
        status: 'PARTIALLY_PAID',
      });

      (prisma.appointment.update as any).mockResolvedValue({
        id: 'apt-001',
        status: 'CHECKED_IN',
      });

      const result = await appointmentsService.checkInAppointment(
        'apt-001',
        { encounterType: 'OPD' },
        cashierId,
      );

      expect(prisma.hospitalInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceType: 'APPOINTMENT',
            encounterType: 'OPD',
            paidTotal: new Decimal(500), // Advance credited
            status: 'PARTIALLY_PAID',
          }),
        }),
      );
      expect(result.appointment.status).toBe('CHECKED_IN');
    });
  });

  describe('2. Invoicing, Corporate Panel Discounts & Policy Threshold (§4.6, §16 Q-05)', () => {
    it('creates walk-in OPD encounter', async () => {
      (prisma.hospitalInvoice.create as any).mockResolvedValue({
        id: 'inv-walkin-1',
        invoiceNumber: 'INV-WALKIN-1',
        sourceType: 'WALK_IN',
        encounterType: 'OPD',
        subtotal: new Decimal(0),
        total: new Decimal(0),
        status: 'UNPAID',
      });

      const invoice = await invoicesService.createEncounter(
        {
          encounterType: 'OPD',
          newSelfPayPatient: { fullName: 'Usman Tariq', phone: '03009876543' },
        },
        cashierId,
      );

      expect(invoice.sourceType).toBe('WALK_IN');
      expect(invoice.status).toBe('UNPAID');
    });

    it('automatically applies panel discount when adding service for corporate panel patient', async () => {
      (prisma.hospitalInvoice.findUnique as any).mockResolvedValue({
        id: 'inv-panel-1',
        status: 'UNPAID',
        paidTotal: new Decimal(0),
        panelPatient: {
          corporatePanel: {
            discountRules: [
              { serviceRateId, discountPercent: new Decimal(20) }, // 20% panel discount
            ],
          },
        },
        lines: [],
      });

      (prisma.serviceRate.findUnique as any).mockResolvedValue({
        id: serviceRateId,
        standardRate: new Decimal(5000),
        isActive: true,
        discountAllowed: true,
      });

      (prisma.invoiceLineItem.create as any).mockResolvedValue({
        id: 'line-panel-1',
        lineGross: new Decimal(5000),
        discountAmount: new Decimal(1000), // 20% of 5000
        lineNet: new Decimal(4000),
      });

      const line = await invoicesService.addServiceLine(
        'inv-panel-1',
        { serviceRateId, quantity: 1, performedByStaffId: doctorStaffId },
        cashierId,
        'FRONT_DESK_BILLING',
      );

      expect(prisma.invoiceLineItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lineGross: new Decimal(5000),
            discountAmount: new Decimal(1000),
            lineNet: new Decimal(4000),
          }),
        }),
      );
      expect(line.lineNet).toEqual(new Decimal(4000));
    });

    it('blocks manual discount exceeding threshold for non-admin cashier without approval', async () => {
      (prisma.hospitalInvoice.findUnique as any).mockResolvedValue({
        id: 'inv-regular-1',
        status: 'UNPAID',
        paidTotal: new Decimal(0),
        panelPatient: null,
        lines: [],
      });

      (prisma.serviceRate.findUnique as any).mockResolvedValue({
        id: serviceRateId,
        standardRate: new Decimal(10000),
        isActive: true,
        discountAllowed: true,
      });

      // Attempt 30% discount (> 15% policy threshold) as FRONT_DESK_BILLING
      await expect(
        invoicesService.addServiceLine(
          'inv-regular-1',
          { serviceRateId, quantity: 1, discountPercent: 30 },
          cashierId,
          'FRONT_DESK_BILLING',
        ),
      ).rejects.toThrow(/Admin approval/);
    });

    it('permits discount exceeding threshold when applied by ADMIN', async () => {
      (prisma.hospitalInvoice.findUnique as any).mockResolvedValue({
        id: 'inv-regular-2',
        status: 'UNPAID',
        paidTotal: new Decimal(0),
        panelPatient: null,
        lines: [],
      });

      (prisma.serviceRate.findUnique as any).mockResolvedValue({
        id: serviceRateId,
        standardRate: new Decimal(10000),
        isActive: true,
        discountAllowed: true,
      });

      (prisma.invoiceLineItem.create as any).mockResolvedValue({
        id: 'line-admin-1',
        lineGross: new Decimal(10000),
        discountAmount: new Decimal(3000),
        lineNet: new Decimal(7000),
      });

      const line = await invoicesService.addServiceLine(
        'inv-regular-2',
        { serviceRateId, quantity: 1, discountPercent: 30 },
        'admin-user-id',
        'ADMIN',
      );

      expect(line).toBeDefined();
    });
  });

  describe('3. Doctor Commission Calculation Engine (§4.5, D15 §4, D16 p.21)', () => {
    it('calculates doctor commission on NET eligible amount and computes hospital share', async () => {
      const mockTx: any = {
        doctorCommissionAccrual: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation((args) => args.data),
        },
        doctorCommissionRule: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'rule-001',
            staffId: doctorStaffId,
            serviceRateId,
            ruleType: 'PERCENTAGE',
            rate: new Decimal(20), // 20%
            basis: 'NET',
          }),
        },
      };

      // Service Gross = 5,000; Discount = 1,000; Net = 4,000
      // Commission @20% of Net = 800 PKR
      // Hospital Remaining Share = 4,000 - 800 = 3,200 PKR
      const lineItem = {
        id: 'line-comm-1',
        serviceRateId,
        quantity: new Decimal(1),
        lineGross: new Decimal(5000),
        discountAmount: new Decimal(1000),
        lineNet: new Decimal(4000),
      };

      const accrual: any = await commissionService.calculateAndAccrueCommission(
        mockTx,
        lineItem,
        doctorStaffId,
      );

      expect(accrual.commissionAmount).toEqual(new Decimal(800));
      expect(accrual.ruleSnapshot.hospitalRemainingShare).toBe(3200);
      expect(accrual.status).toBe('ACCRUED');
    });

    it('calculates FIXED_PER_SERVICE doctor commission', async () => {
      const mockTx: any = {
        doctorCommissionAccrual: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation((args) => args.data),
        },
        doctorCommissionRule: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'rule-fixed-1',
            staffId: doctorStaffId,
            serviceRateId: null, // default rule
            ruleType: 'FIXED_PER_SERVICE',
            rate: new Decimal(900), // PKR 900 fixed per consultation
            basis: 'NET',
          }),
        },
      };

      const lineItem = {
        id: 'line-comm-fixed',
        serviceRateId,
        quantity: new Decimal(2),
        lineGross: new Decimal(4000),
        discountAmount: new Decimal(0),
        lineNet: new Decimal(4000),
      };

      const accrual: any = await commissionService.calculateAndAccrueCommission(
        mockTx,
        lineItem,
        doctorStaffId,
      );

      // 900 * 2 = 1800 PKR
      expect(accrual.commissionAmount).toEqual(new Decimal(1800));
      expect(accrual.ruleSnapshot.hospitalRemainingShare).toBe(2200);
    });

    it('creates linked commission reversal on refund without silent delete', async () => {
      const mockTx: any = {
        doctorCommissionAccrual: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'accrual-123',
            commissionAmount: new Decimal(800),
          }),
        },
        commissionReversal: {
          create: vi.fn().mockResolvedValue({
            id: 'rev-001',
            doctorCommissionAccrualId: 'accrual-123',
            reversalAmount: new Decimal(800),
          }),
        },
      };

      const reversal = await commissionService.reverseCommissionAccrual(
        mockTx,
        'line-comm-1',
        'Patient refunded consultation',
        cashierId,
      );

      expect(mockTx.commissionReversal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            doctorCommissionAccrualId: 'accrual-123',
            reversalAmount: new Decimal(800),
          }),
        }),
      );
      expect(reversal).toBeDefined();
    });
  });

  describe('4. Final Invoice Payment Collection & Cashier Accountability (§4.6, §4.9, §8.12)', () => {
    it('collects cash payment, marks invoice PAID, and logs cash custody', async () => {
      (prisma.hospitalInvoice.findUnique as any).mockResolvedValue({
        id: 'inv-final-1',
        invoiceNumber: 'INV-FINAL-1',
        total: new Decimal(4000),
        paidTotal: new Decimal(1000), // 1000 advance already paid
        status: 'PARTIALLY_PAID',
        lines: [],
      });

      (prisma.paymentReceipt.create as any).mockResolvedValue({
        id: 'rec-final-1',
        receiptNumber: 'REC-FINAL-1',
        amount: new Decimal(3000),
        method: 'CASH',
      });

      (prisma.hospitalInvoice.update as any).mockResolvedValue({
        id: 'inv-final-1',
        total: new Decimal(4000),
        paidTotal: new Decimal(4000),
        status: 'PAID',
      });

      const { receipt, invoice } = await invoicesService.collectPayment(
        'inv-final-1',
        { amount: 3000, paymentMethod: 'CASH' },
        cashierId,
      );

      expect(receipt.amount).toEqual(new Decimal(3000));
      expect(invoice.status).toBe('PAID');
      expect(prisma.userCashBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            portalUserId: cashierId,
            moduleScope: 'BILLING',
            direction: 'IN',
            amount: new Decimal(3000),
            isPhysicalCash: true,
          }),
        }),
      );
    });

    it('processes refund and creates OUT transaction reducing cashier physical cash', async () => {
      (prisma.hospitalInvoice.findUnique as any).mockResolvedValue({
        id: 'inv-refund-1',
        invoiceNumber: 'INV-REFUND-1',
        total: new Decimal(4000),
        paidTotal: new Decimal(4000),
        status: 'PAID',
        lines: [],
      });

      (prisma.paymentReceipt.create as any).mockResolvedValue({
        id: 'rec-refund-1',
        amount: new Decimal(-1000),
        isReversed: true,
      });

      (prisma.hospitalInvoice.update as any).mockResolvedValue({
        id: 'inv-refund-1',
        paidTotal: new Decimal(3000),
        status: 'PARTIALLY_PAID',
      });

      const result = await invoicesService.refundPayment(
        'inv-refund-1',
        { amount: 1000, refundMethod: 'CASH', reason: 'Service cancelled by patient' },
        cashierId,
      );

      expect(prisma.userCashBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            portalUserId: cashierId,
            moduleScope: 'BILLING',
            direction: 'OUT',
            amount: new Decimal(1000),
            category: 'REFUND',
            isPhysicalCash: true,
          }),
        }),
      );
      expect(result.invoice.status).toBe('PARTIALLY_PAID');
    });

    it('calculates cashier balance sheet separating physical cash from digital payments', async () => {
      (prisma.userCashBalance.findMany as any).mockResolvedValue([
        // Cash Collection: 500
        {
          id: '1',
          direction: 'IN',
          amount: new Decimal(500),
          category: 'COLLECTION',
          isPhysicalCash: true,
          occurredAt: new Date(),
        },
        // Cash Collection: 3000
        {
          id: '2',
          direction: 'IN',
          amount: new Decimal(3000),
          category: 'COLLECTION',
          isPhysicalCash: true,
          occurredAt: new Date(),
        },
        // Card Collection: 2500 (Non-physical)
        {
          id: '3',
          direction: 'IN',
          amount: new Decimal(2500),
          category: 'COLLECTION',
          isPhysicalCash: false,
          occurredAt: new Date(),
        },
        // Cash Refund: 1000 (Physical Out)
        {
          id: '4',
          direction: 'OUT',
          amount: new Decimal(1000),
          category: 'REFUND',
          isPhysicalCash: true,
          occurredAt: new Date(),
        },
      ]);

      const sheet = await cashService.getCashierBalanceSheet(cashierId);

      // Expected physical cash = 500 + 3000 - 1000 = 2,500 PKR
      expect(sheet.summary.expectedPhysicalCash).toEqual(new Decimal(2500));
      expect(sheet.summary.physicalCashIn).toEqual(new Decimal(3500));
      expect(sheet.summary.physicalCashOut).toEqual(new Decimal(1000));
      // Card tracked separately without inflating physical cash
      expect(sheet.summary.nonPhysicalTotal).toEqual(new Decimal(2500));
      expect(sheet.summary.totalCollections).toEqual(new Decimal(6000));
      expect(sheet.summary.totalRefunds).toEqual(new Decimal(1000));
    });
  });
});
