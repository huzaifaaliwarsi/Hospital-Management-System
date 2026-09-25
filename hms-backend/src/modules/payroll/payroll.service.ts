import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ConflictError, ValidationError } from '@/shared/errors/AppError';
import { buildPaginationMeta, paginationSkipTake } from '@/shared/pagination';
import { PAYABLE_EQUIVALENT } from '../attendance/attendance.service';
import type { PayrollRunFilters, ListPayrollRunsQuery, PaySalarySlipBody, ListSalarySlipsQuery } from './payroll.schemas';

interface EligibleRow {
  staffId: string;
  fullName: string;
  employeeId: string;
  salaryBasis: string;
  scheduledPayableDays: number;
  attendanceEquivalentDays: number;
  periodBaseAmount: Decimal;
  earnedBase: Decimal;
  attendanceDeductions: Decimal;
  tax: Decimal;
  netAmount: Decimal;
  taxMethod: string | null;
  taxValue: Decimal | null;
  salaryProfileId: string;
}

interface SkippedRow {
  staffId: string;
  fullName: string;
  employeeId: string;
  reason: string;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Real "Scheduled Payable Days" for the period (staff.md §11) — every
 * calendar day in [periodStart, periodEnd] except the staff member's
 * assigned Shift's weekly-off days. Falls back to every calendar day when no
 * Shift is assigned. This is deliberately NOT "however many days happen to
 * have an attendance record" — that collapsed to paying a full month's
 * salary for a single marked day, which is wrong (staff.md's own worked
 * example divides by the days actually in the period).
 */
function countScheduledDays(periodStart: Date, periodEnd: Date, weeklyOffDays: string[]): number {
  const offSet = new Set(weeklyOffDays);
  let count = 0;
  const cursor = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), periodStart.getUTCDate()));
  const end = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), periodEnd.getUTCDate()));
  while (cursor.getTime() <= end.getTime()) {
    const dayName = WEEKDAY_NAMES[cursor.getUTCDay()] as string;
    if (!offSet.has(dayName)) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Math.max(count, 1); // never divide by zero for a same-day period
}

