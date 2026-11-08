import { Decimal } from '@prisma/client/runtime/library';
import { PAYABLE_EQUIVALENT } from '../attendance/attendance.service';

/**
 * Pure salary maths for payroll (PDF § 11). Shared by Preview and Generate via
 * payroll.service `computeEligibility`, so both always produce identical figures.
 */

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_MS = 86_400_000;

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * A staff member's working weekdays (PDF § 8): their own Weekly Timing when set
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
  mode: 'NONE' | 'PER_MINUTE' | 'FIXED_PER_OCCURRENCE' | 'PERCENTAGE_DAILY';
  amount: Decimal;
}

const NO_DEDUCTION: DeductionRule = { mode: 'NONE', amount: new Decimal(0) };

function readDeductionRule(rules: unknown, key: 'late' | 'early_exit'): DeductionRule {
  if (!rules || typeof rules !== 'object') return NO_DEDUCTION;
  const rule = (rules as Record<string, unknown>)[key];
  if (!rule || typeof rule !== 'object') return NO_DEDUCTION;
  const mode = (rule as Record<string, unknown>).mode;
  const amount = (rule as Record<string, unknown>).amount;
  if (mode !== 'PER_MINUTE' && mode !== 'FIXED_PER_OCCURRENCE' && mode !== 'PERCENTAGE_DAILY') return NO_DEDUCTION;
  return { mode, amount: new Decimal((amount as number | string | undefined) ?? 0) };
}

/** Late-In / Early-Out cut for the period — minutes-based, fixed amount, or percentage of daily wage per occurrence. */
function computeTimingDeduction(rule: DeductionRule, totalMinutes: number, occurrences: number, dailyRate: Decimal): Decimal {
  if (rule.mode === 'PER_MINUTE') return rule.amount.mul(totalMinutes);
  if (rule.mode === 'FIXED_PER_OCCURRENCE') return rule.amount.mul(occurrences);
  if (rule.mode === 'PERCENTAGE_DAILY') {
    return dailyRate.mul(rule.amount).div(100).mul(occurrences);
  }
  return new Decimal(0);
}

/**
 * Detects if [start, end] covers a complete calendar month (1st to last day of month).
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
  return eDate === lastDayOfMonth;
}

export interface MonthSlice {
  year: number;
  month: number;
  sliceStart: Date;
  sliceEnd: Date;
  daysInMonth: number;
  calendarDays: number;
  isFullMonth: boolean;
}

/**
 * Splits any custom period [start, end] into distinct calendar month slices so that
 * multi-month periods each use their respective month's actual calendar-day divisor.
 */
export function splitIntoMonthSlices(start: Date, end: Date): MonthSlice[] {
  const slices: MonthSlice[] = [];
  const s = new Date(start);
  const e = new Date(end);
  let curYear = s.getUTCFullYear();
  let curMonth = s.getUTCMonth();

  const endYear = e.getUTCFullYear();
  const endMonth = e.getUTCMonth();

  while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
    const daysInCurMonth = new Date(Date.UTC(curYear, curMonth + 1, 0)).getUTCDate();

    const sliceStartDate = (curYear === s.getUTCFullYear() && curMonth === s.getUTCMonth())
      ? s.getUTCDate()
      : 1;

    const sliceEndDate = (curYear === endYear && curMonth === endMonth)
      ? e.getUTCDate()
      : daysInCurMonth;

    const sliceStart = new Date(Date.UTC(curYear, curMonth, sliceStartDate));
    const sliceEnd = new Date(Date.UTC(curYear, curMonth, sliceEndDate));
    const calendarDays = sliceEndDate - sliceStartDate + 1;
    const isFull = (sliceStartDate === 1 && sliceEndDate === daysInCurMonth);

    slices.push({
      year: curYear,
      month: curMonth,
      sliceStart,
      sliceEnd,
      daysInMonth: daysInCurMonth,
      calendarDays,
      isFullMonth: isFull,
    });

    curMonth++;
    if (curMonth > 11) {
      curMonth = 0;
      curYear++;
    }
  }

  return slices;
}

