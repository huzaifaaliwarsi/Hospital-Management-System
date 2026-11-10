import { ValidationError } from './errors/AppError';
import { panelBusinessDate } from './panelCoverage';

/**
 * Case authorization and guarantee enforcement helper.
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
