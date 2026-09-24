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
    } catch {
      // Background sync shouldn't crash notification queries
    }
  },
};
