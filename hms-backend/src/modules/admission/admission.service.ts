import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
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
} from './admission.schemas';

function generateAdmissionNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ADM-${ts}-${rand}`;
}

function generateInvoiceNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${ts}-${rand}`;
}

function generateMedicineRequestNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `MED-REQ-${ts}-${rand}`;
}

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

      const admissionNumber = generateAdmissionNumber();

      const admission = await tx.admissionRecord.create({
        data: {
          admissionNumber,
          panelPatientId: body.panelPatientId,
          selfPayEncounterId,
          departmentId: body.departmentId,
          doctorStaffId: body.doctorStaffId,
          bedId: body.preferredBedId ?? null,
          status: 'PLANNED',
          medicationMode: body.medicationMode,
          diagnosis: body.diagnosis,
          expectedAt: body.expectedAt,
          estimatedAmount: body.estimatedAmount ? new Decimal(body.estimatedAmount) : null,
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

      return admission;
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
          },
        },
        dischargeClearances: {
          include: { clearedBy: { select: { id: true, username: true } } },
        },
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
      if (bed.status !== 'AVAILABLE') {
        throw new ValidationError(`Selected bed is currently ${bed.status}. Only AVAILABLE beds can be assigned.`);
      }

      // Mark bed OCCUPIED
      await tx.bed.update({
        where: { id: bed.id },
        data: { status: 'OCCUPIED' },
      });

      // Update admission status to ACTIVE
      const updatedAdmission = await tx.admissionRecord.update({
        where: { id: admission.id },
        data: {
          bedId: bed.id,
          status: 'ACTIVE',
          admittedAt: new Date(),
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
        const invoiceNumber = generateInvoiceNumber();
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
            invoiceNumber: generateInvoiceNumber(),
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

      const medicineRequestNumber = generateMedicineRequestNumber();
      const idempotencyKey = `MED-IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      const clearance = await tx.pharmacyClearance.create({
        data: {
          admissionRecordId: admission.id,
          medicineRequestNumber,
          idempotencyKey,
          status: 'REQUESTED',
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
        },
      });

      // Ensure PHARMACY discharge clearance is set to PENDING
      await tx.dualDischargeClearance.updateMany({
        where: { admissionRecordId: admission.id, clearanceType: 'PHARMACY' },
        data: { status: 'PENDING' },
      });

      return clearance;
    });
  },

  /**
   * Grant Clearance stream (§4.7 Sub-flow D, D16 p.13)
   * Streams: CLINICAL, HOSPITAL_BILLING, PHARMACY
   */
  async grantClearance(admissionId: string, body: GrantClearanceBody, actorId: string) {
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
      doctor: admission.doctor.fullName,
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
