import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
vi.mock('@/db/client', () => ({ prisma: {} }));
import { commissionService } from '@/modules/commission/commission.service';
import { commissionBalance } from '@/modules/commission/commission.calc';
import { computeSalaryAmounts, workingDaySet } from '@/modules/payroll/payroll.calc';
import { createCommissionRuleSchema, commissionRunFiltersSchema, financialAdjustmentSchema } from '@/modules/commission/commission.schemas';

const d = (n: number) => new Decimal(n);
const line = { id: 'line', serviceRateId: 'service', quantity: d(1), lineGross: d(10000), discountAmount: d(1000), lineNet: d(9000) };
const now = new Date('2026-09-15T10:00:00Z');
let tx: any;
beforeEach(() => {
  tx = {
    $queryRaw: vi.fn(),
    invoiceLineItem: { findUnique: vi.fn().mockResolvedValue({ ...line, isCompleted: true, performedByStaffId: 'doctor', createdAt: now, hospitalInvoice: { status: 'UNPAID', createdById: 'actor' } }) },
    staffService: { findFirst: vi.fn().mockResolvedValue({ id: 'assignment' }) },
    staffSalaryProfile: { findFirst: vi.fn().mockResolvedValue({ salaryBasis: 'MONTHLY_COMMISSION' }) },
    doctorCommissionRule: { findFirst: vi.fn().mockResolvedValue({ id: 'rule', ruleType: 'PERCENTAGE', rate: d(15), basis: 'NET', commissionTaxMethod: 'PERCENTAGE', commissionTaxValue: d(10) }) },
    doctorCommissionAccrual: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => data) },
    commissionReversal: { create: vi.fn().mockImplementation(({ data }) => data) },
  };
});

describe('blueprint service commission eligibility and examples', () => {
  it.each(['MONTHLY_COMMISSION', 'PER_DAY_COMMISSION'])('%s earns 15%% of 9,000 net, independently of salary tax', async basis => {
    tx.staffSalaryProfile.findFirst.mockResolvedValue({ salaryBasis: basis });
    const row = await commissionService.calculateAndAccrueCommission(tx, line, 'doctor', 'posting-actor');
    expect(row.commissionAmount.toNumber()).toBe(1350);
    expect(row.ruleSnapshot).toMatchObject({ commissionTaxAmount: 135, postedById: 'posting-actor', hospitalRemainingShare: 7650 });
    expect(tx.doctorCommissionRule.findFirst.mock.calls[0][0].where.effectiveFrom.lte).toEqual(now);
    const b = commissionBalance({ ...row, payouts: [], reversals: [] });
    expect(b.payable.toNumber()).toBe(1215);
  });
  it.each(['MONTHLY', 'PER_DAY', null])('%s cannot earn service commission', async basis => {
    tx.staffSalaryProfile.findFirst.mockResolvedValue(basis ? { salaryBasis: basis } : null);
    expect(await commissionService.calculateAndAccrueCommission(tx, line, 'doctor')).toBeNull();
    expect(tx.doctorCommissionAccrual.create).not.toHaveBeenCalled();
  });
  it.each(['uncompleted', 'void', 'unassigned', 'wrong-doctor', 'no-rule'])('excludes %s services', async scenario => {
    if (scenario === 'unassigned') tx.staffService.findFirst.mockResolvedValue(null);
    else if (scenario === 'no-rule') tx.doctorCommissionRule.findFirst.mockResolvedValue(null);
    else tx.invoiceLineItem.findUnique.mockResolvedValue({ ...line, createdAt: now, isCompleted: scenario !== 'uncompleted', performedByStaffId: scenario === 'wrong-doctor' ? 'other' : 'doctor', hospitalInvoice: { status: scenario === 'void' ? 'VOID' : 'UNPAID' } });
    expect(await commissionService.calculateAndAccrueCommission(tx, line, 'doctor')).toBeNull();
  });
  it('fixed completed quantity: 12 × 500 = 6,000, with independent fixed commission tax', async () => {
    tx.doctorCommissionRule.findFirst.mockResolvedValue({ id: 'rule', ruleType: 'FIXED_PER_SERVICE', rate: d(500), basis: 'NET', commissionTaxMethod: 'FIXED', commissionTaxValue: d(100) });
    const row = await commissionService.calculateAndAccrueCommission(tx, { ...line, quantity: d(12) }, 'doctor');
    expect(row.commissionAmount.toNumber()).toBe(6000);
    expect(row.ruleSnapshot.commissionTaxAmount).toBe(100);
  });
  it('is idempotent for an already accrued invoice line', async () => {
    tx.doctorCommissionAccrual.findUnique.mockResolvedValue({ id: 'existing' });
    expect(await commissionService.calculateAndAccrueCommission(tx, line, 'doctor')).toEqual({ id: 'existing' });
    expect(tx.doctorCommissionAccrual.create).not.toHaveBeenCalled();
  });
  it('uses an assigned-service default only if no service-specific rule matches', async () => {
    tx.doctorCommissionRule.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'default', ruleType: 'FIXED_PER_SERVICE', rate: d(500), basis: 'NET' });
    expect((await commissionService.calculateAndAccrueCommission(tx, line, 'doctor')).commissionAmount.toNumber()).toBe(500);
    expect(tx.doctorCommissionRule.findFirst.mock.calls[1][0].where.serviceRateId).toBeNull();
  });
});

