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

// Sunday weekly OFF — September 2026 has 26 scheduled days (Sundays 6, 13, 20, 27).
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

describe('HMS — P0 Monthly Salary Calendar-Day Divisor Acceptance Scenarios', () => {
  const p30k = profile({ baseAmount: d(30000) });

  it('Scenario 1: February 2026 (28 days), full paid month -> Expected: 30,000.00', () => {
    const r = computeSalaryAmounts(p30k, sundayOff, date('2026-02-01'), date('2026-02-28'), records('2026-02-01', '2026-02-28', sundayOff, 0))!;
    expect(r.monthlyScheduledDays).toBe(28);
    expect(r.dailyRate.toNumber()).toBe(1071.43);
    expect(r.attendanceDeductions.toNumber()).toBe(0);
    expect(r.earnedBase.toNumber()).toBe(30000);
    expect(r.netAmount.toNumber()).toBe(30000);
  });

  it('Scenario 2: February 2026 (28 days), 1 unpaid absence -> Expected: 28,928.57', () => {
    const r = computeSalaryAmounts(p30k, sundayOff, date('2026-02-01'), date('2026-02-28'), records('2026-02-01', '2026-02-28', sundayOff, 1))!;
    expect(r.monthlyScheduledDays).toBe(28);
    expect(r.dailyRate.toNumber()).toBe(1071.43);
    expect(r.attendanceDeductions.toNumber()).toBe(1071.43);
    expect(r.earnedBase.toNumber()).toBe(28928.57);
    expect(r.netAmount.toNumber()).toBe(28928.57);
  });

  it('Scenario 3: February 2028 (29 days, leap year), 1 unpaid absence -> Expected: 28,965.52', () => {
    const r = computeSalaryAmounts(p30k, sundayOff, date('2028-02-01'), date('2028-02-29'), records('2028-02-01', '2028-02-29', sundayOff, 1))!;
    expect(r.monthlyScheduledDays).toBe(29);
    expect(r.dailyRate.toNumber()).toBe(1034.48);
    expect(r.attendanceDeductions.toNumber()).toBe(1034.48);
    expect(r.earnedBase.toNumber()).toBe(28965.52);
    expect(r.netAmount.toNumber()).toBe(28965.52);
  });

  it('Scenario 4: April (30 days), 1 unpaid absence -> Expected: 29,000.00', () => {
    const r = computeSalaryAmounts(p30k, sundayOff, date('2026-04-01'), date('2026-04-30'), records('2026-04-01', '2026-04-30', sundayOff, 1))!;
    expect(r.monthlyScheduledDays).toBe(30);
    expect(r.dailyRate.toNumber()).toBe(1000);
    expect(r.attendanceDeductions.toNumber()).toBe(1000);
    expect(r.earnedBase.toNumber()).toBe(29000);
    expect(r.netAmount.toNumber()).toBe(29000);
  });

  it('Scenario 5: October (31 days), 1 unpaid absence -> Expected: 29,032.26', () => {
    const r = computeSalaryAmounts(p30k, sundayOff, date('2026-10-01'), date('2026-10-31'), records('2026-10-01', '2026-10-31', sundayOff, 1))!;
    expect(r.monthlyScheduledDays).toBe(31);
    expect(r.dailyRate.toNumber()).toBe(967.74);
    expect(r.attendanceDeductions.toNumber()).toBe(967.74);
    expect(r.earnedBase.toNumber()).toBe(29032.26);
    expect(r.netAmount.toNumber()).toBe(29032.26);
  });

  it('Scenario 6: March (31 days), joined on 16th, all eligible days paid -> Expected: 15,483.87', () => {
    // March 16 to March 31 has 16 calendar days
    const r = computeSalaryAmounts(p30k, sundayOff, date('2026-03-16'), date('2026-03-31'), records('2026-03-16', '2026-03-31', sundayOff, 0))!;
    expect(r.monthlyScheduledDays).toBe(31);
    expect(r.dailyRate.toNumber()).toBe(967.74);
    expect(r.periodBaseAmount.toNumber()).toBe(15483.87);
    expect(r.attendanceDeductions.toNumber()).toBe(0);
    expect(r.earnedBase.toNumber()).toBe(15483.87);
    expect(r.netAmount.toNumber()).toBe(15483.87);
  });

  it('Paid holidays and weekly offs do not reduce monthly salary', () => {
    // October 2026 with 4 Sundays OFF + 2 PAID_LEAVE days
    const recs = records('2026-10-01', '2026-10-31', sundayOff, 0);
    recs[0]!.status = 'PAID_LEAVE';
    recs[1]!.status = 'PAID_LEAVE';
    const r = computeSalaryAmounts(p30k, sundayOff, date('2026-10-01'), date('2026-10-31'), recs)!;
    expect(r.attendanceDeductions.toNumber()).toBe(0);
    expect(r.earnedBase.toNumber()).toBe(30000);
    expect(r.netAmount.toNumber()).toBe(30000);
  });
});

