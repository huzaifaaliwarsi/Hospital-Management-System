import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
vi.mock('@/db/client', () => ({ prisma: {} }));
import { createStaffBodySchema } from '@/modules/identity/staff.schemas';
import { commissionService } from '@/modules/commission/commission.service';
import { commissionBalance } from '@/modules/commission/commission.calc';

const d = (n: number) => new Decimal(n);
const line = { id: 'line-1', serviceRateId: 'service-uuid-1', quantity: d(1), lineGross: d(5000), discountAmount: d(500), lineNet: d(4500) };
const now = new Date('2026-10-20T10:00:00Z');

describe('RMO staff Monthly + Commission and Daily + Commission', () => {
  it('validates RMO creation with Monthly + Commission and assigned service', () => {
    const validRmo = {
      fullName: 'Dr. RMO Hamza',
      fatherGuardianName: 'Ali',
      cnic: '35201-1234567-1',
      dateOfBirth: '1995-05-15',
      phone: '0300-1234567',
      category: 'RMO' as const,
      departmentIds: ['11111111-1111-1111-1111-111111111111'],
      serviceIds: ['22222222-2222-2222-2222-222222222222'],
      salaryProfile: {
        salaryBasis: 'MONTHLY_COMMISSION' as const,
        baseAmount: 80000,
        effectiveFrom: '2026-10-01',
      },
      commission: {
        rules: [
          {
            serviceRateId: '22222222-2222-2222-2222-222222222222',
            ruleType: 'PERCENTAGE' as const,
            rate: 20,
            basis: 'NET' as const,
          },
        ],
        effectiveFrom: '2026-10-01',
      },
    };

    const parsed = createStaffBodySchema.safeParse(validRmo);
    expect(parsed.success).toBe(true);
  });

  it('validates RMO creation with Daily + Commission and assigned service', () => {
    const validRmo = {
      fullName: 'Dr. RMO Usman',
      fatherGuardianName: 'Tariq',
      cnic: '35201-7654321-1',
      dateOfBirth: '1996-08-20',
      phone: '0321-9876543',
      category: 'RMO' as const,
      departmentIds: ['11111111-1111-1111-1111-111111111111'],
      serviceIds: ['22222222-2222-2222-2222-222222222222'],
      salaryProfile: {
        salaryBasis: 'PER_DAY_COMMISSION' as const,
        baseAmount: 3500,
        effectiveFrom: '2026-10-01',
      },
      commission: {
        rules: [
          {
            serviceRateId: '22222222-2222-2222-2222-222222222222',
            ruleType: 'FIXED_PER_SERVICE' as const,
            rate: 500,
            basis: 'NET' as const,
          },
        ],
        effectiveFrom: '2026-10-01',
      },
    };

    const parsed = createStaffBodySchema.safeParse(validRmo);
    expect(parsed.success).toBe(true);
  });

  it('rejects RMO with commission if no assigned services provided', () => {
    const invalidRmo = {
      fullName: 'Dr. RMO Test',
      fatherGuardianName: 'Test',
      cnic: '35201-1111111-1',
      dateOfBirth: '1996-08-20',
      phone: '0321-9876543',
      category: 'RMO' as const,
      departmentIds: ['11111111-1111-1111-1111-111111111111'],
      serviceIds: [],
      salaryProfile: {
        salaryBasis: 'MONTHLY_COMMISSION' as const,
        baseAmount: 60000,
        effectiveFrom: '2026-10-01',
      },
      commission: {
        rules: [],
        effectiveFrom: '2026-10-01',
      },
    };

    const parsed = createStaffBodySchema.safeParse(invalidRmo);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.some(i => i.message.includes('Assigned Service'))).toBe(true);
  });

  it('calculates and accrues commission for an RMO on MONTHLY_COMMISSION', async () => {
    const tx = {
      $queryRaw: vi.fn(),
      invoiceLineItem: {
        findUnique: vi.fn().mockResolvedValue({
          ...line,
          isCompleted: true,
          performedByStaffId: 'rmo-staff-id',
          createdAt: now,
          hospitalInvoice: { status: 'UNPAID', createdById: 'admin-id' },
        }),
      },
      staffService: { findFirst: vi.fn().mockResolvedValue({ id: 'assignment-1' }) },
      staffSalaryProfile: { findFirst: vi.fn().mockResolvedValue({ salaryBasis: 'MONTHLY_COMMISSION' }) },
      doctorCommissionRule: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'rmo-rule-1',
          ruleType: 'PERCENTAGE',
          rate: d(20),
          basis: 'NET',
          commissionTaxMethod: 'PERCENTAGE',
          commissionTaxValue: d(5),
        }),
      },
      doctorCommissionAccrual: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => data),
      },
      commissionReversal: { create: vi.fn().mockImplementation(({ data }) => data) },
    };

    const accrual = await commissionService.calculateAndAccrueCommission(tx as any, line, 'rmo-staff-id', 'admin-id');
    expect(accrual).not.toBeNull();
    // 20% of 4,500 net = 900
    expect(accrual!.commissionAmount.toNumber()).toBe(900);
    // 5% tax of 900 = 45
    expect(accrual!.ruleSnapshot.commissionTaxAmount).toBe(45);
    const balance = commissionBalance({ ...accrual!, payouts: [], reversals: [] });
    expect(balance.payable.toNumber()).toBe(855);
  });
});
