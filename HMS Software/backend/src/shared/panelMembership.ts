import { ValidationError } from './errors/AppError';

export interface MembershipFields {
  corporatePanelId?: string;
  panelMemberId?: string | null;
  membershipStatus?: string;
  membershipValidFrom?: Date | null;
  membershipValidTo?: Date | null;
  policyNumber?: string | null;
  planName?: string | null;
  principalMemberName?: string | null;
  memberRelationship?: string | null;
}
interface MembershipRequirements {
  memberIdLabel?: string | null;
  memberIdRequired?: boolean;
  membershipValidityRequired?: boolean;
}
export function membershipSnapshot(patient: MembershipFields) {
  return {
    corporatePanelId: patient.corporatePanelId ?? null,
    panelMemberId: patient.panelMemberId ?? null,
    membershipStatus: patient.membershipStatus ?? 'ACTIVE',
    membershipValidFrom: patient.membershipValidFrom?.toISOString().slice(0, 10) ?? null,
    membershipValidTo: patient.membershipValidTo?.toISOString().slice(0, 10) ?? null,
    policyNumber: patient.policyNumber ?? null,
    planName: patient.planName ?? null,
    principalMemberName: patient.principalMemberName ?? null,
    memberRelationship: patient.memberRelationship ?? null,
  };
}
export function validateMembershipDetails(patient: MembershipFields, company: MembershipRequirements) {
  if (company.memberIdRequired && !patient.panelMemberId?.trim())
    throw new ValidationError(`${company.memberIdLabel || 'Member ID'} is required by this company`);
  if (company.membershipValidityRequired && (!patient.membershipValidFrom || !patient.membershipValidTo))
    throw new ValidationError('Membership start and end dates are required by this company');
  if (patient.membershipValidFrom && patient.membershipValidTo && patient.membershipValidTo < patient.membershipValidFrom)
    throw new ValidationError('Membership end date must be on or after start date');
}
export function membershipIneligibilityReasons(patient: MembershipFields & {
  isActive?: boolean; status?: string; corporatePanel?: MembershipRequirements & { isActive?: boolean };
}, at = new Date()): string[] {
  const reasons: string[] = [];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  if (patient.isActive === false || (patient.status && patient.status !== 'ACTIVE')) reasons.push('Panel patient record is inactive');
  if (patient.corporatePanel?.isActive === false) reasons.push('Corporate panel is inactive');
  if (patient.membershipStatus && patient.membershipStatus !== 'ACTIVE') reasons.push(`Membership is ${patient.membershipStatus.toLowerCase()}`);
  if (patient.membershipValidFrom && today < patient.membershipValidFrom.toISOString().slice(0, 10)) reasons.push('Membership has not started');
  if (patient.membershipValidTo && today > patient.membershipValidTo.toISOString().slice(0, 10)) reasons.push('Membership has expired');
  try { validateMembershipDetails(patient, patient.corporatePanel ?? {}); }
  catch (error) { if (error instanceof ValidationError) reasons.push(error.message); else throw error; }
  return reasons;
}
export function assertMembershipEligible(patient: Parameters<typeof membershipIneligibilityReasons>[0], at?: Date) {
  const reasons = membershipIneligibilityReasons(patient, at);
  if (reasons.length) throw new ValidationError(reasons.join('; '));
}