describe('payroll salary — MONTHLY uses actual calendar days in selected month', () => {
  it('pays the full monthly base for full attendance in September (30 days)', () => {
    const r = run(profile(), '2026-09-01', '2026-09-30');
    expect(r.monthlyScheduledDays).toBe(30);
    expect(r.dailyRate.toNumber()).toBe(1000);
    expect(r.scheduledPayableDays).toBe(26);
    expect(r.attendanceEquivalentDays).toBe(26);
    expect(r.periodBaseAmount.toNumber()).toBe(30000);
    expect(r.attendanceDeductions.toNumber()).toBe(0);
    expect(r.earnedBase.toNumber()).toBe(30000);
    expect(r.netAmount.toNumber()).toBe(30000);
  });

  it('deducts PKR 1,000 per unpaid scheduled day in September (30-day divisor)', () => {
    const r = run(profile(), '2026-09-01', '2026-09-30', records('2026-09-01', '2026-09-30', sundayOff, 2));
    expect(r.monthlyScheduledDays).toBe(30);
    expect(r.dailyRate.toNumber()).toBe(1000);
    expect(r.scheduledPayableDays).toBe(26);
    expect(r.attendanceEquivalentDays).toBe(24);
    expect(r.attendanceDeductions.toNumber()).toBe(2000); // 2 × 1,000
    expect(r.earnedBase.toNumber()).toBe(28000); // 30,000 - 2,000
  });

  it('counts a half day as half an unpaid day (PKR 500 in 30-day month)', () => {
    const r = run(profile(), '2026-09-01', '2026-09-30', records('2026-09-01', '2026-09-30', sundayOff, 0, 1));
    expect(r.dailyRate.toNumber()).toBe(1000);
    expect(r.attendanceDeductions.toNumber()).toBe(500);
    expect(r.earnedBase.toNumber()).toBe(29500);
  });

  it('builds Gross, Tax and Net on the real earned base', () => {
    const p = profile({ fixedAllowance: d(3000), fixedDeduction: d(500), salaryTaxMethod: 'PERCENTAGE', salaryTaxValue: d(10) });
    const r = run(p, '2026-09-01', '2026-09-30', records('2026-09-01', '2026-09-30', sundayOff, 2));
    const earned = 30000 - 2000;
    expect(r.allowances.toNumber()).toBe(3000);
    expect(r.grossAmount.toNumber()).toBe(earned + 3000); // 31,000
    expect(r.tax.toNumber()).toBe((earned + 3000) * 0.1); // 3,100
    expect(r.otherDeductions.toNumber()).toBe(500);
    expect(r.netAmount.toNumber()).toBe(earned + 3000 - (earned + 3000) * 0.1 - 500); // 27,400
  });

  it('pays exactly one monthly base for a whole 31-day or 28-day month', () => {
    expect(run(profile(), '2026-10-01', '2026-10-31').earnedBase.toNumber()).toBe(30000);
    expect(run(profile(), '2026-02-01', '2026-02-28').earnedBase.toNumber()).toBe(30000);
  });

  it('prorates Period Base using actual month divisor and calendar days for a partial period', () => {
    // Sep 1-10 2026 has 10 calendar days in a 30-day month -> Period Base = 10 × (30,000/30) = 10,000.
    const r = run(profile({ fixedAllowance: d(3000) }), '2026-09-01', '2026-09-10');
    expect(r.monthlyScheduledDays).toBe(30);
    expect(r.dailyRate.toNumber()).toBe(1000);
    expect(r.scheduledPayableDays).toBe(9);
    expect(r.periodBaseAmount.toNumber()).toBe(10000);
    expect(r.earnedBase.toNumber()).toBe(10000);
    expect(r.allowances.toNumber()).toBe(3000);
  });

  it('keeps weekly OFF days paid when every scheduled day is absent, floored by the period\'s own Period Base', () => {
    const r = run(profile(), '2026-09-01', '2026-09-30', records('2026-09-01', '2026-09-30', sundayOff, 26));
    expect(r.periodBaseAmount.toNumber()).toBe(30000);
    expect(r.attendanceDeductions.toNumber()).toBe(30000);
    expect(r.earnedBase.toNumber()).toBe(0);
  });

  it('cannot go negative for a full-month period', () => {
    const everyDay = workingDaySet([], []);
    const r = computeSalaryAmounts(profile(), everyDay, date('2026-10-01'), date('2026-10-31'),
      records('2026-10-01', '2026-10-31', everyDay, 31))!;
    expect(r.scheduledPayableDays).toBe(31);
    expect(r.attendanceDeductions.toNumber()).toBe(30000);
    expect(r.earnedBase.toNumber()).toBe(0);
    expect(r.netAmount.toNumber()).toBe(0);
  });

  it('returns null when the period has no scheduled days', () => {
    expect(computeSalaryAmounts(profile(), sundayOff, date('2026-09-06'), date('2026-09-06'), [])).toBeNull();
  });
});

