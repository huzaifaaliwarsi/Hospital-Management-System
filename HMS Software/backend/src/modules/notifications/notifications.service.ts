import { prisma } from '@/db/client';

export interface CreateNotificationParams {
  title: string;
  message: string;
  type?: 'info' | 'urgent' | 'warning' | 'success' | string;
  module?: string;
  targetPortal?: 'admission' | 'front-desk' | 'all' | string;
  actionUrl?: string;
  referenceId?: string;
  createdById?: string | null;
}

export const notificationsService = {
  async createNotification(params: CreateNotificationParams) {
    if (!prisma.hospitalNotification?.create) return null as any;

    // Deduplicate: if an unread notification with same title and referenceId was created recently, skip
    if (params.referenceId && params.title) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const existing = await prisma.hospitalNotification.findFirst({
        where: {
          referenceId: params.referenceId,
          targetPortal: params.targetPortal || 'all',
          title: params.title,
          isRead: false,
          createdAt: { gte: tenMinutesAgo },
        },
      });
      if (existing) return existing;
    }

    return prisma.hospitalNotification.create({
      data: {
        title: params.title,
        message: params.message,
        type: params.type || 'info',
        module: params.module || 'General',
        targetPortal: params.targetPortal || 'all',
        actionUrl: params.actionUrl || null,
        referenceId: params.referenceId || null,
        createdById: params.createdById || null,
      },
    });
  },

  async listNotifications(targetPortal?: string, limit: number = 30) {
    // Auto-sync active DB states to ensure zero missed notifications
    await this.syncRealStateNotifications();

    const where: any = {};
    if (targetPortal && targetPortal !== 'all') {
      where.targetPortal = targetPortal;
    }

    return prisma.hospitalNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async markAsRead(id: string) {
    return prisma.hospitalNotification.update({
      where: { id },
      data: { isRead: true },
    });
  },

  async markAllAsRead(targetPortal?: string) {
    const where: any = { isRead: false };
    if (targetPortal && targetPortal !== 'all') {
      where.targetPortal = targetPortal;
    }
    return prisma.hospitalNotification.updateMany({
      where,
      data: { isRead: true },
    });
  },

  /**
   * Automatically synchronizes real database state so pending admissions from
   * Front Desk and pending discharge payments always have real notification entries.
   */
  async syncRealStateNotifications() {
    try {
      // 1. Check for PLANNED admissions (Front Desk -> Admission Portal)
      const plannedAdmissions = await prisma.admissionRecord.findMany({
        where: { status: 'PLANNED' },
        include: {
          panelPatient: { select: { fullName: true, mrNumber: true } },
          selfPayEncounter: { select: { fullName: true } },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      for (const adm of plannedAdmissions) {
        const patientName = adm.panelPatient?.fullName || adm.selfPayEncounter?.fullName || 'Patient';
        const existing = await prisma.hospitalNotification.findFirst({
          where: {
            referenceId: adm.id,
            targetPortal: 'admission',
          },
        });

        if (!existing) {
          await prisma.hospitalNotification.create({
            data: {
              title: 'New Inpatient Admission Request',
              message: `Patient ${patientName} (${adm.admissionNumber}) registered at Front Desk — awaiting bed check-in.`,
              type: 'urgent',
              module: 'Admissions',
              targetPortal: 'admission',
              actionUrl: '/admission/planned_admissions',
              referenceId: adm.id,
              createdAt: adm.createdAt,
            },
          });
        }
      }

      // 2. Check for DISCHARGE_PENDING admissions (Admission Portal -> Front Desk)
      const pendingDischarges = await prisma.admissionRecord.findMany({
        where: { status: 'DISCHARGE_PENDING' },
        include: {
          panelPatient: { select: { fullName: true } },
          selfPayEncounter: { select: { fullName: true } },
        },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      });

      for (const adm of pendingDischarges) {
        const patientName = adm.panelPatient?.fullName || adm.selfPayEncounter?.fullName || 'Patient';
        const existing = await prisma.hospitalNotification.findFirst({
          where: {
            referenceId: adm.id,
            targetPortal: 'front-desk',
          },
        });

        if (!existing) {
          await prisma.hospitalNotification.create({
            data: {
              title: 'Discharge Billing & Payment Clearance',
              message: `Patient ${patientName} (${adm.admissionNumber}) clinically discharged. Awaiting final billing closure at Front Desk.`,
              type: 'warning',
              module: 'Billing',
              targetPortal: 'front-desk',
              actionUrl: '/front-desk/billing_pending_discharges',
              referenceId: adm.id,
              createdAt: adm.updatedAt,
            },
          });
        }
      }

      // 3. Check for active PENDING AdmissionPaymentRequests (Admission Portal -> Front Desk)
      const pendingPaymentRequests = await prisma.admissionPaymentRequest.findMany({
        where: { status: 'PENDING' },
        include: {
          admissionRecord: {
            include: {
              panelPatient: { select: { fullName: true, mrNumber: true } },
              selfPayEncounter: { select: { fullName: true } },
            },
          },
        },
        take: 10,
        orderBy: { requestedAt: 'desc' },
      });

      for (const req of pendingPaymentRequests) {
        const adm = req.admissionRecord;
        if (!adm) continue;
        const patientName = adm.panelPatient?.fullName || adm.selfPayEncounter?.fullName || 'Patient';
        const existing = await prisma.hospitalNotification.findFirst({
          where: {
            targetPortal: 'front-desk',
            OR: [
              { referenceId: req.id },
              { referenceId: adm.id },
            ],
          },
        });

        if (!existing) {
          const amountStr = Number(req.requestedAmount).toLocaleString('en-PK', { maximumFractionDigits: 0 });
          const isFinal = req.requestType === 'FINAL';
          await prisma.hospitalNotification.create({
            data: {
              title: isFinal ? `Discharge Clearance Needed: ${patientName}` : `Payment Request: ${patientName}`,
              message: isFinal
                ? `Discharge billing clearance requested for ${patientName} (${adm.admissionNumber}). Outstanding balance: Rs. ${amountStr}. Please collect clearance payment at Front Desk.`
                : `Payment request of Rs. ${amountStr} pending for ${patientName} (${adm.admissionNumber}). Please collect at Front Desk.`,
              type: 'urgent',
              module: 'Billing',
              targetPortal: 'front-desk',
              actionUrl: isFinal ? '/front-desk/billing_pending_discharges' : '/front-desk/admission_payment_requests',
              referenceId: req.id,
              createdAt: req.requestedAt,
            },
          });
        }
      }
    } catch {
      // Background sync shouldn't crash notification queries
    }
  },
};
