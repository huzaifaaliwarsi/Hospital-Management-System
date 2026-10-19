import { prisma } from '../db/client';
import { AuthorizationError } from './errors/AppError';

/**
 * Front Desk discretionary discounts are strictly restricted to Hospital
 * Services — Outsourced Lab / Radiology / Pharmacy charges can never be
 * discounted this way (those departments bill the hospital at cost; a
 * discount here would just move the loss onto the hospital's margin on
 * someone else's service). Shared by `invoices.service.ts` (OPD/encounter
 * invoices) and `admissionBilling.service.ts` (admission invoices) so the
 * eligibility rule can't drift between the two call sites.
 */
export function isEligibleHospitalService(serviceRate: any): boolean {
  return !!serviceRate && serviceRate.selectable === true &&
    serviceRate.billingSource === 'HOSPITAL_SERVICE' &&
    serviceRate.providerType === 'INTERNAL' && serviceRate.discountAllowed !== false;
}

export const DISCOUNT_APPROVAL_PERCENT_THRESHOLD = 15; // default fallback > 15% requires Admin approval
export const DISCOUNT_APPROVAL_AMOUNT_THRESHOLD = 1500; // default fallback > PKR 1,500 requires Admin approval

export async function getHospitalDiscountPolicy() {
  try {
    const profile = await prisma.hospitalProfile.findFirst();
    const ext = (profile?.extendedProfile as Record<string, any>) || {};
    return {
      approvalRequired: ext.discountApprovalRequired !== false,
      maxPercentThreshold: typeof ext.discountMaxPercentThreshold === 'number' ? ext.discountMaxPercentThreshold : DISCOUNT_APPROVAL_PERCENT_THRESHOLD,
      maxAmountThreshold: typeof ext.discountMaxAmountThreshold === 'number' ? ext.discountMaxAmountThreshold : DISCOUNT_APPROVAL_AMOUNT_THRESHOLD,
      overallAllowed: ext.discountOverallAllowed !== false,
    };
  } catch {
    return {
      approvalRequired: true,
      maxPercentThreshold: DISCOUNT_APPROVAL_PERCENT_THRESHOLD,
      maxAmountThreshold: DISCOUNT_APPROVAL_AMOUNT_THRESHOLD,
      overallAllowed: true,
    };
  }
}

export async function validateDiscountAuthorization(
  actorRole: string,
  discountAmount: any,
  discountPct: number,
  contextDesc: string = 'Discount'
): Promise<void> {
  const policy = await getHospitalDiscountPolicy();
  const amtNum = typeof discountAmount === 'number' ? discountAmount : (discountAmount?.toNumber ? discountAmount.toNumber() : Number(discountAmount || 0));

  if (!policy.overallAllowed && !['SUPER_ADMIN', 'ADMIN'].includes(actorRole)) {
    throw new AuthorizationError('Hospital-wide discounts are currently disabled in Hospital Overview.');
  }

  if (policy.approvalRequired && !['SUPER_ADMIN', 'ADMIN'].includes(actorRole)) {
    if (discountPct > policy.maxPercentThreshold || amtNum > policy.maxAmountThreshold) {
      throw new AuthorizationError(
        `${contextDesc} of PKR ${amtNum.toFixed(2)} (${discountPct.toFixed(1)}%) exceeds front desk limit (Max ${policy.maxPercentThreshold}% or PKR ${policy.maxAmountThreshold}). Please request Admin approval.`
      );
    }
  }
}

