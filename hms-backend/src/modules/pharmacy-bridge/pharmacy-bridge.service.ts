import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
import { pharmacyService } from '../pharmacy/pharmacy.service';
import type { CreateMedicineRequestBody, ListRequestsQuery } from './pharmacy-bridge.schemas';

export const pharmacyBridgeService = {
  // ── Create Inpatient Medicine Request ─────────────────────────────────────
  async createRequest(body: CreateMedicineRequestBody, actorId: string) {
    // Idempotency check: if key already exists, return existing request (§6.10, D16 p.14)
    const existing = await prisma.pharmacyClearance.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      include: {
        lines: { include: { medicine: true, batch: true } },
        admissionRecord: true,
      },
    });
    if (existing) {
      return existing;
    }

    const admission = await prisma.admissionRecord.findUnique({
      where: { id: body.admissionRecordId },
    });
    if (!admission) {
      throw new NotFoundError('Admission record not found');
    }
    if (admission.status === 'DISCHARGED' || admission.status === 'CANCELLED') {
      throw new ValidationError(`Cannot request medicines for admission in status ${admission.status}`);
    }

    // Verify all requested medicines exist and are active
    for (const line of body.lines) {
      const med = await prisma.medicineMaster.findUnique({ where: { id: line.medicineId } });
      if (!med || !med.isActive) {
        throw new NotFoundError(`Medicine ${line.medicineId} not found or inactive`);
      }
    }

    const medicineRequestNumber = `MED-REQ-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    return prisma.$transaction(async (tx) => {
      const clearance = await tx.pharmacyClearance.create({
        data: {
          medicineRequestNumber,
          admissionRecordId: admission.id,
          status: 'REQUESTED',
          idempotencyKey: body.idempotencyKey,
          requestedById: actorId,
          lines: {
            create: body.lines.map((l) => ({
              medicineId: l.medicineId,
              requestedQuantity: new Decimal(l.requestedQuantity),
              notes: l.notes,
            })),
          },
        },
        include: {
          lines: { include: { medicine: true } },
          admissionRecord: true,
        },
      });

      // Ensure pharmacy discharge clearance status is PENDING while active requests are open
      await tx.dualDischargeClearance.upsert({
        where: {
          admissionRecordId_clearanceType: {
            admissionRecordId: admission.id,
            clearanceType: 'PHARMACY',
          },
        },
        update: {
          status: 'PENDING',
          clearedById: null,
          clearedAt: null,
        },
        create: {
          admissionRecordId: admission.id,
          clearanceType: 'PHARMACY',
          status: 'PENDING',
        },
      });

      return clearance;
    });
  },

  // ── List & Get Medicine Requests ──────────────────────────────────────────
  async listRequests(query: ListRequestsQuery) {
    return prisma.pharmacyClearance.findMany({
      where: {
        status: query.status,
        admissionRecordId: query.admissionRecordId,
      },
      include: {
        admissionRecord: {
          include: {
            panelPatient: true,
            selfPayEncounter: true,
            bed: { include: { room: true } },
          },
        },
        lines: { include: { medicine: true, batch: true } },
        requestedBy: { select: { id: true, username: true } },
        fulfilledBy: { select: { id: true, username: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  },

  async getRequestById(id: string) {
    const req = await prisma.pharmacyClearance.findUnique({
      where: { id },
      include: {
        admissionRecord: {
          include: {
            panelPatient: true,
            selfPayEncounter: true,
            bed: { include: { room: true } },
            doctor: { select: { id: true, fullName: true } },
          },
        },
        lines: { include: { medicine: true, batch: true } },
        pharmacyDispenses: { include: { lines: true } },
        requestedBy: { select: { id: true, username: true } },
        fulfilledBy: { select: { id: true, username: true } },
      },
    });
    if (!req) throw new NotFoundError('Pharmacy clearance request not found');
    return req;
  },

  // ── Fulfill Request via FEFO & Trigger Admission Clearance Callback ───────
  /**
   * 1. Dispenses medicines via FEFO engine.
   * 2. Posts -OUT movement to MedicineStockLedger.
   * 3. Creates PharmacyDispense (channel: HMS_LINKED).
   * 4. Updates PharmacyClearance status to DISPENSED.
   * 5. Automatically updates DualDischargeClearance (PHARMACY) to CLEARED.
   */
  async fulfillAndDispense(id: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const clearance = await tx.pharmacyClearance.findUnique({
        where: { id },
        include: {
          lines: { include: { medicine: true } },
          admissionRecord: true,
          pharmacyDispenses: true,
        },
      });

      if (!clearance) {
        throw new NotFoundError('Pharmacy clearance request not found');
      }

      // Idempotent: if already fulfilled, return existing dispenses
      if (clearance.status === 'DISPENSED' || clearance.status === 'CLEARANCE_SENT') {
        return {
          clearance,
          dispenses: clearance.pharmacyDispenses,
          alreadyFulfilled: true,
        };
      }

      let subtotal = new Decimal(0);
      const dispenseLinesToCreate: {
        medicineId: string;
        batchId: string | null;
        quantity: Decimal;
        rateSnapshot: Decimal;
        discountAmount: Decimal;
        lineNet: Decimal;
      }[] = [];

      const stockDeductions: {
        medicineId: string;
        batchId: string | null;
        quantity: Decimal;
      }[] = [];

      for (const line of clearance.lines) {
        const medicine = line.medicine;
        const requestedQty = line.requestedQuantity;
        const saleRate = medicine.saleRate ?? new Decimal(0);

        // Run FEFO batch allocation within the transaction
        const allocations = await pharmacyService.allocateFefoBatches(
          medicine.id,
          requestedQty,
          tx,
        );

        // Update the clearance line with the primary batch and quantities
        await tx.pharmacyClearanceLine.update({
          where: { id: line.id },
          data: {
            approvedQuantity: requestedQty,
            dispensedQuantity: requestedQty,
            batchId: allocations[0]?.batchId ?? null,
          },
        });

        for (const alloc of allocations) {
          const allocGross = alloc.quantity.mul(saleRate);
          subtotal = subtotal.plus(allocGross);

          dispenseLinesToCreate.push({
            medicineId: medicine.id,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
            rateSnapshot: saleRate,
            discountAmount: new Decimal(0),
            lineNet: allocGross,
          });

          stockDeductions.push({
            medicineId: medicine.id,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
          });
        }
      }

      const invoiceNumber = `HMS-MED-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Create PharmacyDispense
      const dispense = await tx.pharmacyDispense.create({
        data: {
          invoiceNumber,
          channel: 'HMS_LINKED',
          pharmacyClearanceId: clearance.id,
          panelPatientId: clearance.admissionRecord.panelPatientId,
          selfPayEncounterId: clearance.admissionRecord.selfPayEncounterId,
          subtotal,
          discountTotal: new Decimal(0),
          total: subtotal,
          paidTotal: subtotal,
          status: 'PAID',
          dispensedById: actorId,
          lines: {
            create: dispenseLinesToCreate,
          },
        },
        include: {
          lines: {
            include: { medicine: true, batch: true },
          },
        },
      });

      // Post stock deductions to MedicineStockLedger (-OUT)
      for (const deduction of stockDeductions) {
        await tx.medicineStockLedger.create({
          data: {
            medicineId: deduction.medicineId,
            batchId: deduction.batchId,
            movementType: 'DISPENSE',
            quantityDelta: deduction.quantity.negated(), // -OUT
            referenceTable: 'pharmacy_clearances',
            referenceId: clearance.id,
            actorId,
          },
        });
      }

      // Mark PharmacyClearance as DISPENSED
      const updatedClearance = await tx.pharmacyClearance.update({
        where: { id: clearance.id },
        data: {
          status: 'DISPENSED',
          fulfilledById: actorId,
          fulfilledAt: new Date(),
        },
        include: {
          lines: { include: { medicine: true, batch: true } },
          admissionRecord: true,
        },
      });

      // Check if there are any remaining pending requests for this admission
      const pendingCount = await tx.pharmacyClearance.count({
        where: {
          admissionRecordId: clearance.admissionRecordId,
          status: { in: ['REQUESTED', 'ACCEPTED', 'PARTIALLY_FULFILLED', 'DISPENSING'] },
        },
      });

      // If all medicine requests for this admission are fulfilled, auto-clear the DualDischargeClearance (§4.12)
      if (pendingCount === 0) {
        await tx.dualDischargeClearance.upsert({
          where: {
            admissionRecordId_clearanceType: {
              admissionRecordId: clearance.admissionRecordId,
              clearanceType: 'PHARMACY',
            },
          },
          update: {
            status: 'CLEARED',
            clearedById: actorId,
            clearedAt: new Date(),
          },
          create: {
            admissionRecordId: clearance.admissionRecordId,
            clearanceType: 'PHARMACY',
            status: 'CLEARED',
            clearedById: actorId,
            clearedAt: new Date(),
          },
        });
      }

      return {
        clearance: updatedClearance,
        dispense,
        admissionPharmacyCleared: pendingCount === 0,
      };
    });
  },
};