describe('payroll salary — exact acceptance scenario (Dr Ali / PKR 30,000 Monthly Salary in October 31-day month)', () => {
  const saturdayOff = workingDaySet([], ['Saturday']);
  const ali = profile({ salaryBasis: 'MONTHLY_COMMISSION', baseAmount: d(30000) });

  it('TEST A1 — 1-day selected period in October (1 calendar day): Daily Rate 967.74, Period Base 967.74, Deduction 0, Net Basic 967.74', () => {
    const r = computeSalaryAmounts(ali, saturdayOff, date('2026-10-05'), date('2026-10-05'), [
      { status: 'PRESENT', attendanceDate: date('2026-10-05') },
    ])!;
    expect(r.dailyRate.toNumber()).toBe(967.74);
    expect(r.periodBaseAmount.toNumber()).toBe(967.74);
    expect(r.attendanceDeductions.toNumber()).toBe(0);
    expect(r.earnedBase.toNumber()).toBe(967.74);
    expect(r.netAmount.toNumber()).toBe(967.74);
  });

  it('TEST A2 — 1-day selected period in October (1 calendar day, absent): Deduction 967.74, Net Basic 0', () => {
    const r = computeSalaryAmounts(ali, saturdayOff, date('2026-10-05'), date('2026-10-05'), [
      { status: 'ABSENT', attendanceDate: date('2026-10-05') },
    ])!;
    expect(r.dailyRate.toNumber()).toBe(967.74);
    expect(r.periodBaseAmount.toNumber()).toBe(967.74);
    expect(r.attendanceDeductions.toNumber()).toBe(967.74);
    expect(r.earnedBase.toNumber()).toBe(0);
    expect(r.netAmount.toNumber()).toBe(0);
  });

  it('TEST B — full October, 26 scheduled, 26 present: Period Base 30,000, Deduction 0, Earned 30,000', () => {
    const r = computeSalaryAmounts(ali, saturdayOff, date('2026-10-01'), date('2026-10-31'),
      records('2026-10-01', '2026-10-31', saturdayOff))!;
    expect(r.monthlyScheduledDays).toBe(31);
    expect(r.dailyRate.toNumber()).toBe(967.74);
    expect(r.scheduledPayableDays).toBe(26);
    expect(r.periodBaseAmount.toNumber()).toBe(30000);
    expect(r.attendanceDeductions.toNumber()).toBe(0);
    expect(r.earnedBase.toNumber()).toBe(30000);
  });

  it('TEST C — full October, 26 scheduled, 25 present/1 absent: Deduction 967.74, Earned 29,032.26', () => {
    const r = computeSalaryAmounts(ali, saturdayOff, date('2026-10-01'), date('2026-10-31'),
      records('2026-10-01', '2026-10-31', saturdayOff, 1))!;
    expect(r.dailyRate.toNumber()).toBe(967.74);
    expect(r.attendanceDeductions.toNumber()).toBe(967.74);
    expect(r.earnedBase.toNumber()).toBe(29032.26);
  });

  it('Verification Requirement: October 2026, 31 scheduled days, 5 present, 26 unpaid -> Attendance Ded 25,161.29, Net Payable 4,838.71', () => {
    // 31 scheduled days (no weekly off days configured)
    const everyDayWorking = workingDaySet([], []);
    const staffMember = profile({ salaryBasis: 'MONTHLY', baseAmount: d(30000) });
    // 5 PRESENT, 26 unpaid / absent days
    const attendance = [
      ...records('2026-10-01', '2026-10-05', everyDayWorking, 0),
      ...records('2026-10-06', '2026-10-31', everyDayWorking, 26),
    ];
    const r = computeSalaryAmounts(staffMember, everyDayWorking, date('2026-10-01'), date('2026-10-31'), attendance)!;

    expect(r.monthlyScheduledDays).toBe(31);
    expect(r.scheduledPayableDays).toBe(31);
    expect(r.attendanceEquivalentDays).toBe(5);
    expect(r.dailyRate.toNumber()).toBe(967.74);
    expect(r.periodBaseAmount.toNumber()).toBe(30000.00);
    expect(r.attendanceDeductions.toNumber()).toBe(25161.29);
    expect(r.earnedBase.toNumber()).toBe(4838.71);
    expect(r.netAmount.toNumber()).toBe(4838.71);
  });

  it('TEST D — a weekly OFF day (Saturday) never creates an absence deduction', () => {
    const r = computeSalaryAmounts(ali, saturdayOff, date('2026-10-02'), date('2026-10-04'), [
      { status: 'PRESENT', attendanceDate: date('2026-10-02') },
      { status: 'PRESENT', attendanceDate: date('2026-10-04') },
    ])!;
    expect(r.scheduledPayableDays).toBe(2);
    expect(r.attendanceDeductions.toNumber()).toBe(0);
  });
});

