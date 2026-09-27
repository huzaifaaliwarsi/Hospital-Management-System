import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { computeSalaryAmounts, workingDaySet, SalaryProfileLike } from '@/modules/payroll/payroll.calc';

const d = (n: number) => new Decimal(n);
const date = (s: string) => new Date(`${s}T00:00:00Z`);
const profile = (patch: Partial<SalaryProfileLike> = {}): SalaryProfileLike => ({
  salaryBasis: 'MONTHLY',
  baseAmount: d(30000),
  fixedAllowance: d(0),
  fixedDeduction: d(0),
  salaryTaxMethod: null,
  salaryTaxValue: null,
  ...patch,
});

// Sunday weekly OFF → September 2026 has 26 scheduled days (Sundays 6, 13, 20, 27).
const sundayOff = workingDaySet([], ['Sunday']);

/** One record per scheduled day in [from, to]; the first `absent` scheduled days are ABSENT, the next `half` HALF_DAY. */
function records(from: string, to: string, working: Set<string>, absent = 0, half = 0) {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const out: { status: string; attendanceDate: Date }[] = [];
  for (let t = date(from).getTime(); t <= date(to).getTime(); t += 86_400_000) {
    const day = new Date(t);
    if (!working.has(names[day.getUTCDay()] as string)) continue;
    const status = out.length < absent ? 'ABSENT' : out.length < absent + half ? 'HALF_DAY' : 'PRESENT';
    out.push({ status, attendanceDate: day });
  }
  return out;
}

const run = (p: SalaryProfileLike, from: string, to: string, recs = records(from, to, sundayOff)) =>
  computeSalaryAmounts(p, sundayOff, date(from), date(to), recs)!;

describe('payroll salary — MONTHLY uses a fixed 30-day divisor', () => {
  it('pays the full monthly base for full attendance, whatever the scheduled day count', () => {
    const r = run(profile(), '2026-09-01', '2026-09-30');
    expect(r.scheduledPayableDays).toBe(26);
    expect(r.attendanceEquivalentDays).toBe(26);
    expect(r.periodBaseAmount.toNumber()).toBe(30000);
    expect(r.attendanceDeductions.toNumber()).toBe(0);
    expect(r.earnedBase.toNumber()).toBe(30000);
    expect(r.netAmount.toNumber()).toBe(30000);
  });

  it('deducts Base/30 per unpaid scheduled day — not Base/26', () => {
    const r = run(profile(), '2026-09-01', '2026-09-30', records('2026-09-01', '2026-09-30', sundayOff, 2));
    expect(r.scheduledPayableDays).toBe(26);
    expect(r.attendanceEquivalentDays).toBe(24);
    expect(r.attendanceDeductions.toNumber()).toBe(2000); // 2 × 30000/30
    expect(r.earnedBase.toNumber()).toBe(28000);
  });

  it('counts a half day as half an unpaid day', () => {
    const r = run(profile(), '2026-09-01', '2026-09-30', records('2026-09-01', '2026-09-30', sundayOff, 0, 1));
    expect(r.attendanceDeductions.toNumber()).toBe(500);
    expect(r.earnedBase.toNumber()).toBe(29500);
  });

  it('builds Gross, Tax and Net on the 30-day earned base', () => {
    const p = profile({ fixedAllowance: d(3000), fixedDeduction: d(500), salaryTaxMethod: 'PERCENTAGE', salaryTaxValue: d(10) });
    const r = run(p, '2026-09-01', '2026-09-30', records('2026-09-01', '2026-09-30', sundayOff, 2));
    expect(r.allowances.toNumber()).toBe(3000);
    expect(r.grossAmount.toNumber()).toBe(31000);
    expect(r.tax.toNumber()).toBe(3100);
    expect(r.otherDeductions.toNumber()).toBe(500);
    expect(r.netAmount.toNumber()).toBe(27400);
  });

  it('pays exactly one monthly base for a whole 31-day or 28-day month', () => {
    expect(run(profile(), '2026-10-01', '2026-10-31').earnedBase.toNumber()).toBe(30000);
    expect(run(profile(), '2026-02-01', '2026-02-28').earnedBase.toNumber()).toBe(30000);
  });

  it('keeps the full monthly base and allowance for a partial period', () => {
    const r = run(profile({ fixedAllowance: d(3000) }), '2026-09-01', '2026-09-10');
    expect(r.scheduledPayableDays).toBe(9);
    expect(r.periodBaseAmount.toNumber()).toBe(30000);
    expect(r.earnedBase.toNumber()).toBe(30000);
    expect(r.allowances.toNumber()).toBe(3000);
  });

  it('keeps weekly OFF days paid when every scheduled day is absent', () => {
    const r = run(profile(), '2026-09-01', '2026-09-30', records('2026-09-01', '2026-09-30', sundayOff, 26));
    expect(r.attendanceDeductions.toNumber()).toBe(26000);
    expect(r.earnedBase.toNumber()).toBe(4000); // 4 Sundays × 30000/30
  });

  it('applies the exact unpaid-days formula even for 31 absent days, with net floored at zero', () => {
    const everyDay = workingDaySet([], []);
    const r = computeSalaryAmounts(profile(), everyDay, date('2026-10-01'), date('2026-10-31'),
      records('2026-10-01', '2026-10-31', everyDay, 31))!;
    expect(r.scheduledPayableDays).toBe(31);
    expect(r.attendanceDeductions.toNumber()).toBe(31000);
    expect(r.earnedBase.toNumber()).toBe(-1000);
    expect(r.netAmount.toNumber()).toBe(0);
  });

  it('returns null when the period has no scheduled days', () => {
    expect(computeSalaryAmounts(profile(), sundayOff, date('2026-09-06'), date('2026-09-06'), [])).toBeNull();
  });
});

