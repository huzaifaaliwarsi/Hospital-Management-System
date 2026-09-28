import { Decimal } from '@prisma/client/runtime/library';
import { PAYABLE_EQUIVALENT } from '../attendance/attendance.service';

/**
 * Pure salary maths for payroll (PDF §11). Shared by Preview and Generate via
 * payroll.service `computeEligibility`, so both always produce identical figures.
 */

/** Plain MONTHLY absence deductions use a fixed 30-day divisor. */
export const MONTHLY_SALARY_DIVISOR = 30;

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_MS = 86_400_000;

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());


/**
 * A staff member's working weekdays (PDF §8): their own Weekly Timing when set
 * (OFF days excluded), otherwise their Shift's weekly-off days, otherwise every day.
 */
export function workingDaySet(schedule: { dayOfWeek: string; isWorking: boolean }[], shiftOffDays: string[]): Set<string> {
  if (schedule.length > 0) return new Set(schedule.filter((d) => d.isWorking).map((d) => d.dayOfWeek));
  const off = new Set(shiftOffDays);
  return new Set(WEEKDAY_NAMES.filter((d) => !off.has(d)));
}

/** Scheduled working days in [from, to] (UTC day timestamps, inclusive). */
function countWorkingDays(from: number, to: number, working: Set<string>): number {
  let n = 0;
  for (let t = from; t <= to; t += DAY_MS) {
    if (working.has(WEEKDAY_NAMES[new Date(t).getUTCDay()] as string)) n += 1;
  }
  return n;
}

export interface SalaryProfileLike {
  salaryBasis: string;
  baseAmount: Decimal;
  fixedAllowance: Decimal;
  fixedDeduction: Decimal;
  salaryTaxMethod: string | null;
  salaryTaxValue: Decimal | null;
}

export interface SalaryAmounts {
  scheduledPayableDays: number;
  attendanceEquivalentDays: number;
  periodBaseAmount: Decimal;
  earnedBase: Decimal;
  attendanceDeductions: Decimal;
  allowances: Decimal;
  grossAmount: Decimal;
  tax: Decimal;
  otherDeductions: Decimal;
  netAmount: Decimal;
}

/**
 * Attendance-based salary for one staff member over the period.
 *
 *   Attendance Equivalent = Present + Half×0.5 + Paid Leave
 *
 *   MONTHLY (fixed 30-day basis):
 *     per-day            = Monthly Base / 30
 *     Period Base        = configured Monthly Base, regardless of period length
 *     Attendance Deduct. = per-day × (Scheduled Days − Attendance Equivalent)   — weekly OFFs stay paid
 *     Earned Base        = Period Base − Attendance Deduction
 *   MONTHLY_COMMISSION: per-day = Monthly Base / scheduled days in the selected period; Earned = per-day × equivalent
 *   PER_DAY(_COMMISSION): Earned = Daily Rate × equivalent
 *
 *   Gross = Earned Base + Allowance;  Tax% = Gross × %;  Net = Gross − Tax − Deduction
 *
 * Scheduled Days / Attendance Equivalent are reported for attendance only; they
 * are never the divisor of a plain MONTHLY salary. Fixed allowance / deduction /
 * fixed tax retain their configured amounts for Monthly types. Daily types
 * retain their existing per-run fixed components.
 *
 * Returns null when the period has no scheduled working days.
 */
export function computeSalaryAmounts(
  profile: SalaryProfileLike,
  working: Set<string>,
  periodStart: Date,
  periodEnd: Date,
  records: { status: string; attendanceDate: Date }[],
): SalaryAmounts | null {
  const zero = new Decimal(0);
  const scheduledPayableDays = countWorkingDays(utcDay(periodStart), utcDay(periodEnd), working);
  if (scheduledPayableDays === 0) return null;

  const base = profile.baseAmount;
  const isMonthly = profile.salaryBasis.startsWith('MONTHLY');

  // Only approved attendance supplied by eligibility contributes to earnings.
  let attendanceEquivalentDays = 0;
  for (const r of records) {
    const eq = PAYABLE_EQUIVALENT[r.status] ?? 0;
    attendanceEquivalentDays += eq;

  }

  let periodBaseAmount = zero;
  let earnedBase = zero;
  let attendanceDeductions = zero;
  // Share of a monthly amount that belongs to this period (1 for a full month).
  let monthFraction = zero;
  if (profile.salaryBasis === 'MONTHLY') {
    const perDay = base.div(MONTHLY_SALARY_DIVISOR);
    monthFraction = new Decimal(1);
    periodBaseAmount = base;
    attendanceDeductions = perDay.mul(scheduledPayableDays - attendanceEquivalentDays);
    earnedBase = periodBaseAmount.minus(attendanceDeductions);
  } else {
    if (isMonthly) {
      // Blueprint §11: Monthly + Commission uses the selected period's
      // scheduled payable days. Service commission remains a separate ledger.
      periodBaseAmount = base;
      earnedBase = base.div(scheduledPayableDays).mul(attendanceEquivalentDays);
      monthFraction = new Decimal(1);
    } else {
      periodBaseAmount = base.mul(scheduledPayableDays);
      earnedBase = base.mul(attendanceEquivalentDays);
    }
    attendanceDeductions = Decimal.max(periodBaseAmount.minus(earnedBase), zero);
  }

  const scale = (amount: Decimal) => (isMonthly ? amount.mul(monthFraction) : amount);
  const allowances = scale(profile.fixedAllowance);
  const otherDeductions = scale(profile.fixedDeduction);
  const grossAmount = earnedBase.plus(allowances);

  let tax = zero;
  if (profile.salaryTaxMethod === 'PERCENTAGE' && profile.salaryTaxValue) {
    tax = grossAmount.mul(profile.salaryTaxValue).div(100);
  } else if (profile.salaryTaxMethod === 'FIXED' && profile.salaryTaxValue) {
    tax = scale(profile.salaryTaxValue);
  }
  const netAmount = Decimal.max(grossAmount.minus(tax).minus(otherDeductions), zero);

  // SalarySlip currency columns have two decimal places. Round Monthly
  // results at this shared boundary so Preview and persisted Generate agree.
  const money = (amount: Decimal) => isMonthly ? amount.toDecimalPlaces(2) : amount;
  return {
    scheduledPayableDays,
    attendanceEquivalentDays,
    periodBaseAmount: money(periodBaseAmount),
    earnedBase: money(earnedBase),
    attendanceDeductions: money(attendanceDeductions),
    allowances: money(allowances),
    grossAmount: money(grossAmount),
    tax: money(tax),
    otherDeductions: money(otherDeductions),
    netAmount: money(netAmount),
  };
}
