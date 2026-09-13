import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

// Mock prisma client
vi.mock('@/db/client', () => {
  const mockTx: any = {};
  const mockPrisma: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockTx)),
    supplier: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    supplierLedger: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    stockItem: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    stockLedger: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    purchaseOrder: {
      create: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
    departmentRequisition: {
      create: vi.fn(),
    },
    userCashBalance: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    medicineMaster: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    medicineBatch: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    medicineStockLedger: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    pharmacyDispense: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    pharmacyDispenseLine: {
      create: vi.fn(),
    },
    pharmacyClearance: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    pharmacyClearanceLine: {
      update: vi.fn(),
    },
    admissionRecord: {
      findUnique: vi.fn(),
    },
    dualDischargeClearance: {
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
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
import { inventoryService } from '@/modules/inventory/inventory.service';
import { pharmacyService } from '@/modules/pharmacy/pharmacy.service';
import { pharmacyBridgeService } from '@/modules/pharmacy-bridge/pharmacy-bridge.service';

describe('Phase 6: General Inventory, FEFO Pharmacy & HMS Bridge', () => {
  const actorId = 'actor-user-uuid-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. General Hospital Inventory ──────────────────────────────────────────
  describe('Hospital Consumable Inventory (Non-Medicine)', () => {
    it('calculates supplier outstanding balance dynamically from ledger entries', async () => {
      vi.mocked(prisma.supplier.findMany).mockResolvedValue([
        {
          id: 'sup-1',
          name: 'MedSupply Co',
          contact: 'Ahmed',
          phone: '03001234567',
          address: 'Karachi',
          terms: 'Net 30',
          isActive: true,
          supplierLedger: [
            { entryType: 'PURCHASE_CREDIT', amount: new Decimal(50000) },
            { entryType: 'PAYMENT', amount: new Decimal(20000) },
          ],
        } as any,
      ]);

      const suppliers = await inventoryService.listSuppliers();
      expect(suppliers).toHaveLength(1);
      expect(suppliers[0]?.outstandingBalance.toNumber()).toBe(30000);
    });

    it('calculates current stock balance from StockLedger quantity delta', async () => {
      vi.mocked(prisma.stockItem.findMany).mockResolvedValue([
        {
          id: 'item-1',
          code: 'GLV-01',
          name: 'Surgical Gloves (Box)',
          category: 'Consumables',
          unit: 'BOX',
          reorderLevel: new Decimal(10),
          isActive: true,
          stockLedgerEntries: [
            { quantityDelta: new Decimal(50) },
            { quantityDelta: new Decimal(-15) },
          ],
        } as any,
      ]);

      const items = await inventoryService.listStockItems();
      expect(items[0]?.currentStock.toNumber()).toBe(35);
      expect(items[0]?.isLowStock).toBe(false);
    });

    it('blocks petty cash purchase when user cash balance is insufficient', async () => {
      vi.mocked(prisma.supplier.findUnique).mockResolvedValue({
        id: 'sup-1',
        name: 'Local Store',
        isActive: true,
      } as any);

      vi.mocked(prisma.stockItem.findUnique).mockResolvedValue({
        id: 'item-1',
        name: 'Syringes 5ml',
        isActive: true,
      } as any);

      // User has only PKR 500 petty cash
      vi.mocked(prisma.userCashBalance.findMany).mockResolvedValue([
        { direction: 'IN', amount: new Decimal(500) } as any,
      ]);

      await expect(
        inventoryService.createPurchase(
          {
            supplierId: 'sup-1',
            paymentMethod: 'PETTY_CASH',
            lines: [{ stockItemId: 'item-1', quantity: 100, rate: 20 }], // PKR 2,000 required
          },
          actorId,
        ),
      ).rejects.toThrow(/Insufficient petty cash balance/);
    });

    it('executes purchase with petty cash: deducts user cash balance and increments StockLedger', async () => {
      vi.mocked(prisma.supplier.findUnique).mockResolvedValue({
        id: 'sup-1',
        name: 'Local Store',
        isActive: true,
      } as any);

      vi.mocked(prisma.stockItem.findUnique).mockResolvedValue({
        id: 'item-1',
        name: 'Syringes 5ml',
        isActive: true,
      } as any);

      // User has PKR 5,000 in petty cash
      vi.mocked(prisma.userCashBalance.findMany).mockResolvedValue([
        { direction: 'IN', amount: new Decimal(5000) } as any,
      ]);

      vi.mocked(prisma.purchaseOrder.create).mockResolvedValue({
        id: 'po-1',
        supplierId: 'sup-1',
        totalAmount: new Decimal(1000),
        lines: [{ stockItemId: 'item-1', quantity: new Decimal(50) }],
      } as any);

      const po = await inventoryService.createPurchase(
        {
          supplierId: 'sup-1',
          paymentMethod: 'PETTY_CASH',
          lines: [{ stockItemId: 'item-1', quantity: 50, rate: 20 }], // PKR 1,000
        },
        actorId,
      );

      expect(po.id).toBe('po-1');
      // Verify petty cash deducted
      expect(prisma.userCashBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: 'OUT',
            category: 'PURCHASE',
            amount: new Decimal(1000),
          }),
        }),
      );
      // Verify +IN movement posted to StockLedger
      expect(prisma.stockLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stockItemId: 'item-1',
            movementType: 'PURCHASE_RECEIPT',
            quantityDelta: new Decimal(50),
          }),
        }),
      );
    });

    it('blocks department stock issue if requested quantity exceeds available stock', async () => {
      vi.mocked(prisma.department.findUnique).mockResolvedValue({
        id: 'dept-er',
        name: 'Emergency',
      } as any);

      vi.mocked(prisma.stockItem.findUnique).mockResolvedValue({
        id: 'item-1',
        name: 'Surgical Gloves',
        unit: 'BOX',
        isActive: true,
        stockLedgerEntries: [{ quantityDelta: new Decimal(5) }], // only 5 available
      } as any);

      await expect(
        inventoryService.issueToDepartment(
          {
            departmentId: 'dept-er',
            lines: [{ stockItemId: 'item-1', quantity: 10 }], // requesting 10
          },
          actorId,
        ),
      ).rejects.toThrow(/Cannot drive stock negative/);
    });

    it('successfully issues stock to department and records -OUT in StockLedger', async () => {
      vi.mocked(prisma.department.findUnique).mockResolvedValue({
        id: 'dept-er',
        name: 'Emergency',
      } as any);

      vi.mocked(prisma.stockItem.findUnique).mockResolvedValue({
        id: 'item-1',
        name: 'Surgical Gloves',
        unit: 'BOX',
        isActive: true,
        stockLedgerEntries: [{ quantityDelta: new Decimal(20) }],
      } as any);

      vi.mocked(prisma.departmentRequisition.create).mockResolvedValue({
        id: 'req-1',
        departmentId: 'dept-er',
        lines: [{ stockItemId: 'item-1', quantity: new Decimal(5) }],
      } as any);

      const res = await inventoryService.issueToDepartment(
        {
          departmentId: 'dept-er',
          lines: [{ stockItemId: 'item-1', quantity: 5 }],
        },
        actorId,
      );

      expect(res.id).toBe('req-1');
      expect(prisma.stockLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stockItemId: 'item-1',
            movementType: 'DEPARTMENT_ISSUE',
            quantityDelta: new Decimal(-5), // -OUT
          }),
        }),
      );
    });
  });

  // ── 2. Standalone Pharmacy FEFO Engine ─────────────────────────────────────
  describe('Standalone Pharmacy & FEFO Engine', () => {
    it('allocates batches in strict First-Expiry, First-Out (FEFO) order', async () => {
      const now = new Date();
      const earlierExpiry = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days
      const laterExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      vi.mocked(prisma.medicineMaster.findUnique).mockResolvedValue({
        id: 'med-1',
        name: 'Augmentin 625mg',
        unit: 'TAB',
        batchManaged: true,
        isActive: true,
        batches: [
          {
            id: 'batch-earlier',
            batchNumber: 'B-001',
            expiryDate: earlierExpiry,
            costRate: new Decimal(30),
            stockLedgerEntries: [{ quantityDelta: new Decimal(10) }],
          },
          {
            id: 'batch-later',
            batchNumber: 'B-002',
            expiryDate: laterExpiry,
            costRate: new Decimal(32),
            stockLedgerEntries: [{ quantityDelta: new Decimal(50) }],
          },
        ],
      } as any);

      const allocations = await pharmacyService.allocateFefoBatches(
        'med-1',
        new Decimal(15),
        prisma as any,
      );

      // Must take all 10 from earlier batch, and 5 from later batch
      expect(allocations).toHaveLength(2);
      expect(allocations[0]?.batchId).toBe('batch-earlier');
      expect(allocations[0]?.quantity.toNumber()).toBe(10);
      expect(allocations[1]?.batchId).toBe('batch-later');
      expect(allocations[1]?.quantity.toNumber()).toBe(5);
    });

    it('skips expired batches during FEFO allocation', async () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // Expired 5 days ago
      const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // Valid for 60 days

      vi.mocked(prisma.medicineMaster.findUnique).mockResolvedValue({
        id: 'med-1',
        name: 'Paracetamol 500mg',
        unit: 'TAB',
        batchManaged: true,
        isActive: true,
        batches: [
          {
            id: 'batch-expired',
            batchNumber: 'EXP-1',
            expiryDate: pastDate,
            costRate: new Decimal(2),
            stockLedgerEntries: [{ quantityDelta: new Decimal(100) }],
          },
          {
            id: 'batch-valid',
            batchNumber: 'VAL-1',
            expiryDate: futureDate,
            costRate: new Decimal(2.5),
            stockLedgerEntries: [{ quantityDelta: new Decimal(20) }],
          },
        ],
      } as any);

      const allocations = await pharmacyService.allocateFefoBatches(
        'med-1',
        new Decimal(10),
        prisma as any,
      );

      // Must NOT allocate from expired batch
      expect(allocations).toHaveLength(1);
      expect(allocations[0]?.batchId).toBe('batch-valid');
      expect(allocations[0]?.quantity.toNumber()).toBe(10);
    });

    it('throws validation error if non-expired available stock is insufficient', async () => {
      const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      vi.mocked(prisma.medicineMaster.findUnique).mockResolvedValue({
        id: 'med-1',
        name: 'Amoxicillin 250mg',
        unit: 'CAP',
        batchManaged: true,
        isActive: true,
        batches: [
          {
            id: 'batch-1',
            batchNumber: 'B-01',
            expiryDate: futureDate,
            costRate: new Decimal(10),
            stockLedgerEntries: [{ quantityDelta: new Decimal(5) }], // only 5 available
          },
        ],
      } as any);

      await expect(
        pharmacyService.allocateFefoBatches('med-1', new Decimal(20), prisma as any),
      ).rejects.toThrow(/Insufficient non-expired stock/);
    });

    it('dispenses retail medicines: deducts stock ledger and records cash balance collection', async () => {
      const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      vi.mocked(prisma.medicineMaster.findUnique).mockResolvedValue({
        id: 'med-1',
        name: 'Panadol 500mg',
        unit: 'TAB',
        saleRate: new Decimal(5),
        batchManaged: true,
        isActive: true,
        batches: [
          {
            id: 'batch-1',
            batchNumber: 'PAN-01',
            expiryDate: futureDate,
            costRate: new Decimal(3),
            stockLedgerEntries: [{ quantityDelta: new Decimal(100) }],
          },
        ],
      } as any);

      vi.mocked(prisma.pharmacyDispense.create).mockResolvedValue({
        id: 'disp-1',
        invoiceNumber: 'PHARM-2026-001',
        total: new Decimal(50),
        lines: [{ medicineId: 'med-1', quantity: new Decimal(10), lineNet: new Decimal(50) }],
      } as any);

      const dispense = await pharmacyService.dispenseRetail(
        {
          lines: [{ medicineId: 'med-1', quantity: 10 }],
        },
        actorId,
      );

      expect(dispense.id).toBe('disp-1');
      // Verified -OUT stock movement
      expect(prisma.medicineStockLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            medicineId: 'med-1',
            movementType: 'SALE',
            quantityDelta: new Decimal(-10),
          }),
        }),
      );
      // Verified cash recorded to UserCashBalance
      expect(prisma.userCashBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            moduleScope: 'PHARMACY',
            direction: 'IN',
            amount: new Decimal(50),
            category: 'COLLECTION',
          }),
        }),
      );
    });
  });

  // ── 3. HMS Pharmacy Bridge & Automated Discharge Clearance ───────────────
  describe('HMS Pharmacy Bridge & Dual Discharge Clearance Callback', () => {
    it('creates inpatient medicine request with idempotency protection and sets clearance PENDING', async () => {
      vi.mocked(prisma.pharmacyClearance.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.admissionRecord.findUnique).mockResolvedValue({
        id: 'adm-1',
        status: 'ADMITTED',
      } as any);
      vi.mocked(prisma.medicineMaster.findUnique).mockResolvedValue({
        id: 'med-1',
        name: 'Ceftriaxone 1g IV',
        isActive: true,
      } as any);

      vi.mocked(prisma.pharmacyClearance.create).mockResolvedValue({
        id: 'pc-1',
        medicineRequestNumber: 'MED-REQ-101',
        status: 'REQUESTED',
        idempotencyKey: 'idem-key-abc',
      } as any);

      const req = await pharmacyBridgeService.createRequest(
        {
          admissionRecordId: 'adm-1',
          idempotencyKey: 'idem-key-abc',
          lines: [{ medicineId: 'med-1', requestedQuantity: 2 }],
        },
        actorId,
      );

      expect(req.id).toBe('pc-1');
      // Dual clearance set to PENDING
      expect(prisma.dualDischargeClearance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            admissionRecordId_clearanceType: {
              admissionRecordId: 'adm-1',
              clearanceType: 'PHARMACY',
            },
          },
          update: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('returns existing request on idempotent retry without duplicating', async () => {
      const existing = {
        id: 'pc-existing',
        medicineRequestNumber: 'MED-REQ-101',
        idempotencyKey: 'idem-key-abc',
      };
      vi.mocked(prisma.pharmacyClearance.findUnique).mockResolvedValue(existing as any);

      const req = await pharmacyBridgeService.createRequest(
        {
          admissionRecordId: 'adm-1',
          idempotencyKey: 'idem-key-abc',
          lines: [{ medicineId: 'med-1', requestedQuantity: 2 }],
        },
        actorId,
      );

      expect(req.id).toBe('pc-existing');
      expect(prisma.pharmacyClearance.create).not.toHaveBeenCalled();
    });

    it('fulfills inpatient request via FEFO, marks status DISPENSED, and auto-clears DualDischargeClearance', async () => {
      const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      const medData = {
        id: 'med-1',
        name: 'Ceftriaxone 1g IV',
        saleRate: new Decimal(450),
        unit: 'VIAL',
        batchManaged: true,
        isActive: true,
        batches: [
          {
            id: 'batch-cef',
            batchNumber: 'CEF-001',
            expiryDate: futureDate,
            costRate: new Decimal(300),
            stockLedgerEntries: [{ quantityDelta: new Decimal(20) }],
          },
        ],
      };

      vi.mocked(prisma.medicineMaster.findUnique).mockResolvedValue(medData as any);

      vi.mocked(prisma.pharmacyClearance.findUnique).mockResolvedValue({
        id: 'pc-1',
        admissionRecordId: 'adm-1',
        status: 'REQUESTED',
        admissionRecord: {
          id: 'adm-1',
          panelPatientId: null,
          selfPayEncounterId: 'enc-1',
        },
        lines: [
          {
            id: 'line-1',
            medicineId: 'med-1',
            requestedQuantity: new Decimal(2),
            medicine: medData,
          },
        ],
      } as any);

      vi.mocked(prisma.pharmacyDispense.create).mockResolvedValue({
        id: 'disp-ipd-1',
        invoiceNumber: 'HMS-MED-12345',
        subtotal: new Decimal(900),
      } as any);

      vi.mocked(prisma.pharmacyClearance.update).mockResolvedValue({
        id: 'pc-1',
        status: 'DISPENSED',
      } as any);

      // No other pending requests remaining
      vi.mocked(prisma.pharmacyClearance.count).mockResolvedValue(0);

      const result = await pharmacyBridgeService.fulfillAndDispense('pc-1', actorId);

      expect(result.clearance.status).toBe('DISPENSED');
      expect(result.admissionPharmacyCleared).toBe(true);

      // Verify stock was deducted via FEFO
      expect(prisma.medicineStockLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            medicineId: 'med-1',
            movementType: 'DISPENSE',
            quantityDelta: new Decimal(-2),
          }),
        }),
      );

      // Verify automated DualDischargeClearance callback to CLEARED
      expect(prisma.dualDischargeClearance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            admissionRecordId_clearanceType: {
              admissionRecordId: 'adm-1',
              clearanceType: 'PHARMACY',
            },
          },
          update: expect.objectContaining({
            status: 'CLEARED',
            clearedById: actorId,
          }),
        }),
      );
    });
  });
});
