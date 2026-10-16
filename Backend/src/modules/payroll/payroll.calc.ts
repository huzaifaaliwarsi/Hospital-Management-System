import { Decimal } from '@prisma/client/runtime/library';
import { PAYABLE_EQUIVALENT } from '../attendance/attendance.service';

/**
 * Pure salary maths for payroll (PDF §11). Shared by Preview and Generate via
 * payroll.service `computeEligibility`, so both always produce identical figures.
 */

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
  // Staff-level Late-In / Early-Out cutting policy (StaffSalaryProfile.deductionRules,
  // shape {late:{mode,amount}, early_exit:{mode,amount}}) — read as-configured, never hardcoded.
  deductionRules?: unknown;
}

export interface SalaryAmounts {
  monthlyScheduledDays: number;
  dailyRate: Decimal;
  scheduledPayableDays: number;
  attendanceEquivalentDays: number;
  periodBaseAmount: Decimal;
  earnedBase: Decimal;
  attendanceDeductions: Decimal;
  allowances: Decimal;
  grossAmount: Decimal;
  tax: Decimal;
  otherDeductions: Decimal;
  lateDeduction: Decimal;
  earlyExitDeduction: Decimal;
  lateMinutes: number;
  earlyExitMinutes: number;
  netAmount: Decimal;
}

interface DeductionRule {
  mode: 'NONE' | 'PER_MINUTE' | 'FIXED_PER_OCCURRENCE';
  amount: Decimal;
}

const NO_DEDUCTION: DeductionRule = { mode: 'NONE', amount: new Decimal(0) };

function readDeductionRule(rules: unknown, key: 'late' | 'early_exit'): DeductionRule {
  if (!rules || typeof rules !== 'object') return NO_DEDUCTION;
  const rule = (rules as Record<string, unknown>)[key];
  if (!rule || typeof rule !== 'object') return NO_DEDUCTION;
  const mode = (rule as Record<string, unknown>).mode;
  const amount = (rule as Record<string, unknown>).amount;
  if (mode !== 'PER_MINUTE' && mode !== 'FIXED_PER_OCCURRENCE') return NO_DEDUCTION;
  return { mode, amount: new Decimal((amount as number | string | undefined) ?? 0) };
}

/** Late-In / Early-Out cut for the period — minutes-based or a flat amount per late/early day, as the staff member's own profile configures (never a fixed hardcoded rate). */
function computeTimingDeduction(rule: DeductionRule, totalMinutes: number, occurrences: number): Decimal {
  if (rule.mode === 'PER_MINUTE') return rule.amount.mul(totalMinutes);
  if (rule.mode === 'FIXED_PER_OCCURRENCE') return rule.amount.mul(occurrences);
  return new Decimal(0);
}

/**
 * Detects if [start, end] covers a complete calendar month (e.g. 1st to last day of month,
 * or 1st to 30th for 30/31-day months).
 */
export function isFullCalendarMonth(start: Date, end: Date): boolean {
  const s = new Date(start);
  const e = new Date(end);
  const sYear = s.getUTCFullYear();
  const sMonth = s.getUTCMonth();
  const sDate = s.getUTCDate();
  const eYear = e.getUTCFullYear();
  const eMonth = e.getUTCMonth();
  const eDate = e.getUTCDate();
  if (sYear !== eYear || sMonth !== eMonth || sDate !== 1) return false;
  const lastDayOfMonth = new Date(Date.UTC(sYear, sMonth + 1, 0)).getUTCDate();
  return eDate === lastDayOfMonth || (lastDayOfMonth === 31 && eDate === 30);
}

/**
 * Attendance-based salary for one staff member over the period.
 *
 *   Attendance Equivalent = Present + Half×0.5 + Paid Leave
 *
 *   MONTHLY and MONTHLY_COMMISSION (Doctor commission is always a fully separate ledger):
 *     Daily Rate          = Monthly Base / 30 (always fixed 30-day divisor)
 *     Schedule decides whether employee was supposed to work (scheduled working days)
 *     Weekly Off / unscheduled days do NOT become absence deductions
 *     Full monthly payroll:
 *       If attendance rules satisfied, reconciles to full Monthly Base (PKR 30,000)
 *       Period Base = Monthly Base
 *       Attendance Deduction = Daily Rate × Unpaid Scheduled Days
 *       Earned Base = Period Base − Attendance Deduction
 *     Partial period (e.g. 1 day):
 *       Period Base = Daily Rate × Scheduled Payable Days
 *       Attendance Deduction = Daily Rate × Unpaid Scheduled Days
 *       Earned Base = Period Base − Attendance Deduction
 *   PER_DAY(_COMMISSION): Earned = Daily Rate × equivalent
 *
 *   Gross = Earned Base + Allowance;  Tax% = Gross × %;  Net = Gross − Tax − Deduction
 *
 * Returns null when the period has no scheduled working days.
 */
