import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import type { Prisma } from '@prisma/client';
import type {
  CreateCommissionRuleBody,
  ListCommissionRulesQuery,
  ListAccrualsQuery,
} from './commission.schemas';

export const commissionService = {
  /**
   * Core Doctor Commission calculation engine (§4.5, §8.6, D15 §4).
   * Resolves doctor-specific rules with fallback to doctor default rule.
   * Calculates Doctor Commission & Hospital Remaining Share.
   */
  async calculateAndAccrueCommission(
    tx: Prisma.TransactionClient,
    lineItem: {
      id: string;
      serviceRateId: string;
      quantity: Decimal;
      lineGross: Decimal;
      lineNet: Decimal;
      discountAmount: Decimal;
    },
    doctorStaffId: string,
  ) {
    // 1. Check if commission is already accrued for this invoice line (enforces 1:1 constraint)
    const existing = await tx.doctorCommissionAccrual.findUnique({
      where: { invoiceLineItemId: lineItem.id },
    });
    if (existing) return existing;

    const now = new Date();

    // 2. Query doctor-specific rule for this specific service rate
    let rule = await tx.doctorCommissionRule.findFirst({
      where: {
        staffId: doctorStaffId,
        serviceRateId: lineItem.serviceRateId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // 3. Fallback to doctor's default commission rule (serviceRateId = null)
    if (!rule) {
      rule = await tx.doctorCommissionRule.findFirst({
        where: {
          staffId: doctorStaffId,
          serviceRateId: null,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });
    }

    if (!rule) {
      // Doctor has no commission rule configured
      return null;
    }

    // 4. Determine eligible base amount: default is NET (Gross - Discount) per D15 §4
    const eligibleAmount = rule.basis === 'GROSS' ? lineItem.lineGross : lineItem.lineNet;

    // 5. Calculate commission amount
    let commissionAmount = new Decimal(0);
    if (rule.ruleType === 'FIXED_PER_SERVICE') {
      commissionAmount = rule.rate.mul(lineItem.quantity);
    } else {
      // PERCENTAGE rule
      commissionAmount = eligibleAmount.mul(rule.rate).div(100);
    }

    // 6. Hospital Remaining Share = Net Service Amount - Doctor Commission
    const hospitalShare = lineItem.lineNet.minus(commissionAmount);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const ruleSnapshot = {
      ruleId: rule.id,
      ruleType: rule.ruleType,
      rate: rule.rate.toNumber(),
      basis: rule.basis,
      serviceRateId: lineItem.serviceRateId,
      lineGross: lineItem.lineGross.toNumber(),
      discountAmount: lineItem.discountAmount.toNumber(),
      lineNet: lineItem.lineNet.toNumber(),
      commissionAmount: commissionAmount.toNumber(),
      hospitalRemainingShare: hospitalShare.toNumber(),
      calculatedAt: now.toISOString(),
    };

    // 7. Create DoctorCommissionAccrual record
    return tx.doctorCommissionAccrual.create({
      data: {
        staffId: doctorStaffId,
        invoiceLineItemId: lineItem.id,
        periodType: 'DAILY',
        periodStart: startOfDay,
        periodEnd: endOfDay,
        commissionAmount,
        ruleSnapshot,
        status: 'ACCRUED',
      },
    });
  },

  /**
   * Commission reversal engine — called when a service line is refunded or cancelled
   * Never silently deletes the original statement; creates a linked reversal (§4.5, D16 p.21).
   */
  async reverseCommissionAccrual(
    tx: Prisma.TransactionClient,
    invoiceLineItemId: string,
    reason: string,
    reversedById: string,
  ) {
    const accrual = await tx.doctorCommissionAccrual.findUnique({
      where: { invoiceLineItemId },
    });
    if (!accrual) return null;

    return tx.commissionReversal.create({
      data: {
        doctorCommissionAccrualId: accrual.id,
        reversalAmount: accrual.commissionAmount,
        reason,
        reversedById,
      },
    });
  },

  async createCommissionRule(body: CreateCommissionRuleBody, actorId: string) {
    return prisma.doctorCommissionRule.create({
      data: {
        staffId: body.staffId,
        serviceRateId: body.serviceRateId ?? null,
        ruleType: body.ruleType,
        rate: new Decimal(body.rate),
        basis: body.basis,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo ?? null,
        createdById: actorId,
      },
      include: {
        doctor: { select: { id: true, fullName: true, designation: true } },
        serviceRate: { select: { id: true, name: true, standardRate: true } },
      },
    });
  },

  async listCommissionRules(query: ListCommissionRulesQuery) {
    return prisma.doctorCommissionRule.findMany({
      where: {
        staffId: query.staffId,
        serviceRateId: query.serviceRateId,
      },
      include: {
        doctor: { select: { id: true, fullName: true, designation: true } },
        serviceRate: { select: { id: true, name: true, standardRate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async listAccruals(query: ListAccrualsQuery) {
    const where: Prisma.DoctorCommissionAccrualWhereInput = {};
    if (query.staffId) where.staffId = query.staffId;
    if (query.status) where.status = query.status;
    if (query.startDate && query.endDate) {
      where.periodStart = { gte: new Date(query.startDate) };
      where.periodEnd = { lte: new Date(`${query.endDate}T23:59:59.999Z`) };
    }

    return prisma.doctorCommissionAccrual.findMany({
      where,
      include: {
        doctor: { select: { id: true, fullName: true, designation: true } },
        invoiceLineItem: {
          include: {
            serviceRate: true,
            hospitalInvoice: { select: { id: true, invoiceNumber: true, status: true } },
          },
        },
        reversals: true,
        payouts: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  },
};
