import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
import { pharmacyService } from '../pharmacy/pharmacy.service';
import { pharmacyBridgeClient } from '@/shared/pharmacyBridgeClient';
import type {
  CreateMedicineRequestBody,
  ListRequestsQuery,
  DispensedCallbackBody,
  SettlementRequestBody,
  ReleaseSettlementBody,
} from './pharmacy-bridge.schemas';

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

      return {
        clearance: updatedClearance,
        dispense,
        admissionPharmacyCleared: false,
      };
    });
  },

  // ── Dispense Callback from Pharmacy Backend (Webhook) ────────────────────
  async handleDispensedCallback(body: DispensedCallbackBody) {
    return prisma.$transaction(async (tx) => {
      // Concurrency lock per admission reference
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${body.externalAdmissionRef}))`;

      const admission = await tx.admissionRecord.findFirst({
        where: {
          OR: [
            { admissionNumber: body.externalAdmissionRef },
            { id: body.externalAdmissionRef },
          ],
        },
      });
      if (!admission) throw new NotFoundError(`Admission ${body.externalAdmissionRef} not found`);

      // Lifecycle Rule (§11): Finalized admission cannot silently append historical invoice
      if (admission.status === 'DISCHARGED' || admission.status === 'CANCELLED') {
        throw new ValidationError(`Cannot append pharmacy charges to a finalized/discharged admission (${admission.status})`);
      }

      // ── Idempotency & Unique Collision Safety ────────────────────────────
      // ONE ACTIVE ADMISSION = ONE PHARMACY CHARGE COMPONENT (§1, §6, §12)
      let existingCharge = await tx.hmsPharmacyCharge.findFirst({
        where: {
          admissionRecordId: admission.id,
        },
      });

      if (!existingCharge) {
        existingCharge = await tx.hmsPharmacyCharge.findFirst({
          where: {
            pharmacyInvoiceNumber: body.pharmacyInvoiceNumber,
            admissionRecordId: admission.id,
          },
        });
      }

      let targetPharmacyInvoiceNumber = body.pharmacyInvoiceNumber;
      if (!existingCharge) {
        const otherAdmissionCharge = await tx.hmsPharmacyCharge.findUnique({
          where: { pharmacyInvoiceNumber: targetPharmacyInvoiceNumber },
        });
        if (otherAdmissionCharge && otherAdmissionCharge.admissionRecordId !== admission.id) {
          targetPharmacyInvoiceNumber = `${body.pharmacyInvoiceNumber}-${admission.admissionNumber || admission.id.slice(-6)}`;
          const secondCheck = await tx.hmsPharmacyCharge.findUnique({
            where: { pharmacyInvoiceNumber: targetPharmacyInvoiceNumber },
          });
          if (secondCheck && secondCheck.admissionRecordId !== admission.id) {
            targetPharmacyInvoiceNumber = `${body.pharmacyInvoiceNumber}-${admission.admissionNumber || admission.id.slice(-6)}-${Date.now().toString().slice(-4)}`;
          }
        }
      }

      let dept = await tx.department.findFirst({
        where: { OR: [{ code: 'PHARM' }, { code: 'PHARMACY' }] },
      });
      if (!dept) {
        dept = await tx.department.create({
          data: {
            code: 'PHARM',
            name: 'Pharmacy Department',
            departmentType: 'CLINICAL',
          },
        });
      }

      let hospitalInvoice = await tx.hospitalInvoice.findFirst({
        where: {
          admissionRecordId: admission.id,
          OR: [
            { invoiceNumber: `INV-PHARM-${targetPharmacyInvoiceNumber}` },
            { invoiceNumber: `INV-PHARM-${body.pharmacyInvoiceNumber}` },
            { departmentId: dept.id },
            { invoiceNumber: { startsWith: 'INV-PHARM-' } },
          ],
        },
        include: { lines: true },
      });

      if (
        existingCharge &&
        body.dispenseEventId &&
        existingCharge.processedEventIds.includes(body.dispenseEventId)
      ) {
        // Already processed this exact dispense event — return idempotent success
        return { charge: existingCharge, hospitalInvoice, alreadyProcessed: true };
      }

      let clearance = null;
      if (body.externalRequestRef) {
        clearance = await tx.pharmacyClearance.findFirst({
          where: {
            OR: [
              { medicineRequestNumber: body.externalRequestRef },
              { id: body.externalRequestRef },
            ],
          },
        });
        if (clearance) {
          await tx.pharmacyClearance.update({
            where: { id: clearance.id },
            data: { status: 'DISPENSED', fulfilledAt: new Date() },
          });
        }
      }

      let serviceRate = await tx.serviceRate.findFirst({
        where: { code: 'SRV-PHARMACY' },
      });
      if (!serviceRate) {
        serviceRate = await tx.serviceRate.create({
          data: {
            code: 'SRV-PHARMACY',
            name: 'Pharmacy Medication Charges',
            departmentId: dept.id,
            category: 'PHARMACY',
            billingUnit: 'Items',
            standardRate: new Decimal(0),
            manualRateOverrideAllowed: true,
          },
        });
      }

      const totalDecimal = new Decimal(body.totalAmount);
      const subtotalDecimal = new Decimal(body.subtotal);
      const taxDecimal = new Decimal(body.taxTotal);
      const discountDecimal = new Decimal(body.discountTotal);

      // Prepare itemized lines from dispensed medicines
      const linesToCreate = (body.lines && body.lines.length > 0)
        ? body.lines.map((l) => ({
            serviceRateId: serviceRate.id,
            rateSnapshot: new Decimal(l.rate),
            quantity: new Decimal(l.quantity),
            lineGross: new Decimal(l.lineNet),
            lineNet: new Decimal(l.lineNet),
            patientShare: new Decimal(l.lineNet),
            discountReason: `${l.medicineName}${l.batchNumber ? ` [Batch: ${l.batchNumber}]` : ''}`,
          }))
        : [
            {
              serviceRateId: serviceRate.id,
              rateSnapshot: totalDecimal,
              quantity: new Decimal(1),
              lineGross: totalDecimal,
              lineNet: totalDecimal,
              patientShare: totalDecimal,
              discountReason: 'Pharmacy Medication Charges',
            },
          ];

      // ── Hospital Invoice (ONE ACTIVE ADMISSION = ONE BILL) ───────────────
      if (!hospitalInvoice) {
        let invoiceNumber = `INV-PHARM-${targetPharmacyInvoiceNumber}`;
        const collision = await tx.hospitalInvoice.findUnique({
          where: { invoiceNumber },
        });
        if (collision) {
          if (collision.admissionRecordId === admission.id) {
            hospitalInvoice = collision;
          } else {
            invoiceNumber = `INV-PHARM-${admission.admissionNumber || admission.id.slice(-6)}-${targetPharmacyInvoiceNumber}`;
            const collision2 = await tx.hospitalInvoice.findUnique({
              where: { invoiceNumber },
            });
            if (collision2) {
              invoiceNumber = `INV-PHARM-${admission.admissionNumber || admission.id.slice(-6)}-${targetPharmacyInvoiceNumber}-${Date.now().toString().slice(-4)}`;
            }
          }
        }

        if (!hospitalInvoice) {
          hospitalInvoice = await tx.hospitalInvoice.create({
            data: {
              invoiceNumber,
              sourceType: 'ADMISSION',
              admissionRecordId: admission.id,
              departmentId: dept.id,
              panelPatientId: admission.panelPatientId,
              subtotal: subtotalDecimal,
              discountTotal: discountDecimal,
              total: totalDecimal,
              patientShare: totalDecimal,
              paidTotal: new Decimal(0),
              status: 'UNPAID',
              lines: {
                create: linesToCreate,
              },
            },
            include: { lines: true },
          });
        }
      }

      if (hospitalInvoice && hospitalInvoice.createdAt) {
        // Update existing Hospital Invoice: PRESERVE paidTotal! (§10)
        const paidTotal = hospitalInvoice.paidTotal;
        const newOutstanding = Decimal.max(0, totalDecimal.minus(paidTotal));
        const newStatus = newOutstanding.equals(0)
          ? 'PAID'
          : paidTotal.greaterThan(0)
          ? 'PARTIALLY_PAID'
          : 'UNPAID';

        await tx.invoiceLineItem.deleteMany({
          where: { hospitalInvoiceId: hospitalInvoice.id },
        });
        await tx.invoiceLineItem.createMany({
          data: linesToCreate.map((l) => ({
            ...l,
            hospitalInvoiceId: hospitalInvoice.id,
          })),
        });

        hospitalInvoice = await tx.hospitalInvoice.update({
          where: { id: hospitalInvoice.id },
          data: {
            subtotal: subtotalDecimal,
            discountTotal: discountDecimal,
            total: totalDecimal,
            patientShare: totalDecimal,
            status: newStatus,
          },
          include: { lines: true },
        });
      }

      // ── HMS Pharmacy Charge Record (§8, §10, §12) ────────────────────────
      const updatedProcessedEventIds = existingCharge
        ? (body.dispenseEventId && !existingCharge.processedEventIds.includes(body.dispenseEventId)
            ? [...existingCharge.processedEventIds, body.dispenseEventId]
            : existingCharge.processedEventIds)
        : (body.dispenseEventId ? [body.dispenseEventId] : []);

      const patientPaid = existingCharge ? existingCharge.patientPaid : new Decimal(0);
      const patientOutstanding = Decimal.max(0, totalDecimal.minus(patientPaid));
      const patientPaymentStatus = patientOutstanding.equals(0)
        ? 'CLEARED'
        : patientPaid.greaterThan(0)
        ? 'PARTIALLY_COLLECTED'
        : 'PENDING';

      const charge = existingCharge
        ? await tx.hmsPharmacyCharge.update({
            where: { id: existingCharge.id },
            data: {
              pharmacyInvoiceNumber: targetPharmacyInvoiceNumber,
              pharmacyInvoiceId: body.pharmacyInvoiceId || existingCharge.pharmacyInvoiceId,
              subtotal: subtotalDecimal,
              taxTotal: taxDecimal,
              discountTotal: discountDecimal,
              totalAmount: totalDecimal,
              patientPaid,
              patientOutstanding,
              patientPaymentStatus,
              itemsJson: (body.lines as any) || existingCharge.itemsJson,
              dispensedBySnapshot: body.dispensedBy,
              dispensedAt: body.dispensedAt ? new Date(body.dispensedAt) : new Date(),
              processedEventIds: updatedProcessedEventIds,
            },
          })
        : await tx.hmsPharmacyCharge.create({
            data: {
              admissionRecordId: admission.id,
              pharmacyInvoiceNumber: targetPharmacyInvoiceNumber,
              pharmacyInvoiceId: body.pharmacyInvoiceId || null,
              subtotal: subtotalDecimal,
              taxTotal: taxDecimal,
              discountTotal: discountDecimal,
              totalAmount: totalDecimal,
              patientPaid: new Decimal(0),
              patientOutstanding: totalDecimal,
              patientPaymentStatus: 'PENDING',
              settlementStatus: 'NOT_DUE',
              itemsJson: (body.lines as any) || [],
              dispensedBySnapshot: body.dispensedBy,
              dispensedAt: body.dispensedAt ? new Date(body.dispensedAt) : new Date(),
              processedEventIds: updatedProcessedEventIds,
            },
          });

      if (clearance) {
        await tx.pharmacyClearance.update({
          where: { id: clearance.id },
          data: { pharmacyChargeId: charge.id },
        });
      }

      // Patient Pharmacy Payment Clearance remains PENDING until paid in full at Front Desk
      if (patientOutstanding.greaterThan(0)) {
        await tx.dualDischargeClearance.upsert({
          where: {
            admissionRecordId_clearanceType: {
              admissionRecordId: admission.id,
              clearanceType: 'PHARMACY',
            },
          },
          update: { status: 'PENDING', clearedById: null, clearedAt: null },
          create: {
            admissionRecordId: admission.id,
            clearanceType: 'PHARMACY',
            status: 'PENDING',
          },
        });
      }

      return { charge, hospitalInvoice };
    }, { maxWait: 15000, timeout: 30000 });
  },

  // ── Inter-Entity Settlement Workflow (Hospital Management ↔ Pharmacy) ───
  async handleSettlementRequest(body: SettlementRequestBody) {
    const charge = await prisma.hmsPharmacyCharge.findUnique({
      where: { pharmacyInvoiceNumber: body.pharmacyInvoiceNumber },
    });
    if (!charge) throw new NotFoundError(`Pharmacy charge for invoice ${body.pharmacyInvoiceNumber} not found`);

    return prisma.$transaction(async (tx) => {
      const settlement = await tx.hmsPharmacySettlement.upsert({
        where: { settlementNumber: body.settlementNumber },
        update: {
          requestedAmount: new Decimal(body.requestedAmount),
          remainingAmount: new Decimal(body.requestedAmount).minus(charge.settledAmount),
          status: 'REQUESTED',
          remarks: body.remarks,
        },
        create: {
          settlementNumber: body.settlementNumber,
          pharmacyChargeId: charge.id,
          pharmacyInvoiceNumber: body.pharmacyInvoiceNumber,
          requestedAmount: new Decimal(body.requestedAmount),
          remainingAmount: new Decimal(body.requestedAmount),
          status: 'REQUESTED',
          requestedByExternal: body.requestedBy,
          remarks: body.remarks,
        },
      });

      await tx.hmsPharmacyCharge.update({
        where: { id: charge.id },
        data: { settlementStatus: 'REQUESTED' },
      });

      return settlement;
    });
  },

  async listSettlements() {
    return prisma.hmsPharmacySettlement.findMany({
      include: {
        pharmacyCharge: {
          include: {
            admissionRecord: {
              include: {
                panelPatient: { select: { fullName: true, mrNumber: true } },
                selfPayEncounter: { select: { fullName: true } },
              },
            },
          },
        },
        releasedByUser: { select: { displayName: true, username: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  },

  async releaseSettlement(settlementId: string, body: ReleaseSettlementBody, actorId: string) {
    const settlement = await prisma.hmsPharmacySettlement.findUnique({
      where: { id: settlementId },
      include: { pharmacyCharge: true },
    });
    if (!settlement) throw new NotFoundError('Settlement not found');
    if (settlement.status === 'SETTLED') throw new ValidationError('Settlement is already settled');

    const releaseAmt = new Decimal(body.releasedAmount);
    if (releaseAmt.greaterThan(settlement.remainingAmount)) {
      throw new ValidationError(`Release amount (${releaseAmt}) cannot exceed remaining amount (${settlement.remainingAmount})`);
    }

    const actor = await prisma.portalUser.findUnique({ where: { id: actorId } });
    const newReleasedTotal = settlement.releasedAmount.plus(releaseAmt);
    const newRemaining = settlement.requestedAmount.minus(newReleasedTotal);
    const newStatus = newRemaining.equals(0) ? 'SETTLED' : 'PARTIALLY_RELEASED';

    const result = await prisma.$transaction(async (tx) => {
      const updatedSettlement = await tx.hmsPharmacySettlement.update({
        where: { id: settlement.id },
        data: {
          releasedAmount: newReleasedTotal,
          remainingAmount: newRemaining,
          status: newStatus,
          paymentMethod: body.paymentMethod,
          paymentReference: body.paymentReference,
          remarks: body.remarks,
          releasedById: actorId,
          releasedAt: new Date(),
        },
      });

      await tx.hmsPharmacyCharge.update({
        where: { id: settlement.pharmacyChargeId },
        data: {
          settledAmount: settlement.pharmacyCharge.settledAmount.plus(releaseAmt),
          settlementStatus: newStatus,
        },
      });

      return updatedSettlement;
    });

    // Notify Pharmacy Backend via Bridge
    await pharmacyBridgeClient.releaseSettlement({
      settlementNumber: settlement.settlementNumber,
      pharmacyInvoiceNumber: settlement.pharmacyInvoiceNumber,
      releasedAmount: Number(releaseAmt),
      remainingPayable: Number(newRemaining),
      paymentMethod: body.paymentMethod,
      paymentReference: body.paymentReference,
      releasedBy: actor?.displayName || actor?.username || 'Admin',
      releasedAt: new Date().toISOString(),
      remarks: body.remarks,
    });

    return result;
  },

  async listCharges(admissionRecordId?: string) {
    return prisma.hmsPharmacyCharge.findMany({
      where: admissionRecordId ? { admissionRecordId } : undefined,
      include: {
        settlements: true,
        admissionRecord: {
          include: {
            panelPatient: { select: { fullName: true } },
            selfPayEncounter: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },
};