export function computeSalaryAmounts(
  profile: SalaryProfileLike,
  working: Set<string>,
  periodStart: Date,
  periodEnd: Date,
  records: { status: string; attendanceDate: Date; lateMinutes?: number; earlyExitMinutes?: number }[],
): SalaryAmounts | null {
  const zero = new Decimal(0);
  const scheduledPayableDays = countWorkingDays(utcDay(periodStart), utcDay(periodEnd), working);
  if (scheduledPayableDays === 0) return null;

  const base = profile.baseAmount;
  const isMonthly = profile.salaryBasis.startsWith('MONTHLY');

  // Only approved attendance supplied by eligibility contributes to earnings.
  let attendanceEquivalentDays = 0;
  let lateMinutes = 0;
  let lateOccurrences = 0;
  let earlyExitMinutes = 0;
  let earlyExitOccurrences = 0;
  for (const r of records) {
    const eq = PAYABLE_EQUIVALENT[r.status] ?? 0;
    attendanceEquivalentDays += eq;
    if (r.lateMinutes) {
      lateMinutes += r.lateMinutes;
      lateOccurrences += 1;
    }
    if (r.earlyExitMinutes) {
      earlyExitMinutes += r.earlyExitMinutes;
      earlyExitOccurrences += 1;
    }
  }

  let monthlyScheduledDays = scheduledPayableDays;
  let dailyRate = zero;
  let periodBaseAmount = zero;
  let earnedBase = zero;
  let attendanceDeductions = zero;
  if (isMonthly) {
    // For MONTHLY salary staff:
    // Daily Rate = Monthly Salary / 30 (always fixed 30-day divisor).
    // Schedule only decides whether employee was supposed to work that day (Present / Absent / Leave / Off).
    // Weekly Off / unscheduled days must NOT become absence deductions.
    const FIXED_MONTHLY_DIVISOR = 30;
    monthlyScheduledDays = FIXED_MONTHLY_DIVISOR;
    dailyRate = base.div(FIXED_MONTHLY_DIVISOR);

    const isFullMonth = isFullCalendarMonth(periodStart, periodEnd);
    const unpaidEquivalent = Decimal.max(new Decimal(scheduledPayableDays).minus(attendanceEquivalentDays), zero);

    if (isFullMonth) {
      periodBaseAmount = base;
      if (attendanceEquivalentDays === 0) {
        attendanceDeductions = periodBaseAmount;
        earnedBase = zero;
      } else {
        attendanceDeductions = Decimal.min(dailyRate.mul(unpaidEquivalent), periodBaseAmount);
        earnedBase = Decimal.max(periodBaseAmount.minus(attendanceDeductions), zero);
      }
    } else {
      periodBaseAmount = dailyRate.mul(scheduledPayableDays);
      attendanceDeductions = dailyRate.mul(unpaidEquivalent);
      earnedBase = Decimal.max(periodBaseAmount.minus(attendanceDeductions), zero);
    }
  } else {
    dailyRate = base;
    periodBaseAmount = base.mul(scheduledPayableDays);
    earnedBase = base.mul(attendanceEquivalentDays);
    attendanceDeductions = Decimal.max(periodBaseAmount.minus(earnedBase), zero);
  }

  // Fixed allowance / deduction / fixed tax are paid at their configured
  // amount per payroll run — never prorated by period length.
  const allowances = profile.fixedAllowance;
  const otherDeductions = profile.fixedDeduction;
  const grossAmount = earnedBase.plus(allowances);

  let tax = zero;
  if (profile.salaryTaxMethod === 'PERCENTAGE' && profile.salaryTaxValue) {
    tax = grossAmount.mul(profile.salaryTaxValue).div(100);
  } else if (profile.salaryTaxMethod === 'FIXED' && profile.salaryTaxValue) {
    tax = profile.salaryTaxValue;
  }

  // Late-In / Early-Out cutting — dynamically read from this staff member's
  // own Salary Profile (`deductionRules`), never a hardcoded platform rate.
  const lateDeduction = computeTimingDeduction(readDeductionRule(profile.deductionRules, 'late'), lateMinutes, lateOccurrences);
  const earlyExitDeduction = computeTimingDeduction(readDeductionRule(profile.deductionRules, 'early_exit'), earlyExitMinutes, earlyExitOccurrences);

  const netAmount = Decimal.max(grossAmount.minus(tax).minus(otherDeductions).minus(lateDeduction).minus(earlyExitDeduction), zero);

  // SalarySlip currency columns have two decimal places. Round Monthly
  // results at this shared boundary so Preview and persisted Generate agree.
  const money = (amount: Decimal) => isMonthly ? amount.toDecimalPlaces(2) : amount;
  return {
    monthlyScheduledDays,
    dailyRate: money(dailyRate),
    scheduledPayableDays,
    attendanceEquivalentDays,
    periodBaseAmount: money(periodBaseAmount),
    earnedBase: money(earnedBase),
    attendanceDeductions: money(attendanceDeductions),
    allowances: money(allowances),
    grossAmount: money(grossAmount),
    tax: money(tax),
    otherDeductions: money(otherDeductions),
    lateDeduction: money(lateDeduction),
    earlyExitDeduction: money(earlyExitDeduction),
    lateMinutes,
    earlyExitMinutes,
    netAmount: money(netAmount),
  };
}
