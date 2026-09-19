import bcrypt from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { AuthenticationError, NotFoundError, ValidationError } from '@/shared/errors/AppError';
import { resolvePanelCoverage } from '@/shared/panelCoverage';
import type {
  CreatePlannedAdmissionBody,
  UpdatePlannedAdmissionBody,
  CheckInAdmissionBody,
  RequestPaymentBody,
  TransferBedBody,
  AddAdmissionServiceBody,
  ChangeMedicationModeBody,
  CreatePharmacyRequestBody,
  GrantClearanceBody,
  ListAdmissionsQuery,
  ClinicalDischargeBody,
  AuthorizeHighCostMedicineBody,
  RejectHighCostMedicineBody,
} from './admission.schemas';

import {
  generateAdmissionNumber,
  generateInvoiceNumber,
  generateMedicineRequestNumber,
  generateReceiptNumber,
} from '@/shared/idGenerator';

export const admissionService = {
  /**
   * Create Planned Inpatient Admission (§4.7 Sub-flow A, D16 p.10)
   * Note: Tentative bed preference is recorded, but bed becomes OCCUPIED
   * only upon check-in / arrival, never during planned booking.
   */
  async createPlannedAdmission(body: CreatePlannedAdmissionBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      let selfPayEncounterId = body.selfPayEncounterId;

      if (!body.panelPatientId && !selfPayEncounterId && body.newSelfPayPatient) {
        const createdSelfPay = await tx.selfPayEncounter.create({
          data: {
            fullName: body.newSelfPayPatient.fullName,
            guardianName: body.newSelfPayPatient.guardianName,
            gender: body.newSelfPayPatient.gender,
            dob: body.newSelfPayPatient.dob,
            cnicOrPassport: body.newSelfPayPatient.cnicOrPassport,
            phone: body.newSelfPayPatient.phone,
            address: body.newSelfPayPatient.address,
            createdById: actorId,
          },
        });
        selfPayEncounterId = createdSelfPay.id;
      }

      if (body.panelPatientId) {
        const panelPatient = await tx.panelPatient.findUnique({
          where: { id: body.panelPatientId },
          include: { corporatePanel: true },
        });
        if (!panelPatient || !panelPatient.isActive) {
          throw new NotFoundError('Panel patient not found or inactive');
        }
        if (panelPatient.corporatePanel && !panelPatient.corporatePanel.isActive) {
          throw new ValidationError('Corporate panel is inactive');
        }
      }

      let departmentId = body.departmentId;

      if (body.preferredBedId) {
        const bed = await tx.bed.findUnique({
          where: { id: body.preferredBedId },
          include: { room: { include: { ward: true } } },
        });
        if (!bed) throw new NotFoundError('Selected bed not found');
        if (bed.status !== 'AVAILABLE') {
          throw new ValidationError(`Selected bed is currently ${bed.status}. Only AVAILABLE beds can be assigned.`);
        }
        if (bed.operationalStatus !== 'ACTIVE') {
          throw new ValidationError(`Selected bed is ${bed.operationalStatus} and cannot be assigned.`);
        }
        // Auto-align department with the bed's ward
        departmentId = bed.room.ward.departmentId;

        // Mark bed as OCCUPIED so it cannot be double-assigned to another patient
        await tx.bed.update({
          where: { id: bed.id },
          data: { status: 'OCCUPIED' },
        });
      }

      if (!departmentId) {
        const defaultDept = await tx.department.findFirst({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        });
        if (!defaultDept) {
          throw new ValidationError('No active department found for admission.');
        }
        departmentId = defaultDept.id;
      }

      const admissionNumber = await generateAdmissionNumber(tx);

      const admission = await tx.admissionRecord.create({
        data: {
          admissionNumber,
          panelPatientId: body.panelPatientId,
          selfPayEncounterId,
          departmentId,
          doctorStaffId: body.doctorStaffId ?? null,
          bedId: body.preferredBedId ?? null,
          status: 'PLANNED',
          medicationMode: body.medicationMode,
          diagnosis: body.diagnosis,
          expectedAt: body.expectedAt,
          estimatedAmount: body.estimatedAmount ? new Decimal(body.estimatedAmount) : null,
          notes: body.notes,
          createdById: actorId,
        },
        include: {
          panelPatient: true,
          selfPayEncounter: true,
          department: true,
          doctor: true,
          bed: { include: { room: { include: { ward: true } } } },
        },
      });

      // Optional advance collected at admission-creation time (04/23 PDFs
      // step 6 "Receive optional advance" + step 7 "Print admission/advance
      // receipt") — no department invoice exists yet (§2.2 invoices are
      // created on check-in / first service posted), so this is recorded as
      // a real receipt linked directly to the admission, same pattern as
      // `appointments.service.ts`'s pre-Check-In advance.
      let advanceReceipt = null;
      if (body.advanceAmount && body.advanceAmount > 0) {
        const advDecimal = new Decimal(body.advanceAmount);
        const receiptNumber = await generateReceiptNumber(tx);

        advanceReceipt = await tx.paymentReceipt.create({
          data: {
            receiptNumber,
            amount: advDecimal,
            method: body.paymentMethod ?? 'CASH',
            reference: body.paymentReference ?? `Advance for admission ${admission.admissionNumber}`,
            admissionRecordId: admission.id,
            collectedById: actorId,
          },
        });

        // Universal Cashier balance ledger update (§4.9, §8.12) — same
        // pattern as every other Front Desk collection.
        await tx.userCashBalance.create({
          data: {
            portalUserId: actorId,
            moduleScope: 'BILLING',
            direction: 'IN',
            amount: advDecimal,
            category: 'COLLECTION',
            isPhysicalCash: (body.paymentMethod ?? 'CASH') === 'CASH',
            paymentReceiptId: advanceReceipt.id,
          },
        });
      }

      return { admission, advanceReceipt };
    });
  },

  async listAdmissions(query: ListAdmissionsQuery) {
    const where: Prisma.AdmissionRecordWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.doctorStaffId) where.doctorStaffId = query.doctorStaffId;

    if (query.search) {
      where.OR = [
        { admissionNumber: { contains: query.search, mode: 'insensitive' } },
        { panelPatient: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { panelPatient: { mrNumber: { contains: query.search, mode: 'insensitive' } } },
        { selfPayEncounter: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    return prisma.admissionRecord.findMany({
      where,
      include: {
        panelPatient: { select: { id: true, fullName: true, mrNumber: true } },
        selfPayEncounter: { select: { id: true, fullName: true, phone: true } },
        department: { select: { id: true, name: true } },
        doctor: { select: { id: true, fullName: true, designation: true } },
        bed: {
          select: {
            id: true,
            bedNumber: true,
            status: true,
            room: { select: { name: true, ward: { select: { name: true } } } },
          },
        },
        dischargeClearances: true,
        paymentRequests: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  },

  async getAdmission(id: string) {
    const admission = await prisma.admissionRecord.findUnique({
      where: { id },
      include: {
        panelPatient: { include: { corporatePanel: true } },
        selfPayEncounter: true,
        department: true,
        doctor: true,
        bed: { include: { room: { include: { ward: true } } } },
        bedTransfers: {
          include: {
            fromBed: { include: { room: { include: { ward: true } } } },
            toBed: { include: { room: { include: { ward: true } } } },
            transferredBy: { select: { id: true, username: true } },
          },
          orderBy: { transferredAt: 'desc' },
        },
        medicationModeHistory: {
          include: { changedBy: { select: { id: true, username: true } } },
          orderBy: { changedAt: 'desc' },
        },
        paymentRequests: {
          include: { requestedBy: { select: { id: true, username: true } } },
          orderBy: { requestedAt: 'desc' },
        },
        pharmacyClearances: {
          include: {
            lines: { include: { medicine: true } },
            requestedBy: { select: { id: true, username: true } },
            highCostAuthorization: true,
          },
        },
        dischargeClearances: {
          include: { clearedBy: { select: { id: true, username: true } } },
        },
        dischargeSummary: true,
        hospitalInvoices: {
          include: {
            lines: { include: { serviceRate: true, performedBy: true } },
            paymentReceipts: true,
          },
        },
      },
    });

    if (!admission) throw new NotFoundError('Admission record not found');
    return admission;
  },

  async updatePlannedAdmission(id: string, body: UpdatePlannedAdmissionBody) {
    const existing = await prisma.admissionRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Admission record not found');
    if (existing.status !== 'PLANNED') {
      throw new ValidationError(`Cannot update admission in ${existing.status} status`);
    }

    return prisma.admissionRecord.update({
      where: { id },
      data: {
        ...body,
        estimatedAmount: body.estimatedAmount !== undefined ? new Decimal(body.estimatedAmount) : undefined,
      },
      include: {
        doctor: true,
        department: true,
      },
    });
  },

  /**
   * Raise payment request to Front Desk / Billing queue (§4.7, D04 p.2).
   * Admission portal NEVER receives cash.
   */
  async requestPayment(admissionId: string, body: RequestPaymentBody, actorId: string) {
    const admission = await prisma.admissionRecord.findUnique({ where: { id: admissionId } });
    if (!admission) throw new NotFoundError('Admission record not found');

    return prisma.admissionPaymentRequest.create({
      data: {
        admissionRecordId: admission.id,
        requestType: body.requestType,
        requestedAmount: new Decimal(body.requestedAmount),
        notes: body.notes,
        status: 'PENDING',
        requestedById: actorId,
      },
      include: {
        admissionRecord: { select: { id: true, admissionNumber: true } },
      },
    });
  },

  /**
   * Admission Check-In / Assign Bed (§4.7 Sub-flow B, §8.8)
   * Transitions Bed status from AVAILABLE to OCCUPIED.
   * Initializes running HospitalInvoice and 3-Key Discharge Clearances.
   */
  async checkInAdmission(admissionId: string, body: CheckInAdmissionBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const admission = await tx.admissionRecord.findUnique({
        where: { id: admissionId },
        include: { dischargeClearances: true },
      });

      if (!admission) throw new NotFoundError('Admission record not found');
      if (admission.status === 'ACTIVE') throw new ValidationError('Patient is already admitted and active');
      if (admission.status === 'DISCHARGED') throw new ValidationError('Cannot check-in a discharged admission');

      // Verify target bed is available
      const bed = await tx.bed.findUnique({ where: { id: body.bedId } });
      if (!bed) throw new NotFoundError('Selected bed not found');
      if (bed.status !== 'AVAILABLE' && bed.id !== admission.bedId) {
        throw new ValidationError(`Selected bed is currently ${bed.status}. Only AVAILABLE beds can be assigned.`);
      }

      // If switching to a different bed from previously assigned bed, free the old bed
      if (admission.bedId && admission.bedId !== bed.id) {
        await tx.bed.update({
          where: { id: admission.bedId },
          data: { status: 'AVAILABLE' },
        });
      }

      // Ensure target bed is marked OCCUPIED
      await tx.bed.update({
        where: { id: bed.id },
        data: { status: 'OCCUPIED' },
      });

      // Update admission status to ACTIVE. Check-in notes are appended to
      // (never overwrite) any intake notes captured at creation — both
      // moments' notes stay on the record.
      const combinedNotes = body.notes
        ? admission.notes
          ? `${admission.notes}\n[Check-In] ${body.notes}`
          : `[Check-In] ${body.notes}`
        : admission.notes;

      const updatedAdmission = await tx.admissionRecord.update({
        where: { id: admission.id },
        data: {
          bedId: bed.id,
          status: 'ACTIVE',
          admittedAt: new Date(),
          notes: combinedNotes,
        },
        include: {
          bed: { include: { room: { include: { ward: true } } } },
          doctor: true,
          department: true,
        },
      });

      // Initialize the admitting department's own "Hospital Services" invoice
      // if one does not exist yet (v7.2 §2.2 — one department invoice per
      // department that bills this admission; other departments' invoices
      // are created on-demand in `addAdmissionService` as their services
      // are actually posted).
      const existingInvoice = await tx.hospitalInvoice.findFirst({
        where: { admissionRecordId: admission.id, departmentId: admission.departmentId },
      });

      if (!existingInvoice) {
        const invoiceNumber = await generateInvoiceNumber(tx);
        await tx.hospitalInvoice.create({
          data: {
            invoiceNumber,
            sourceType: 'ADMISSION',
            admissionRecordId: admission.id,
            departmentId: admission.departmentId,
            panelPatientId: admission.panelPatientId,
            selfPayEncounterId: admission.selfPayEncounterId,
            subtotal: new Decimal(0),
            discountTotal: new Decimal(0),
            total: new Decimal(0),
            paidTotal: new Decimal(0),
            patientShare: new Decimal(0),
            panelReceivable: new Decimal(0),
            status: 'UNPAID',
            createdById: actorId,
          },
        });
      }

      // Initialize 3-Key Discharge Clearances (D16 p.13)
      if (admission.dischargeClearances.length === 0) {
        const pharmacyStatus = admission.medicationMode === 'HOSPITAL_MANAGED' ? 'PENDING' : 'NOT_APPLICABLE';

        await tx.dualDischargeClearance.createMany({
          data: [
            { admissionRecordId: admission.id, clearanceType: 'CLINICAL', status: 'PENDING' },
            { admissionRecordId: admission.id, clearanceType: 'HOSPITAL_BILLING', status: 'PENDING' },
            { admissionRecordId: admission.id, clearanceType: 'PHARMACY', status: pharmacyStatus },
          ],
        });
      }

      return updatedAdmission;
    });
  },

  /**
   * Bed Transfer (§4.7, D16 p.11)
   * Frees previous bed to AVAILABLE, marks target bed OCCUPIED,
   * and records immutable BedTransferHistory audit row.
   */
  async transferBed(admissionId: string, body: TransferBedBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const admission = await tx.admissionRecord.findUnique({
        where: { id: admissionId },
      });

      if (!admission) throw new NotFoundError('Admission record not found');
      if (admission.status !== 'ACTIVE') {
        throw new ValidationError('Bed transfer is only permitted for ACTIVE admissions');
      }
      if (!admission.bedId) {
        throw new ValidationError('Patient currently has no assigned bed to transfer from');
      }
      if (admission.bedId === body.targetBedId) {
        throw new ValidationError('Target bed is identical to current assigned bed');
      }

      const targetBed = await tx.bed.findUnique({ where: { id: body.targetBedId } });
      if (!targetBed) throw new NotFoundError('Target bed not found');
      if (targetBed.status !== 'AVAILABLE') {
        throw new ValidationError(`Target bed is ${targetBed.status}. Only AVAILABLE beds can receive a transfer.`);
      }

      // Free previous bed
      await tx.bed.update({
        where: { id: admission.bedId },
        data: { status: 'AVAILABLE' },
      });

      // Occupy target bed
      await tx.bed.update({
        where: { id: targetBed.id },
        data: { status: 'OCCUPIED' },
      });

      // Log immutable BedTransferHistory
      const transferLog = await tx.bedTransferHistory.create({
        data: {
          admissionRecordId: admission.id,
          fromBedId: admission.bedId,
          toBedId: targetBed.id,
          reason: body.reason,
          transferredById: actorId,
        },
      });

      // Update admission record bedId
      const updatedAdmission = await tx.admissionRecord.update({
        where: { id: admission.id },
        data: { bedId: targetBed.id },
        include: {
          bed: { include: { room: { include: { ward: true } } } },
        },
      });

      return {
        admission: updatedAdmission,
        transferLog,
      };
    });
  },

  /**
   * Append running hospital service or procedure charge (§4.7, D16 p.11)
   */
  async addAdmissionService(admissionId: string, body: AddAdmissionServiceBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const admission = await tx.admissionRecord.findUnique({
        where: { id: admissionId },
        include: {
          hospitalInvoices: { where: { sourceType: 'ADMISSION' }, include: { lines: true } },
          panelPatient: { include: { corporatePanel: { include: { discountRules: true } } } },
        },
      });

      if (!admission) throw new NotFoundError('Admission record not found');
      if (admission.status !== 'ACTIVE') {
        throw new ValidationError('Cannot add hospital charges to a non-active admission');
      }

      const serviceRate = await tx.serviceRate.findUnique({ where: { id: body.serviceRateId } });
      if (!serviceRate || !serviceRate.isActive) {
        throw new NotFoundError('Service rate not found or inactive');
      }

      // v7.2 §2.2 — one invoice per (admission × department): a Lab or
      // Pharmacy service posted against a General Medicine admission bills
      // to that service's OWN department's invoice, not the admitting
      // department's. Find-or-create per department, never a single
      // admission-wide invoice.
      let invoice = admission.hospitalInvoices.find((inv) => inv.departmentId === serviceRate.departmentId);
      if (!invoice) {
        invoice = await tx.hospitalInvoice.create({
          data: {
            invoiceNumber: await generateInvoiceNumber(tx),
            sourceType: 'ADMISSION',
            admissionRecordId: admission.id,
            departmentId: serviceRate.departmentId,
            panelPatientId: admission.panelPatientId,
            selfPayEncounterId: admission.selfPayEncounterId,
            subtotal: new Decimal(0),
            discountTotal: new Decimal(0),
            total: new Decimal(0),
            paidTotal: new Decimal(0),
            patientShare: new Decimal(0),
            panelReceivable: new Decimal(0),
            status: 'UNPAID',
            createdById: actorId,
          },
          include: { lines: true },
        });
      }

      const rate = serviceRate.standardRate;
      const qty = new Decimal(body.quantity);
      const lineGross = rate.mul(qty);

      // v7.2 §2.5 — Patient Share vs Panel Receivable, same resolution
      // `appointments.service.ts` uses (Panel Service rule → else NOT_COVERED).
      const coverage = resolvePanelCoverage(lineGross, admission.panelPatient?.corporatePanel?.discountRules, serviceRate.id);
      const discountAmount = coverage.discountAmount;
      const discountReason = coverage.discountReason ?? body.notes ?? null;
      const lineNet = lineGross.minus(discountAmount);

      const createdLine = await tx.invoiceLineItem.create({
        data: {
          hospitalInvoiceId: invoice.id,
          serviceRateId: serviceRate.id,
          rateSnapshot: rate,
          quantity: qty,
          lineGross,
          discountAmount,
          discountReason,
          lineNet,
          patientShare: coverage.patientShare,
          panelReceivable: coverage.panelReceivable,
          performedByStaffId: body.performedByStaffId ?? admission.doctorStaffId,
          isCompleted: true,
        },
        include: { serviceRate: true, performedBy: true },
      });

      // Recalculate this department invoice's totals (never another
      // department's — each stays independently owned per §2.2).
      const allLines = [...invoice.lines, createdLine];
      const newSubtotal = allLines.reduce((acc, l) => acc.plus(l.lineGross ?? 0), new Decimal(0));
      const newDiscountTotal = allLines.reduce((acc, l) => acc.plus(l.discountAmount ?? 0), new Decimal(0));
      const newTotal = allLines.reduce((acc, l) => acc.plus(l.lineNet ?? 0), new Decimal(0));
      const newPatientShare = allLines.reduce((acc, l: any) => acc.plus(l.patientShare ?? 0), new Decimal(0));
      const newPanelReceivable = allLines.reduce((acc, l: any) => acc.plus(l.panelReceivable ?? 0), new Decimal(0));

      const newStatus = invoice.paidTotal.greaterThanOrEqualTo(newTotal) && newTotal.greaterThan(0)
        ? 'PAID'
        : invoice.paidTotal.greaterThan(0)
          ? 'PARTIALLY_PAID'
          : 'UNPAID';

      await tx.hospitalInvoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: newSubtotal,
          discountTotal: newDiscountTotal,
          total: newTotal,
          patientShare: newPatientShare,
          panelReceivable: newPanelReceivable,
          status: newStatus,
        },
      });

      return createdLine;
    });
  },

  /**
   * Toggle Medication Fulfillment Mode (SELF vs HOSPITAL_MANAGED) — §4.7 Sub-flow C, D16 p.12
   * Requires mandatory reason. Writes immutable MedicationModeHistory audit entry.
   */
  async changeMedicationMode(admissionId: string, body: ChangeMedicationModeBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const admission = await tx.admissionRecord.findUnique({
        where: { id: admissionId },
        include: { dischargeClearances: true },
      });

      if (!admission) throw new NotFoundError('Admission record not found');
      if (admission.status === 'DISCHARGED') {
        throw new ValidationError('Cannot change medication mode of a discharged patient');
      }

      // Record immutable audit history
      const historyEntry = await tx.medicationModeHistory.create({
        data: {
          admissionRecordId: admission.id,
          previousMode: admission.medicationMode,
          newMode: body.mode,
          reason: body.reason,
          changedById: actorId,
        },
      });

      // Update current mode on admission record
      const updated = await tx.admissionRecord.update({
        where: { id: admission.id },
        data: { medicationMode: body.mode },
      });

      // Adjust Pharmacy Clearance requirement based on mode
      const newPharmacyStatus = body.mode === 'HOSPITAL_MANAGED' ? 'PENDING' : 'NOT_APPLICABLE';
      await tx.dualDischargeClearance.updateMany({
        where: {
          admissionRecordId: admission.id,
          clearanceType: 'PHARMACY',
        },
        data: { status: newPharmacyStatus },
      });

      return { admission: updated, historyEntry };
    });
  },

  /**
   * Create medicine request for Standalone Pharmacy queue (§4.7, §8.8)
   * Permitted ONLY when medicationMode is HOSPITAL_MANAGED.
   */
  async createPharmacyRequest(admissionId: string, body: CreatePharmacyRequestBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const admission = await tx.admissionRecord.findUnique({
        where: { id: admissionId },
      });

      if (!admission) throw new NotFoundError('Admission record not found');
      if (admission.medicationMode !== 'HOSPITAL_MANAGED') {
        throw new ValidationError(
          'Pharmacy requests are permitted only when Medication Mode is HOSPITAL_MANAGED. Current mode is SELF.',
        );
      }

      const medicineRequestNumber = await generateMedicineRequestNumber(tx);
      const idempotencyKey = `MED-IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // v7.2 §2.6 High-Cost Medicine gate — Medicine Line Amount = Quantity
      // × Current Approved Rate; if the configured policy is enabled and any
      // line exceeds its threshold, the whole request is blocked at
      // AUTHORIZATION_REQUIRED instead of proceeding straight to REQUESTED.
      // No policy row / disabled policy → completely unchanged behavior.
      const policy = await tx.highCostMedicinePolicy.findFirst();
      let triggeringLineAmount: Decimal | null = null;
      if (policy?.enabled) {
        const medicines = await tx.medicineMaster.findMany({
          where: { id: { in: body.lines.map((l) => l.medicineId) } },
        });
        const rateById = new Map(medicines.map((m) => [m.id, m.saleRate ?? new Decimal(0)]));
        for (const line of body.lines) {
          const rate = rateById.get(line.medicineId) ?? new Decimal(0);
          const lineAmount = policy.thresholdBasis === 'PER_UNIT' ? rate : rate.mul(line.requestedQuantity);
          if (lineAmount.greaterThan(policy.thresholdAmount)) {
            triggeringLineAmount = lineAmount;
            break;
          }
        }
      }

      const clearance = await tx.pharmacyClearance.create({
        data: {
          admissionRecordId: admission.id,
          medicineRequestNumber,
          idempotencyKey,
          status: triggeringLineAmount ? 'AUTHORIZATION_REQUIRED' : 'REQUESTED',
          requestedById: actorId,
          notes: body.notes,
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
          highCostAuthorization: true,
        },
      });

      let highCostAuthorization = null;
      if (triggeringLineAmount && policy) {
        highCostAuthorization = await tx.highCostMedicineAuthorization.create({
          data: {
            pharmacyClearanceId: clearance.id,
            lineTotal: triggeringLineAmount,
            thresholdAmount: policy.thresholdAmount,
            status: 'PENDING',
          },
        });
      }

      // Ensure PHARMACY discharge clearance is set to PENDING
      await tx.dualDischargeClearance.updateMany({
        where: { admissionRecordId: admission.id, clearanceType: 'PHARMACY' },
        data: { status: 'PENDING' },
      });

      return { ...clearance, highCostAuthorization };
    });
  },

  /**
   * High-Cost Medicine Authorization (HMS_V7.2_NEW_REQUIREMENTS.md §2.6) —
   * captures whichever of attendant confirmation / management credential
   * approval the policy requires, evaluates `combinedLogic`, and releases
   * the pharmacy request back to `REQUESTED` only once satisfied. Never a
   * free-typed approver name — management approval validates a real
   * `PortalUser` (ADMIN/SUPER_ADMIN) credential.
   */
  async authorizeHighCostMedicine(
    admissionId: string,
    clearanceId: string,
    body: AuthorizeHighCostMedicineBody,
    actorId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const clearance = await tx.pharmacyClearance.findUnique({
        where: { id: clearanceId },
        include: { highCostAuthorization: true },
      });
      if (!clearance || clearance.admissionRecordId !== admissionId) {
        throw new NotFoundError('Pharmacy request not found for this admission');
      }
      if (!clearance.highCostAuthorization) {
        throw new ValidationError('This pharmacy request has no high-cost authorization pending');
      }
      if (clearance.highCostAuthorization.status !== 'PENDING') {
        throw new ValidationError(`This high-cost authorization is already ${clearance.highCostAuthorization.status}`);
      }

      const policy = await tx.highCostMedicinePolicy.findFirst();
      if (!policy) throw new NotFoundError('High-cost medicine policy not configured');

      const updateData: Record<string, any> = {
        panelAuthorizationRef: body.panelAuthorizationRef,
      };

      let attendantSatisfied = !policy.attendantConfirmationRequired;
      if (policy.attendantConfirmationRequired && body.attendantConfirmed) {
        if (!body.attendantName || !body.attendantRelation) {
          throw new ValidationError('Attendant name and relationship are required to confirm this request');
        }
        updateData.attendantName = body.attendantName;
        updateData.attendantRelation = body.attendantRelation;
        updateData.attendantContact = body.attendantContact;
        updateData.attendantConfirmed = true;
        updateData.attendantConfirmedById = actorId;
        updateData.attendantConfirmedAt = new Date();
        attendantSatisfied = true;
      }

      let managementSatisfied = !policy.managementApprovalRequired;
      if (policy.managementApprovalRequired && body.managementUsername && body.managementPassword) {
        const manager = await tx.portalUser.findUnique({ where: { username: body.managementUsername } });
        if (!manager || manager.status !== 'ACTIVE' || !['ADMIN', 'SUPER_ADMIN'].includes(manager.role)) {
          throw new AuthenticationError('Invalid management credentials');
        }
        const passwordOk = await bcrypt.compare(body.managementPassword, manager.passwordHash);
        if (!passwordOk) throw new AuthenticationError('Invalid management credentials');

        updateData.managementApprovedById = manager.id;
        updateData.managementReason = body.managementReason;
        updateData.managementApprovedAt = new Date();
        managementSatisfied = true;
      }

      const combinedSatisfied =
        policy.combinedLogic === 'ATTENDANT_ONLY'
          ? attendantSatisfied
          : policy.combinedLogic === 'MANAGEMENT_ONLY'
            ? managementSatisfied
            : policy.combinedLogic === 'EITHER'
              ? attendantSatisfied || managementSatisfied
              : attendantSatisfied && managementSatisfied; // BOTH

      if (!combinedSatisfied) {
        const missing = [
          policy.attendantConfirmationRequired && !attendantSatisfied ? 'attendant confirmation' : null,
          policy.managementApprovalRequired && !managementSatisfied ? 'management approval' : null,
        ].filter(Boolean);
        throw new ValidationError(`Authorization incomplete — still missing: ${missing.join(', ') || 'required approval'}`);
      }

      updateData.status = 'AUTHORIZED';
      const updated = await tx.highCostMedicineAuthorization.update({
        where: { id: clearance.highCostAuthorization.id },
        data: updateData,
      });

      await tx.pharmacyClearance.update({ where: { id: clearance.id }, data: { status: 'REQUESTED' } });

      return updated;
    });
  },

  /** Explicit decline — no credential requirement, matches "Rejected/Pending request cannot be dispensed" as the safe default. */
  async rejectHighCostMedicine(admissionId: string, clearanceId: string, body: RejectHighCostMedicineBody) {
    return prisma.$transaction(async (tx) => {
      const clearance = await tx.pharmacyClearance.findUnique({
        where: { id: clearanceId },
        include: { highCostAuthorization: true },
      });
      if (!clearance || clearance.admissionRecordId !== admissionId) {
        throw new NotFoundError('Pharmacy request not found for this admission');
      }
      if (!clearance.highCostAuthorization) {
        throw new ValidationError('This pharmacy request has no high-cost authorization pending');
      }

      const updated = await tx.highCostMedicineAuthorization.update({
        where: { id: clearance.highCostAuthorization.id },
        data: { status: 'REJECTED', managementReason: body.reason },
      });
      await tx.pharmacyClearance.update({ where: { id: clearance.id }, data: { status: 'REJECTED' } });

      return updated;
    });
  },

  /**
   * Grant Clearance stream (§4.7 Sub-flow D, D16 p.13)
   * Streams: CLINICAL, HOSPITAL_BILLING, PHARMACY
   */
  async grantClearance(admissionId: string, body: GrantClearanceBody, actorId: string) {
    // v7.2 §2.4 — Clinical discharge is doctor-credential-only; an Admission
    // user may never self-clear this gate. Use `clinicalDischarge` instead.
    if (body.clearanceType === 'CLINICAL') {
      throw new ValidationError(
        'Clinical discharge requires doctor credential authorization — use the Doctor Discharge Authorization action instead.',
      );
    }

    return prisma.$transaction(async (tx) => {
      const admission = await tx.admissionRecord.findUnique({
        where: { id: admissionId },
        include: { hospitalInvoices: true, dischargeClearances: true },
      });

      if (!admission) throw new NotFoundError('Admission record not found');

      // If granting HOSPITAL_BILLING clearance, check that hospital invoice has zero outstanding balance
      if (body.clearanceType === 'HOSPITAL_BILLING') {
        const hasUnpaidBills = admission.hospitalInvoices.some(
          (inv) => inv.total.minus(inv.paidTotal).greaterThan(0),
        );
        if (hasUnpaidBills) {
          throw new ValidationError(
            'Cannot grant Hospital Billing clearance: patient has unpaid hospital invoices.',
          );
        }
      }

      // Upsert clearance status to CLEARED
      const existing = admission.dischargeClearances.find(
        (c) => c.clearanceType === body.clearanceType,
      );

      let cleared;
      if (existing) {
        cleared = await tx.dualDischargeClearance.update({
          where: { id: existing.id },
          data: {
            status: 'CLEARED',
            clearedById: actorId,
            clearedAt: new Date(),
          },
        });
      } else {
        cleared = await tx.dualDischargeClearance.create({
          data: {
            admissionRecordId: admission.id,
            clearanceType: body.clearanceType,
            status: 'CLEARED',
            clearedById: actorId,
            clearedAt: new Date(),
          },
        });
      }

      return cleared;
    });
  },

  /**
   * Doctor Clinical Discharge Authorization (HMS_V7.2_NEW_REQUIREMENTS.md
   * §2.4) — the only way the CLINICAL clearance gate can be cleared. Verifies
   * the doctor's own clinical-authorization credential (separate from
   * `PortalUser` login — a doctor can be Staff-Record-Only and still hold
   * this), captures the Discharge Summary, clears the CLINICAL gate the same
   * way `grantClearance` would (so `getClearances`/`dischargePatient` need no
   * changes), and immediately routes the case to Front Desk by setting
   * status to `DISCHARGE_PENDING` ("Clinically Discharged - Billing
   * Pending", PDF 23 §12's status chain) — HOSPITAL_BILLING/PHARMACY
   * clearance and final discharge are unaffected, still gated as before.
   */
  async clinicalDischarge(admissionId: string, body: ClinicalDischargeBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const admission = await tx.admissionRecord.findUnique({
        where: { id: admissionId },
        include: { dischargeClearances: true },
      });
      if (!admission) throw new NotFoundError('Admission record not found');
      if (admission.status !== 'ACTIVE') {
        throw new ValidationError('Clinical discharge is only permitted for an ACTIVE admission');
      }

      // `db/client.ts`'s global `omit` structurally hides
      // `clinicalAuthPasswordHash` from every Staff query (by design, so it
      // can never leak through a `doctor: true`/`performedBy: true`
      // include) — this is the one legitimate server-side read that
      // actually needs it, so it's explicitly un-omitted for this query only.
      const doctor = await tx.staff.findUnique({
        where: { clinicalAuthUsername: body.doctorUsername },
        include: { department: true },
        omit: { clinicalAuthPasswordHash: false },
      });
      if (!doctor || !doctor.clinicalAuthActive || !doctor.clinicalAuthPasswordHash) {
        throw new AuthenticationError('Invalid doctor credentials');
      }
      const passwordOk = await bcrypt.compare(body.doctorPassword, doctor.clinicalAuthPasswordHash);
      if (!passwordOk) throw new AuthenticationError('Invalid doctor credentials');

      const summary = await tx.dischargeSummary.create({
        data: {
          admissionRecordId: admission.id,
          finalDiagnosis: body.dischargeSummary.finalDiagnosis,
          treatmentSummary: body.dischargeSummary.treatmentSummary,
          conditionAtDischarge: body.dischargeSummary.conditionAtDischarge,
          medicinesInstructions: body.dischargeSummary.medicinesInstructions,
          followUpAdvice: body.dischargeSummary.followUpAdvice,
          followUpDoctorStaffId: body.dischargeSummary.followUpDoctorStaffId,
          followUpDate: body.dischargeSummary.followUpDate,
          additionalNotes: body.dischargeSummary.additionalNotes,
          doctorStaffId: doctor.id,
          doctorNameSnapshot: doctor.fullName,
          doctorDepartmentSnapshot: doctor.department.name,
          initiatedById: actorId,
        },
      });

      const existingClinical = admission.dischargeClearances.find((c) => c.clearanceType === 'CLINICAL');
      if (existingClinical) {
        await tx.dualDischargeClearance.update({
          where: { id: existingClinical.id },
          data: { status: 'CLEARED', clearedById: actorId, clearedAt: new Date() },
        });
      } else {
        await tx.dualDischargeClearance.create({
          data: { admissionRecordId: admission.id, clearanceType: 'CLINICAL', status: 'CLEARED', clearedById: actorId, clearedAt: new Date() },
        });
      }

      const updatedAdmission = await tx.admissionRecord.update({
        where: { id: admission.id },
        data: { status: 'DISCHARGE_PENDING' },
      });

      return { admission: updatedAdmission, dischargeSummary: summary };
    });
  },

  /**
   * Get 3-Key Discharge Clearances status (§4.7, §8.8)
   */
  async getClearances(admissionId: string) {
    const clearances = await prisma.dualDischargeClearance.findMany({
      where: { admissionRecordId: admissionId },
      include: { clearedBy: { select: { id: true, username: true } } },
    });

    const pending = clearances.filter((c) => c.status === 'PENDING').map((c) => c.clearanceType);
    const isDischargeReady = pending.length === 0 && clearances.length > 0;

    return {
      admissionId,
      isDischargeReady,
      pendingClearances: pending,
      clearances,
    };
  },

  /**
   * Attempt Final Discharge — Strict Dual / 3-Key Discharge Gate (§4.7 Sub-flow D, D16 p.13)
   * Formula: Clinical Ready + Hospital Billing Clearance + Pharmacy Clearance = Final Discharge.
   * If any clearance is PENDING, discharge is blocked by the API.
   * On success: marks admission DISCHARGED and automatically frees Bed to AVAILABLE.
   */
  async dischargePatient(admissionId: string, _actorId: string) {
    return prisma.$transaction(async (tx) => {
      const admission = await tx.admissionRecord.findUnique({
        where: { id: admissionId },
        include: { dischargeClearances: true },
      });

      if (!admission) throw new NotFoundError('Admission record not found');
      if (admission.status === 'DISCHARGED') {
        throw new ValidationError('Patient is already discharged');
      }

      const clearances = admission.dischargeClearances;
      const pendingClearances = clearances.filter((c) => c.status === 'PENDING').map((c) => c.clearanceType);

      if (pendingClearances.length > 0) {
        throw new ValidationError(
          `Final discharge blocked: The following clearances are still pending: [${pendingClearances.join(', ')}]. All 3 clearance gates must be approved before discharge.`,
        );
      }

      // Set AdmissionRecord to DISCHARGED
      const discharged = await tx.admissionRecord.update({
        where: { id: admission.id },
        data: {
          status: 'DISCHARGED',
          dischargedAt: new Date(),
        },
      });

      // Automatically free assigned Bed to AVAILABLE
      if (admission.bedId) {
        await tx.bed.update({
          where: { id: admission.bedId },
          data: { status: 'AVAILABLE' },
        });
      }

      return {
        admission: discharged,
        message: 'Patient discharged successfully. Bed freed to AVAILABLE.',
      };
    });
  },

  /**
   * Consolidated Discharge Summary (§8.8, D16 p.13)
   * Shows hospital charges, payments, medication history, and clearance sign-offs.
   */
  async getDischargeSummary(admissionId: string) {
    const admission = await prisma.admissionRecord.findUnique({
      where: { id: admissionId },
      include: {
        panelPatient: { include: { corporatePanel: true } },
        selfPayEncounter: true,
        department: true,
        doctor: true,
        bed: { include: { room: { include: { ward: true } } } },
        bedTransfers: {
          include: {
            fromBed: true,
            toBed: true,
            transferredBy: { select: { username: true } },
          },
        },
        medicationModeHistory: true,
        hospitalInvoices: {
          include: {
            lines: { include: { serviceRate: true, performedBy: true } },
            paymentReceipts: true,
          },
        },
        dischargeClearances: {
          include: { clearedBy: { select: { username: true } } },
        },
      },
    });

    if (!admission) throw new NotFoundError('Admission record not found');

    const totalHospitalBill = admission.hospitalInvoices.reduce(
      (sum, inv) => sum.plus(inv.total),
      new Decimal(0),
    );
    const totalHospitalPaid = admission.hospitalInvoices.reduce(
      (sum, inv) => sum.plus(inv.paidTotal),
      new Decimal(0),
    );
    const hospitalOutstanding = totalHospitalBill.minus(totalHospitalPaid);

    return {
      admissionNumber: admission.admissionNumber,
      status: admission.status,
      admittedAt: admission.admittedAt,
      dischargedAt: admission.dischargedAt,
      patient: admission.panelPatient
        ? {
            type: 'PANEL',
            name: admission.panelPatient.fullName,
            mrNumber: admission.panelPatient.mrNumber,
            panel: admission.panelPatient.corporatePanel.organizationName,
          }
        : {
            type: 'SELF_PAY',
            name: admission.selfPayEncounter?.fullName ?? 'Inpatient',
            phone: admission.selfPayEncounter?.phone,
          },
      doctor: admission.doctor?.fullName ?? null,
      department: admission.department.name,
      diagnosis: admission.diagnosis,
      bedSummary: {
        currentBed: admission.bed?.bedNumber ?? null,
        room: admission.bed?.room.name ?? null,
        ward: admission.bed?.room.ward.name ?? null,
        transfersCount: admission.bedTransfers.length,
      },
      hospitalFinancialSummary: {
        totalHospitalBill,
        totalHospitalPaid,
        hospitalOutstanding,
      },
      clearances: admission.dischargeClearances.map((c) => ({
        type: c.clearanceType,
        status: c.status,
        clearedBy: c.clearedBy?.username ?? null,
        clearedAt: c.clearedAt,
      })),
    };
  },
};
