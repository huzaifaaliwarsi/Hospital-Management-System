import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dashboardService } from '../src/modules/reports/dashboard.service';

vi.mock('@/db/client', () => {
  return {
    prisma: {
      department: {
        count: vi.fn().mockResolvedValue(4),
        findMany: vi.fn().mockResolvedValue([
          { id: 'dep-1', name: 'General Medicine', departmentType: 'CLINICAL' },
        ]),
      },
      staff: {
        count: vi.fn().mockResolvedValue(12),
        findMany: vi.fn().mockResolvedValue([
          { id: 'doc-1', fullName: 'Dr. Ayesha Khan', designation: 'Consultant Physician', department: { name: 'General Medicine' } },
        ]),
      },
      staffEmploymentHistory: {
        findMany: vi.fn().mockResolvedValue([
          { staffId: 'doc-1', shiftName: 'Morning', shiftStart: new Date('2026-01-01T09:00:00Z'), shiftEnd: new Date('2026-01-01T14:00:00Z') },
        ]),
      },
      corporatePanel: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([]),
      },
      panelPatient: {
        count: vi.fn().mockResolvedValue(45),
      },
      portalUser: {
        count: vi.fn().mockResolvedValue(2),
      },
      ward: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'w-1',
            name: 'General Ward',
            genderPolicy: 'MIXED',
            rooms: [
              {
                id: 'r-1',
                beds: [
                  { id: 'b-1', status: 'AVAILABLE' },
                  { id: 'b-2', status: 'OCCUPIED' },
                ],
              },
            ],
          },
        ]),
      },
      admissionRecord: {
        findMany: vi.fn().mockResolvedValue([{ bedId: 'b-2' }]),
      },
      hospitalInvoice: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'inv-1',
            subtotal: 1000,
            discountTotal: 100,
            total: 900,
            paidTotal: 900,
            status: 'PAID',
            panelPatientId: null,
            encounterType: 'OPD',
            createdAt: new Date(),
          },
        ]),
      },
      paymentReceipt: {
        findMany: vi.fn().mockResolvedValue([
          { method: 'CASH', amount: 900, isReversed: false },
        ]),
      },
      appointment: {
        findMany: vi.fn().mockResolvedValue([{ status: 'COMPLETED' }]),
        groupBy: vi.fn().mockResolvedValue([{ doctorStaffId: 'doc-1', _count: { _all: 3 } }]),
      },
      stockItem: {
        findMany: vi.fn().mockResolvedValue([
          { id: 's-1', code: 'SYR-5', name: '5ml Syringe', unit: 'pcs', reorderLevel: 50 },
        ]),
      },
      stockLedger: {
        groupBy: vi.fn().mockResolvedValue([
          { stockItemId: 's-1', _sum: { quantityDelta: 30 } }, // Below reorderLevel (50) -> Low stock
        ]),
      },
      pharmacyDispense: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'log-1',
            action: 'CREATE',
            entityType: 'Department',
            entityId: 'dep-1',
            createdAt: new Date(),
            actor: { displayName: 'Super Admin', username: 'superadmin', role: 'SUPER_ADMIN' },
          },
        ]),
      },
    },
  };
});

describe('Super Admin Dashboard Service', () => {
  it('aggregates master infrastructure, beds, billing and alerts accurately', async () => {
    const data = await dashboardService.getSuperAdminDashboard({ preset: 'today' });

    expect(data.period.label).toBe('Today');
    expect(data.infrastructure.activeDepartmentsCount).toBe(4);
    expect(data.infrastructure.totalStaffCount).toBe(12);
    expect(data.infrastructure.activePanelsCount).toBe(3);

    // Bed metrics: 2 beds total, 1 occupied (b-2), 1 available
    expect(data.bedMetrics.totalBeds).toBe(2);
    expect(data.bedMetrics.occupiedBeds).toBe(1);
    expect(data.bedMetrics.availableBeds).toBe(1);
    expect(data.bedMetrics.occupancyPercent).toBe(50);

    // Billing metrics
    expect(data.billingSummary.totalInvoices).toBe(1);
    expect(data.billingSummary.netBilling).toBe(900);
    expect(data.billingSummary.paidAmount).toBe(900);
    expect(data.revenueChannels.cash).toBe(900);

    // Inventory alert: 30 remaining with reorderLevel 50 -> low stock
    expect(data.inventorySummary.lowStockItemsCount).toBe(1);
    expect(data.inventorySummary.flaggedItems).toHaveLength(1);
    expect(data.inventorySummary.flaggedItems[0]).toMatchObject({ name: '5ml Syringe', status: 'LOW_STOCK' });
    expect(data.attentionAlerts.some((a) => a.id === 'alert_low_stock')).toBe(true);

    // Doctors on duty: real roster with current shift + this period's booked appointments
    expect(data.doctorsOnDuty).toHaveLength(1);
    expect(data.doctorsOnDuty[0]).toMatchObject({
      name: 'Dr. Ayesha Khan',
      department: 'General Medicine',
      designation: 'Consultant Physician',
      patientsBooked: 3,
      status: 'On Duty',
    });

    // Recent activity from audit log
    expect(data.recentActivity.length).toBe(1);
    expect(data.recentActivity[0].action).toBe('CREATE');
    expect(data.recentActivity[0].user).toBe('Super Admin');
  });
});