describe('payroll salary — MONTHLY across 24 / 28 / 30 / 31 scheduled days', () => {
  const everyDay = workingDaySet([], []);
  const scenarios: [string, Set<string>, string, string, number, number, number][] = [
    ['Feb 2026 (28 days, Sunday OFF)', sundayOff, '2026-02-01', '2026-02-28', 24, 28, 1071.43],
    ['Feb 2026 (28 days, no OFF)', everyDay, '2026-02-01', '2026-02-28', 28, 28, 1071.43],
    ['Feb 2028 (29 days leap, no OFF)', everyDay, '2028-02-01', '2028-02-29', 29, 29, 1034.48],
    ['Sep 2026 (30 days, no OFF)', everyDay, '2026-09-01', '2026-09-30', 30, 30, 1000.00],
    ['Oct 2026 (31 days, no OFF)', everyDay, '2026-10-01', '2026-10-31', 31, 31, 967.74],
  ];
  const full = profile({ fixedAllowance: d(3000), fixedDeduction: d(600), salaryTaxMethod: 'PERCENTAGE', salaryTaxValue: d(10) });

  for (const [label, working, from, to, scheduled, daysInMonth, expectedDailyRate] of scenarios) {
    it(`${label}: full attendance earns the full base 30,000`, () => {
      const r = computeSalaryAmounts(full, working, date(from), date(to), records(from, to, working))!;
      expect(r.monthlyScheduledDays).toBe(daysInMonth);
      expect(r.scheduledPayableDays).toBe(scheduled);
      expect(r.attendanceEquivalentDays).toBe(scheduled);
      expect(r.dailyRate.toNumber()).toBe(expectedDailyRate);
      expect(r.periodBaseAmount.toNumber()).toBe(30000);
      expect(r.attendanceDeductions.toNumber()).toBe(0);
      expect(r.earnedBase.toNumber()).toBe(30000);
      expect(r.allowances.toNumber()).toBe(3000);
      expect(r.grossAmount.toNumber()).toBe(33000);
      expect(r.tax.toNumber()).toBe(3300);
      expect(r.otherDeductions.toNumber()).toBe(600);
      expect(r.netAmount.toNumber()).toBe(29100);
    });

    it(`${label}: 2 absent days deduct 2 × DailyRate using actual calendar days`, () => {
      const r = computeSalaryAmounts(full, working, date(from), date(to), records(from, to, working, 2))!;
      const expectedDed = new Decimal(30000).div(daysInMonth).mul(2).toDecimalPlaces(2).toNumber();
      const expectedEarned = new Decimal(30000).minus(new Decimal(30000).div(daysInMonth).mul(2)).toDecimalPlaces(2).toNumber();
      expect(r.monthlyScheduledDays).toBe(daysInMonth);
      expect(r.dailyRate.toNumber()).toBe(expectedDailyRate);
      expect(r.scheduledPayableDays).toBe(scheduled);
      expect(r.attendanceEquivalentDays).toBe(scheduled - 2);
      expect(r.attendanceDeductions.toNumber()).toBe(expectedDed);
      expect(r.earnedBase.toNumber()).toBe(expectedEarned);
    });
  }
});