/**
 * Attendance-based salary for one staff member over the period.
 *
 *   Attendance Equivalent = Present + Half*0.5 + Paid Leave
 *
 *   MONTHLY and MONTHLY_COMMISSION (Doctor commission is always a fully separate ledger):
 *     DaysInMonth         = Actual calendar days in selected month (28, 29, 30, or 31)
 *     Daily Rate          = Monthly Base / DaysInMonth
 *     Unpaid Deduction    = Daily Rate * Eligible Unpaid Days
 *     Net Earned Base     = Period Base - Unpaid Deduction
 *
 *     Weekly Off and Paid Holidays are PAID and do not reduce monthly salary.
 *     For partial employment periods, prorates using eligible calendar days within employment period.
 *
 *   DAILY:
 *     Daily Rate          = Base Amount (per working day)
 *     Period Base         = Base Amount * Scheduled Working Days
 *     Earned Base         = Base Amount * Attendance Equivalent
 *     Attendance Deductions = Base Amount * Unpaid Working Days
 *
 *   Gross = Earned Base + Allowance;  Tax% = Gross * %;  Net = Gross - Tax - Deduction
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
    const slices = splitIntoMonthSlices(periodStart, periodEnd);
    let totalPeriodBase = zero;
    let totalEarnedBase = zero;
    let totalAttendanceDeductions = zero;
    let totalCalendarDays = 0;

    for (const slice of slices) {
      const sliceDailyRate = base.div(slice.daysInMonth);
      totalCalendarDays += slice.calendarDays;

      const scheduledInSlice = countWorkingDays(utcDay(slice.sliceStart), utcDay(slice.sliceEnd), working);
      const sliceRecords = records.filter((r) => {
        const t = utcDay(r.attendanceDate);
        return t >= utcDay(slice.sliceStart) && t <= utcDay(slice.sliceEnd);
      });

      let attendanceEquivalentInSlice = 0;
      for (const r of sliceRecords) {
        const eq = PAYABLE_EQUIVALENT[r.status] ?? 0;
        attendanceEquivalentInSlice += eq;
      }

      const unpaidInSlice = Decimal.max(new Decimal(scheduledInSlice).minus(attendanceEquivalentInSlice), zero);

      let sliceBase = zero;
      let sliceDeductions = zero;
      let sliceEarned = zero;

      if (slice.isFullMonth) {
        sliceBase = base;
        if (attendanceEquivalentInSlice === 0 && scheduledInSlice > 0) {
          sliceDeductions = sliceBase;
          sliceEarned = zero;
        } else {
          sliceDeductions = Decimal.min(sliceDailyRate.mul(unpaidInSlice), sliceBase);
          sliceEarned = Decimal.max(sliceBase.minus(sliceDeductions), zero);
        }
      } else {
        // Partial employment period in this month:
        // Prorate using eligible calendar days within the employment period:
        sliceBase = sliceDailyRate.mul(slice.calendarDays);
        if (attendanceEquivalentInSlice === 0 && scheduledInSlice > 0) {
          sliceDeductions = sliceBase;
          sliceEarned = zero;
        } else {
          sliceDeductions = Decimal.min(sliceDailyRate.mul(unpaidInSlice), sliceBase);
          sliceEarned = Decimal.max(sliceBase.minus(sliceDeductions), zero);
        }
      }

      totalPeriodBase = totalPeriodBase.plus(sliceBase);
      totalAttendanceDeductions = totalAttendanceDeductions.plus(sliceDeductions);
      totalEarnedBase = totalEarnedBase.plus(sliceEarned);
    }

    periodBaseAmount = totalPeriodBase;
    attendanceDeductions = totalAttendanceDeductions;
    earnedBase = totalEarnedBase;

    if (slices.length === 1) {
      monthlyScheduledDays = slices[0]!.daysInMonth;
      dailyRate = base.div(slices[0]!.daysInMonth);
    } else {
      monthlyScheduledDays = totalCalendarDays;
      dailyRate = totalCalendarDays > 0 ? totalPeriodBase.div(totalCalendarDays) : zero;
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
  const lateDeduction = computeTimingDeduction(readDeductionRule(profile.deductionRules, 'late'), lateMinutes, lateOccurrences, dailyRate);
  const earlyExitDeduction = computeTimingDeduction(readDeductionRule(profile.deductionRules, 'early_exit'), earlyExitMinutes, earlyExitOccurrences, dailyRate);

  const netAmount = Decimal.max(grossAmount.minus(tax).minus(otherDeductions).minus(lateDeduction).minus(earlyExitDeduction), zero);

  // SalarySlip currency columns have two decimal places. Round all monetary
  // results at this shared boundary so Preview and persisted Generate agree.
  const money = (amount: Decimal) => amount.toDecimalPlaces(2);
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