describe('payroll salary — MONTHLY across 24 / 28 / 30 / 31 scheduled days', () => {
  const everyDay = workingDaySet([], []);
  // [label, schedule, whole-month period, expected scheduled days]
  const scenarios: [string, Set<string>, string, string, number][] = [
    ['24 scheduled (Feb, Sunday OFF)', sundayOff, '2026-02-01', '2026-02-28', 24],
    ['28 scheduled (Feb, no OFF)', everyDay, '2026-02-01', '2026-02-28', 28],
    ['29 scheduled (leap February, no OFF)', everyDay, '2028-02-01', '2028-02-29', 29],
    ['30 scheduled (Sep, no OFF)', everyDay, '2026-09-01', '2026-09-30', 30],
    ['31 scheduled (Oct, no OFF)', everyDay, '2026-10-01', '2026-10-31', 31],
  ];
  const full = profile({ fixedAllowance: d(3000), fixedDeduction: d(600), salaryTaxMethod: 'PERCENTAGE', salaryTaxValue: d(10) });

  for (const [label, working, from, to, scheduled] of scenarios) {
    it(`${label}: full attendance earns the full base`, () => {
      const r = computeSalaryAmounts(full, working, date(from), date(to), records(from, to, working))!;
      expect(r.scheduledPayableDays).toBe(scheduled);
      expect(r.attendanceEquivalentDays).toBe(scheduled);
      expect(r.periodBaseAmount.toNumber()).toBe(30000);
      expect(r.attendanceDeductions.toNumber()).toBe(0);
      expect(r.earnedBase.toNumber()).toBe(30000);
      expect(r.allowances.toNumber()).toBe(3000);
      expect(r.grossAmount.toNumber()).toBe(33000);
      expect(r.tax.toNumber()).toBe(3300);
      expect(r.otherDeductions.toNumber()).toBe(600);
      expect(r.netAmount.toNumber()).toBe(29100);
    });

    it(`${label}: 2 absent days deduct 2 × Base/30, never Base/${scheduled}`, () => {
      const r = computeSalaryAmounts(full, working, date(from), date(to), records(from, to, working, 2))!;
      expect(r.scheduledPayableDays).toBe(scheduled);
      expect(r.attendanceEquivalentDays).toBe(scheduled - 2);
      expect(r.attendanceDeductions.toNumber()).toBe(2000);
      expect(r.earnedBase.toNumber()).toBe(28000);
      expect(r.grossAmount.toNumber()).toBe(31000);
      expect(r.tax.toNumber()).toBe(3100);
      expect(r.netAmount.toNumber()).toBe(27300);
    });
  }
});

describe('payroll salary — other bases are unchanged', () => {
  it('MONTHLY_COMMISSION still divides by the month’s scheduled days', () => {
    const r = run(profile({ salaryBasis: 'MONTHLY_COMMISSION', baseAmount: d(26000) }), '2026-09-01', '2026-09-30',
      records('2026-09-01', '2026-09-30', sundayOff, 2));
    expect(r.earnedBase.toNumber()).toBe(24000); // 26000/26 × 24
    expect(r.attendanceDeductions.toNumber()).toBe(2000);
  });

  it('PER_DAY pays the daily rate × attendance equivalent', () => {
    const r = run(profile({ salaryBasis: 'PER_DAY', baseAmount: d(1000), fixedAllowance: d(500) }), '2026-09-01', '2026-09-30',
      records('2026-09-01', '2026-09-30', sundayOff, 2));
    expect(r.periodBaseAmount.toNumber()).toBe(26000);
    expect(r.earnedBase.toNumber()).toBe(24000);
    expect(r.allowances.toNumber()).toBe(500);
  });
});