describe('payroll salary — MONTHLY_COMMISSION uses the exact same actual calendar days as MONTHLY', () => {
  it('divides by actual month days (30,000 / 30 = 1,000 per day in September)', () => {
    const r = run(
      profile({ salaryBasis: 'MONTHLY_COMMISSION', baseAmount: d(30000) }),
      '2026-09-01', '2026-09-30',
      records('2026-09-01', '2026-09-30', sundayOff, 25),
    );
    expect(r.monthlyScheduledDays).toBe(30);
    expect(r.dailyRate.toNumber()).toBe(1000);
    expect(r.scheduledPayableDays).toBe(26);
    expect(r.attendanceEquivalentDays).toBe(1);
    expect(r.periodBaseAmount.toNumber()).toBe(30000);
    expect(r.attendanceDeductions.toNumber()).toBe(25000); // 25 × 1,000
    expect(r.earnedBase.toNumber()).toBe(5000); // 30,000 - 25,000
  });

  it('produces identical earnedBase/attendanceDeductions to plain MONTHLY for the same inputs', () => {
    const recs = records('2026-09-01', '2026-09-30', sundayOff, 2);
    const monthly = run(profile({ salaryBasis: 'MONTHLY', baseAmount: d(30000) }), '2026-09-01', '2026-09-30', recs);
    const monthlyCommission = run(profile({ salaryBasis: 'MONTHLY_COMMISSION', baseAmount: d(30000) }), '2026-09-01', '2026-09-30', recs);
    expect(monthlyCommission.earnedBase.toNumber()).toBe(monthly.earnedBase.toNumber());
    expect(monthlyCommission.attendanceDeductions.toNumber()).toBe(monthly.attendanceDeductions.toNumber());
    expect(monthlyCommission.periodBaseAmount.toNumber()).toBe(monthly.periodBaseAmount.toNumber());
  });

  it('full attendance still pays the full monthly base, whatever the scheduled day count', () => {
    const r = run(profile({ salaryBasis: 'MONTHLY_COMMISSION', baseAmount: d(30000) }), '2026-09-01', '2026-09-30');
    expect(r.attendanceDeductions.toNumber()).toBe(0);
    expect(r.earnedBase.toNumber()).toBe(30000);
    expect(r.netAmount.toNumber()).toBe(30000);
  });
});