/** staff.md §11/§12 — attendance-based salary, per staff, for the given period. Read-only; never persists. */
async function computeEligibility(filters: PayrollRunFilters): Promise<{ eligible: EligibleRow[]; skipped: SkippedRow[] }> {
  const staffWhere: Prisma.StaffWhereInput = { isActive: true };
  if (filters.category) staffWhere.category = filters.category;
  if (filters.departmentId) staffWhere.staffDepartments = { some: { departmentId: filters.departmentId } };

  const staff = await prisma.staff.findMany({
    where: staffWhere,
    select: {
      id: true,
      fullName: true,
      employeeId: true,
      assignedShift: { select: { defaultWeeklyOffDays: true } },
    },
  });
  if (staff.length === 0) return { eligible: [], skipped: [] };

  const staffIds = staff.map((s) => s.id);

  // Current salary profile as of the period: effectiveFrom <= periodEnd, still open or overlapping the period.
  const profiles = await prisma.staffSalaryProfile.findMany({
    where: {
      staffId: { in: staffIds },
      effectiveFrom: { lte: filters.periodEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: filters.periodStart } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  const profileByStaff = new Map<string, (typeof profiles)[number]>();
  for (const p of profiles) {
    if (!profileByStaff.has(p.staffId)) profileByStaff.set(p.staffId, p);
  }

  const attendance = await prisma.attendanceRecord.findMany({
    where: {
      staffId: { in: staffIds },
      attendanceDate: { gte: filters.periodStart, lte: filters.periodEnd },
      isApproved: true,
    },
    select: { staffId: true, status: true },
  });
  const attendanceByStaff = new Map<string, { status: string }[]>();
  for (const a of attendance) {
    const list = attendanceByStaff.get(a.staffId) ?? [];
    list.push(a);
    attendanceByStaff.set(a.staffId, list);
  }

  const eligible: EligibleRow[] = [];
  const skipped: SkippedRow[] = [];

  for (const s of staff) {
    const profile = profileByStaff.get(s.id);
    if (!profile) {
      skipped.push({ staffId: s.id, fullName: s.fullName, employeeId: s.employeeId, reason: 'No Salary Profile configured for this period' });
      continue;
    }
    const records = attendanceByStaff.get(s.id) ?? [];
    if (records.length === 0) {
      skipped.push({ staffId: s.id, fullName: s.fullName, employeeId: s.employeeId, reason: 'No approved attendance in this period' });
      continue;
    }
    const scheduledPayableDays = countScheduledDays(filters.periodStart, filters.periodEnd, s.assignedShift?.defaultWeeklyOffDays ?? []);
    const attendanceEquivalentDays = records.reduce((sum, r) => sum + (PAYABLE_EQUIVALENT[r.status] ?? 0), 0);

    // staff.md §9 — 4 salary types (MONTHLY / MONTHLY_COMMISSION / PER_DAY /
    // PER_DAY_COMMISSION); only the Monthly-vs-Daily half affects this math,
    // the "+Commission" half is a label only.
    const isMonthly = profile.salaryBasis.startsWith('MONTHLY');
    const perDayRate = isMonthly ? profile.baseAmount.div(scheduledPayableDays) : profile.baseAmount;
    const periodBaseAmount = isMonthly ? profile.baseAmount : profile.baseAmount.mul(scheduledPayableDays);
    const earnedBase = perDayRate.mul(attendanceEquivalentDays);
    const attendanceDeductions = periodBaseAmount.minus(earnedBase);

    let tax = new Decimal(0);
    if (profile.salaryTaxMethod === 'PERCENTAGE' && profile.salaryTaxValue) {
      tax = earnedBase.mul(profile.salaryTaxValue).div(100);
    } else if (profile.salaryTaxMethod === 'FIXED' && profile.salaryTaxValue) {
      tax = profile.salaryTaxValue;
    }
    const netAmount = earnedBase.minus(tax);

    eligible.push({
      staffId: s.id,
      fullName: s.fullName,
      employeeId: s.employeeId,
      salaryBasis: profile.salaryBasis,
      scheduledPayableDays,
      attendanceEquivalentDays,
      periodBaseAmount,
      earnedBase,
      attendanceDeductions,
      tax,
      netAmount,
      taxMethod: profile.salaryTaxMethod,
      taxValue: profile.salaryTaxValue,
      salaryProfileId: profile.id,
    });
  }

  return { eligible, skipped };
}

export const payrollService = {
  /** Read-only preview — exactly what a Generate would produce, without writing anything. */
  async preview(filters: PayrollRunFilters) {
    const { eligible, skipped } = await computeEligibility(filters);
    const totalAmount = eligible.reduce((sum, r) => sum.plus(r.netAmount), new Decimal(0));
    return { eligible, skipped, totalAmount, staffCount: eligible.length };
  },

  async generate(filters: PayrollRunFilters, actorId: string) {
    const { eligible, skipped } = await computeEligibility(filters);
    if (eligible.length === 0) {
      throw new ConflictError('No staff have both a Salary Profile and approved attendance for this period — nothing to generate.');
    }
    const totalAmount = eligible.reduce((sum, r) => sum.plus(r.netAmount), new Decimal(0));

    return prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          periodType: filters.periodType,
          periodStart: filters.periodStart,
          periodEnd: filters.periodEnd,
          departmentId: filters.departmentId,
          category: filters.category,
          status: 'GENERATED',
          staffCount: eligible.length,
          totalAmount,
          skippedStaff: skipped as unknown as Prisma.InputJsonValue,
          generatedById: actorId,
        },
      });

      for (const row of eligible) {
        await tx.salarySlip.create({
          data: {
            staffId: row.staffId,
            payrollRunId: run.id,
            periodType: filters.periodType,
            periodStart: filters.periodStart,
            periodEnd: filters.periodEnd,
            baseAmount: row.periodBaseAmount,
            allowances: 0,
            attendanceDeductions: row.attendanceDeductions,
            otherDeductions: 0,
            adjustments: 0,
            generatedAmount: row.netAmount,
            componentBreakdown: {
              periodBaseAmount: row.periodBaseAmount.toNumber(),
              earnedBase: row.earnedBase.toNumber(),
              attendanceDeductions: row.attendanceDeductions.toNumber(),
              tax: row.tax.toNumber(),
              netAmount: row.netAmount.toNumber(),
            },
            calculationSnapshot: {
              salaryBasis: row.salaryBasis,
              salaryProfileId: row.salaryProfileId,
              scheduledPayableDays: row.scheduledPayableDays,
              attendanceEquivalentDays: row.attendanceEquivalentDays,
              taxMethod: row.taxMethod,
              taxValue: row.taxValue?.toNumber() ?? null,
              generatedAt: new Date().toISOString(),
            },
            status: 'GENERATED',
          },
        });
      }

      return tx.payrollRun.findUniqueOrThrow({
        where: { id: run.id },
        include: { lines: { include: { staff: { select: { id: true, fullName: true, employeeId: true } } } }, department: true },
      });
    });
  },

  async list(query: ListPayrollRunsQuery) {
    const where: Prisma.PayrollRunWhereInput = {};
    if (query.status) where.status = query.status;
    const [rows, totalItems] = await prisma.$transaction([
      prisma.payrollRun.findMany({
        where,
        include: { department: { select: { id: true, name: true } }, generatedByUser: { select: { id: true, username: true } } },
        orderBy: { generatedAt: 'desc' },
        ...paginationSkipTake(query),
      }),
      prisma.payrollRun.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query, totalItems) };
  },

  async getById(id: string) {
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        generatedByUser: { select: { id: true, username: true } },
        approvedByUser: { select: { id: true, username: true } },
        lines: {
          include: {
            staff: { select: { id: true, fullName: true, employeeId: true, category: true } },
            payments: true,
          },
        },
      },
    });
    if (!run) throw new NotFoundError('Payroll run not found');
    return run;
  },

  /** Locks every generated line at once — never edited after this except via payment/adjustment. */
  async approve(id: string, actorId: string) {
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundError('Payroll run not found');
    if (run.status === 'APPROVED') throw new ConflictError('This payroll run is already approved.');

    return prisma.$transaction(async (tx) => {
      await tx.salarySlip.updateMany({ where: { payrollRunId: id }, data: { status: 'APPROVED', approvedById: actorId, approvedAt: new Date() } });
      return tx.payrollRun.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: actorId, approvedAt: new Date() },
        include: { lines: true },
      });
    });
  },

  async listSlips(query: ListSalarySlipsQuery) {
    const where: Prisma.SalarySlipWhereInput = {};
    if (query.staffId) where.staffId = query.staffId;
    if (query.status) where.status = query.status as Prisma.EnumSalaryStatusFilter['equals'];
    if (query.payrollRunId) where.payrollRunId = query.payrollRunId;

    const [rows, totalItems] = await prisma.$transaction([
      prisma.salarySlip.findMany({
        where,
        include: { staff: { select: { id: true, fullName: true, employeeId: true } }, payments: true },
        orderBy: { createdAt: 'desc' },
        ...paginationSkipTake(query),
      }),
      prisma.salarySlip.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query, totalItems) };
  },

  /** Only an APPROVED (or already PARTIALLY_PAID) slip can be paid — never a DRAFT/unapproved one. */
  async paySlip(id: string, body: PaySalarySlipBody, actorId: string) {
    const slip = await prisma.salarySlip.findUnique({ where: { id }, include: { payments: true } });
    if (!slip) throw new NotFoundError('Salary slip not found');
    if (slip.status !== 'APPROVED' && slip.status !== 'PARTIALLY_PAID') {
      throw new ConflictError('Only an approved salary slip can be paid.');
    }
    const alreadyPaid = slip.payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
    const remaining = slip.generatedAmount.minus(alreadyPaid);
    if (remaining.lte(0)) throw new ConflictError('This salary slip is already fully paid.');
    if (new Decimal(body.amount).gt(remaining)) {
      throw new ValidationError(`Payment amount exceeds the remaining balance of ${remaining.toFixed(2)}.`);
    }

    return prisma.$transaction(async (tx) => {
      await tx.salaryPayment.create({
        data: {
          salarySlipId: id,
          amount: body.amount,
          method: body.method,
          reference: body.reference,
          paidById: actorId,
        },
      });
      const newPaidTotal = alreadyPaid.plus(body.amount);
      const newStatus = newPaidTotal.gte(slip.generatedAmount) ? 'PAID' : 'PARTIALLY_PAID';
      return tx.salarySlip.update({
        where: { id },
        data: { status: newStatus },
        include: { payments: true, staff: { select: { id: true, fullName: true, employeeId: true } } },
      });
    });
  },
};
