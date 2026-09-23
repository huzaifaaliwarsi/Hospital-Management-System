import { Decimal } from '@prisma/client/runtime/library';
import { membershipSnapshot, type MembershipFields } from './panelMembership';

export interface PanelDiscountRuleLike {
  id?: string;
  corporatePanelId?: string;
  serviceRateId: string | null;
  departmentId?: string | null;
  scope?: string;
  coverageType?: string;
  fixedPatientShare?: Decimal | null;
  contractRate?: Decimal | null;
  isActive?: boolean;
  archivedAt?: Date | null;
  preauthorizationRequired?: boolean;
  discountPercent: Decimal;
  coveragePercent: Decimal | null;
  capAmount: Decimal | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

// Date-only contract boundaries are inclusive hospital calendar dates.
export function panelBusinessDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

export function matchPanelRule(
  rules: PanelDiscountRuleLike[] | undefined,
  serviceId: string,
  departmentId?: string | null,
  at = new Date(),
) {
  const day = panelBusinessDate(at);
  const rank = (r: PanelDiscountRuleLike) =>
    (r.scope ?? 'SERVICE') === 'SERVICE' ? 3 : r.scope === 'DEPARTMENT' ? 2 : 1;
  return rules
    ?.filter((r) => {
      if (
        r.isActive === false ||
        r.archivedAt ||
        r.effectiveFrom.toISOString().slice(0, 10) > day ||
        (r.effectiveTo && r.effectiveTo.toISOString().slice(0, 10) < day)
      )
        return false;
      const scope = r.scope ?? 'SERVICE';
      return scope === 'SERVICE'
        ? r.serviceRateId === serviceId
        : scope === 'DEPARTMENT'
          ? !!departmentId && r.departmentId === departmentId
          : scope === 'GLOBAL';
    })
    .sort(
      (a, b) =>
        rank(b) - rank(a) ||
        b.effectiveFrom.getTime() - a.effectiveFrom.getTime() ||
        (a.id ?? '').localeCompare(b.id ?? ''),
    )[0];
}

export function resolvePanelCoverage(
  rate: Decimal,
  discountRules: PanelDiscountRuleLike[] | undefined,
  serviceRateId: string,
  at: Date = new Date(),
  departmentId?: string | null,
  quantity: Decimal = new Decimal(1),
  membership?: MembershipFields | null,
) {
  const rule = matchPanelRule(discountRules, serviceRateId, departmentId, at);
  const money = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const gross = money(rate);
  const type =
    rule?.coverageType ?? (rule?.coveragePercent != null ? 'PERCENTAGE' : 'LEGACY_DISCOUNT');
  // A contract benefit never becomes a surcharge if the standard rate is later reduced.
  const eligible =
    rule?.contractRate != null ? Decimal.min(gross, money(rule.contractRate.mul(quantity))) : gross;
  let discountAmount = gross.minus(eligible);
  let panelReceivable = new Decimal(0);
  let net = eligible;
  if (rule && type === 'LEGACY_DISCOUNT') {
    discountAmount = money(gross.mul(rule.discountPercent).div(100));
    net = gross.minus(discountAmount);
  } else if (rule && type === 'FULL') {
    panelReceivable = net;
  } else if (rule && type === 'PERCENTAGE') {
    panelReceivable = money(net.mul(rule.coveragePercent ?? 0).div(100));
  } else if (rule && type === 'FIXED_PATIENT_SHARE') {
    // Fixed co-pay is per line, bounded by eligible net, not per unit.
    panelReceivable = net.minus(Decimal.min(net, rule.fixedPatientShare ?? 0));
  }
  if (rule?.capAmount != null) panelReceivable = Decimal.min(panelReceivable, rule.capAmount);
  panelReceivable = money(Decimal.max(0, Decimal.min(net, panelReceivable)));
  const patientShare = net.minus(panelReceivable);
  const source =
    !rule || type === 'NOT_COVERED'
      ? ('NOT_COVERED' as const)
      : type === 'LEGACY_DISCOUNT'
        ? ('LEGACY_DISCOUNT' as const)
        : ('COVERAGE' as const);
  const discountReason = discountAmount.isZero()
    ? null
    : type === 'LEGACY_DISCOUNT'
      ? `Corporate Panel Discount: ${rule!.discountPercent.toString()}%`
      : 'Panel contract tariff adjustment';
  return {
    discountAmount,
    discountReason,
    patientShare,
    panelReceivable,
    eligibleNet: net,
    source,
    matchedRule: rule,
    coverageSnapshot: {
      ruleId: rule?.id ?? null,
      corporatePanelId: membership?.corporatePanelId ?? rule?.corporatePanelId ?? null,
      membership: membership ? membershipSnapshot(membership) : null,
      scope: rule?.scope ?? (rule ? 'SERVICE' : null),
      coverageType: rule ? type : 'NOT_COVERED',
      serviceRateId,
      departmentId: departmentId ?? null,
      businessDate: panelBusinessDate(at),
      quantity: quantity.toString(),
      standardGross: gross.toString(),
      eligibleNet: net.toString(),
      contractRate: rule?.contractRate?.toString() ?? null,
      discountAmount: discountAmount.toString(),
      coveragePercent: rule?.coveragePercent?.toString() ?? null,
      fixedPatientShare: rule?.fixedPatientShare?.toString() ?? null,
      capAmount: rule?.capAmount?.toString() ?? null,
      patientShare: patientShare.toString(),
      panelReceivable: panelReceivable.toString(),
    },
  };
}

export type PanelCoverageResolution = ReturnType<typeof resolvePanelCoverage>;
