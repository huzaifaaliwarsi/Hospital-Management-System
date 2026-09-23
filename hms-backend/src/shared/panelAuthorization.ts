import { ValidationError } from './errors/AppError';
import { panelBusinessDate } from './panelCoverage';

/**
 * Case authorization / guarantee enforcement (panel.md §15 backlog item 2).
 * Two independent triggers can require it: the panel COMPANY's own
 * `authorizationRequired` policy (checked once, before the case/encounter
 * can even be opened), and a specific matched `PanelDiscountRule`'s
 * `preauthorizationRequired` (checked per charge, since a rule that demands
 * authorization can apply even when the company-wide flag is off). Either
 * one being true means a reference is required. This is intentionally
 * called at every charge-posting point, not only at intake — an
 * authorization can expire mid-stay, and a later-added line can match a
 * different rule than the one active at intake.
 */
export interface CaseAuthorizationFields {
  authorizationNumber?: string | null;
  authorizationValidUntil?: Date | null;
}

export function caseAuthorizationIneligibilityReasons(
  required: boolean,
  fields: CaseAuthorizationFields,
  at: Date = new Date(),
): string[] {
  const reasons: string[] = [];
  if (required && !fields.authorizationNumber?.trim()) {
    reasons.push('Authorization/guarantee reference is required by this company before billing');
  }
  if (fields.authorizationValidUntil && panelBusinessDate(at) > panelBusinessDate(fields.authorizationValidUntil)) {
    reasons.push('Case authorization has expired — renew or obtain a new authorization reference before continuing');
  }
  return reasons;
}

export function assertCaseAuthorization(
  companyRequiresAuthorization: boolean | undefined,
  ruleRequiresAuthorization: boolean | undefined,
  fields: CaseAuthorizationFields,
  at?: Date,
) {
  const reasons = caseAuthorizationIneligibilityReasons(
    !!companyRequiresAuthorization || !!ruleRequiresAuthorization,
    fields,
    at,
  );
  if (reasons.length) throw new ValidationError(reasons.join('; '));
}