describe('payroll salary — other bases are unchanged', () => {
  it('PER_DAY pays the daily rate × attendance equivalent', () => {
    const r = run(profile({ salaryBasis: 'PER_DAY', baseAmount: d(1000), fixedAllowance: d(500) }), '2026-09-01', '2026-09-30',
      records('2026-09-01', '2026-09-30', sundayOff, 2));
    expect(r.periodBaseAmount.toNumber()).toBe(26000);
    expect(r.earnedBase.toNumber()).toBe(24000);
    expect(r.allowances.toNumber()).toBe(500);
  });
});

describe('payroll salary — Late-In / Early-Out cutting (deductionRules, staff.md §11)', () => {
  it('cuts nothing when no deductionRules are configured on the profile', () => {
    const r = run(profile(), '2026-09-01', '2026-09-30');
    expect(r.lateMinutes).toBe(0);
    expect(r.earlyExitMinutes).toBe(0);
    expect(r.lateDeduction.toNumber()).toBe(0);
    expect(r.earlyExitDeduction.toNumber()).toBe(0);
    expect(r.netAmount.toNumber()).toBe(30000);
  });

  it('cuts PKR per late minute — dynamically from the staff profile, never a hardcoded rate', () => {
    const recs = records('2026-09-01', '2026-09-30', sundayOff).map((r, i) => (i < 3 ? { ...r, lateMinutes: 10 } : r));
    const p = profile({ deductionRules: { late: { mode: 'PER_MINUTE', amount: 20 } } });
    const r = run(p, '2026-09-01', '2026-09-30', recs);
    expect(r.lateMinutes).toBe(30);
    expect(r.lateDeduction.toNumber()).toBe(600); // 30 min × PKR 20
    expect(r.netAmount.toNumber()).toBe(30000 - 600);
  });

  it('cuts a flat amount per late occurrence when the mode is FIXED_PER_OCCURRENCE, not per minute', () => {
    const recs = records('2026-09-01', '2026-09-30', sundayOff).map((r, i) => (i < 3 ? { ...r, lateMinutes: 45 } : r));
    const p = profile({ deductionRules: { late: { mode: 'FIXED_PER_OCCURRENCE', amount: 100 } } });
    const r = run(p, '2026-09-01', '2026-09-30', recs);
    expect(r.lateDeduction.toNumber()).toBe(300); // 3 late days × PKR 100
  });

  it('cuts Early-Out independently of Late-In, using its own configured rate', () => {
    const recs = records('2026-09-01', '2026-09-30', sundayOff).map((r, i) => (i < 2 ? { ...r, earlyExitMinutes: 15 } : r));
    const p = profile({ deductionRules: { early_exit: { mode: 'PER_MINUTE', amount: 10 } } });
    const r = run(p, '2026-09-01', '2026-09-30', recs);
    expect(r.earlyExitMinutes).toBe(30);
    expect(r.earlyExitDeduction.toNumber()).toBe(300);
    expect(r.lateDeduction.toNumber()).toBe(0);
  });

  it('ignores a malformed/unknown deductionRules shape instead of throwing', () => {
    const p = profile({ deductionRules: { late: { mode: 'SOMETHING_ELSE', amount: 999 } } });
    const r = run(p, '2026-09-01', '2026-09-30');
    expect(r.lateDeduction.toNumber()).toBe(0);
  });
});