describe('commission reversals and immutable corrections', () => {
  it('reverses only the refunded proportion and caps repeated refunds', async () => {
    const accrual = { id: 'accrual', commissionAmount: d(1350), reversals: [] as any[] };
    tx.doctorCommissionAccrual.findUnique.mockResolvedValue(accrual);
    const partial = await commissionService.reverseCommissionAccrual(tx, 'line', 'partial refund', 'actor', d(.1));
    expect(partial.reversalAmount.toNumber()).toBe(135);
    accrual.reversals.push({ reversalAmount: d(1300), source: 'REFUND' });
    expect((await commissionService.reverseCommissionAccrual(tx, 'line', 'refund', 'actor')).reversalAmount.toNumber()).toBe(50);
  });
  it('exposes recoverable overpayment without rewriting a paid statement', () => {
    const b = commissionBalance({ commissionAmount: d(1350), ruleSnapshot: { commissionTaxAmount: 135, commissionTaxMethod: 'PERCENTAGE', commissionTaxValue: 10 },
      reversals: [{ reversalAmount: d(135) }], payouts: [{ amount: d(1215) }], adjustments: [{ amount: d(85) }] });
    expect(b.payable.toNumber()).toBe(1178.5);
    expect(b.tax.toNumber()).toBe(121.5);
    expect(b.remaining.toNumber()).toBe(0);
    expect(b.overpaid.toNumber()).toBe(36.5);
  });
  it('tracks a changed service discount and fully reverses the adjusted service on refund', async () => {
    const row = { id: 'accrual', commissionAmount: d(1350), ruleSnapshot: { ruleType: 'PERCENTAGE', basis: 'NET', rate: 15, commissionTaxMethod: 'PERCENTAGE', commissionTaxValue: 10, commissionTaxAmount: 135 }, reversals: [] as any[], payouts: [] };
    tx.doctorCommissionAccrual.findUnique.mockResolvedValue(row);
    await commissionService.repriceCommission(tx, 'line', d(9000), d(10000), 'actor', 'Discount removed');
    row.reversals.push(tx.commissionReversal.create.mock.calls[0][0].data);
    expect(commissionBalance(row).payable.toNumber()).toBe(1350);
    const reversal = await commissionService.reverseCommissionAccrual(tx, 'line', 'full refund', 'actor');
    expect(reversal.reversalAmount.toNumber()).toBe(1500);
    row.reversals.push(reversal);
    expect(commissionBalance(row).payable.toNumber()).toBe(0);
  });
});

describe('blueprint salary examples keep service commission separate', () => {
  const baseProfile = { salaryBasis: 'MONTHLY_COMMISSION', baseAmount: d(60000), fixedAllowance: d(2000), fixedDeduction: d(1000), salaryTaxMethod: 'PERCENTAGE', salaryTaxValue: d(5) };
  it('monthly + commission: 27.5 of 30 scheduled days gives 53,150 net salary', () => {
    const statuses = [...Array(26).fill('PRESENT'), 'HALF_DAY', 'PAID_LEAVE', 'ABSENT', 'ABSENT'];
    const records = statuses.map((status, i) => ({ status, attendanceDate: new Date(Date.UTC(2026, 8, i + 1)) }));
    const r = computeSalaryAmounts(baseProfile, workingDaySet([], []), new Date('2026-09-01'), new Date('2026-09-30'), records)!;
    expect(r.attendanceEquivalentDays).toBe(27.5); expect(r.netAmount.toNumber()).toBe(53150);
  });
  it.each(['PER_DAY', 'PER_DAY_COMMISSION'])('%s: 8.5 days × 3,000 minus 500 tax and 300 deduction = 24,700', salaryBasis => {
    const records = [...Array(8).fill('PRESENT'), 'HALF_DAY', 'ABSENT'].map((status, i) => ({ status, attendanceDate: new Date(Date.UTC(2026, 8, i + 1)) }));
    const r = computeSalaryAmounts({ ...baseProfile, salaryBasis, baseAmount: d(3000), fixedAllowance: d(0), fixedDeduction: d(300), salaryTaxMethod: 'FIXED', salaryTaxValue: d(500) }, workingDaySet([], []), new Date('2026-09-01'), new Date('2026-09-10'), records)!;
    expect(r.netAmount.toNumber()).toBe(24700);
  });
  it('monthly + commission uses the selected custom period scheduled days (§11)', () => {
    const records = [{ status: 'PRESENT', attendanceDate: new Date('2026-09-01') }];
    const r = computeSalaryAmounts({ ...baseProfile, fixedAllowance: d(0), fixedDeduction: d(0), salaryTaxMethod: null, salaryTaxValue: null }, workingDaySet([], []), new Date('2026-09-01'), new Date('2026-09-10'), records)!;
    expect(r.periodBaseAmount.toNumber()).toBe(60000); expect(r.earnedBase.toNumber()).toBe(6000);
  });
});

it('validates run dates, percentages and audited corrections', () => {
  expect(commissionRunFiltersSchema.safeParse({ periodType: 'DAILY', periodStart: '2026-09-01', periodEnd: '2026-09-02' }).success).toBe(false);
  expect(createCommissionRuleSchema.safeParse({ staffId: '00000000-0000-4000-8000-000000000001', rate: 101, ruleType: 'PERCENTAGE', effectiveFrom: '2026-09-01' }).success).toBe(false);
  expect(financialAdjustmentSchema.safeParse({ amount: 0, reason: '' }).success).toBe(false);
});
