import { Decimal } from '@prisma/client/runtime/library';

export interface PanelDiscountRuleLike {
  serviceRateId: string;
  discountPercent: Decimal;
  coveragePercent: Decimal | null;
  capAmount: Decimal | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export interface PanelCoverageResolution {
  discountAmount: Decimal;
  discountReason: string | null;
  /** Portion the patient owes. Self-Pay (no rules passed): always equals `rate`. */
  patientShare: Decimal;
  /** Portion the panel company owes — only realized once a remittance is posted (§2.5/§2.8), never assumed here. */
  panelReceivable: Decimal;
}

/**
 * Resolves Panel Service-tier coverage for one line (HMS_V7.2_NEW_REQUIREMENTS.md
 * §2.5) — shared by `appointments.service.ts` and `admission.service.ts` so the
 * two billing paths never drift. Only the Service tier exists in schema today
 * (no Department/Global tiers) — no match at all means NOT_COVERED, per the
 * spec's explicit rule: never assume panel coverage.
 */
export function resolvePanelCoverage(
  rate: Decimal,
  discountRules: PanelDiscountRuleLike[] | undefined,
  serviceRateId: string,
  at: Date = new Date(),
): PanelCoverageResolution {
  const matchingRule = discountRules?.find(
    (r) => r.serviceRateId === serviceRateId && r.effectiveFrom <= at && (!r.effectiveTo || r.effectiveTo >= at),
  );

  if (matchingRule?.coveragePercent != null) {
    let panelReceivable = rate.mul(matchingRule.coveragePercent).div(100);
    if (matchingRule.capAmount != null && panelReceivable.greaterThan(matchingRule.capAmount)) {
      panelReceivable = matchingRule.capAmount;
    }
    return {
      discountAmount: new Decimal(0),
      discountReason: null,
      patientShare: rate.minus(panelReceivable),
      panelReceivable,
    };
  }

  if (matchingRule) {
    // Legacy flat discount rule (no coveragePercent) — a hospital-funded
    // price knock-off, not a panel receivable.
    const discountAmount = rate.mul(matchingRule.discountPercent).div(100);
    return {
      discountAmount,
      discountReason: `Corporate Panel Discount: ${matchingRule.discountPercent.toString()}%`,
      patientShare: rate.minus(discountAmount),
      panelReceivable: new Decimal(0),
    };
  }

  // NOT_COVERED — patient pays the full eligible amount.
  return {
    discountAmount: new Decimal(0),
    discountReason: null,
    patientShare: rate,
    panelReceivable: new Decimal(0),
  };
}
