import { describe, expect, it } from 'vitest';
import { membershipIneligibilityReasons, validateMembershipDetails, membershipSnapshot } from '@/shared/panelMembership';
import { createPanelPatientSchema, updatePanelPatientSchema } from '@/modules/frontdesk/patients.schemas';

describe('panel membership validity', () => {
  const membership = { membershipStatus: 'ACTIVE', membershipValidFrom: new Date('2026-09-23'), membershipValidTo: new Date('2026-09-23') };
  it('includes both boundary dates using Pakistan business date', () => {
    expect(membershipIneligibilityReasons(membership, new Date('2026-09-22T19:00:00Z'))).toEqual([]);
    expect(membershipIneligibilityReasons(membership, new Date('2026-09-23T18:59:59Z'))).toEqual([]);
    expect(membershipIneligibilityReasons(membership, new Date('2026-09-23T19:00:00Z'))).toContain('Membership has expired');
    expect(membershipIneligibilityReasons(membership, new Date('2026-09-22T18:59:59Z'))).toContain('Membership has not started');
  });
  it('blocks suspended membership separately from active patient status', () => {
    expect(membershipIneligibilityReasons({ membershipStatus: 'SUSPENDED', status: 'ACTIVE', isActive: true })).toEqual(['Membership is suspended']);
  });
  it('retains undated legacy memberships unless company requires dates', () => {
    expect(membershipIneligibilityReasons({ status: 'ACTIVE' })).toEqual([]);
    expect(membershipIneligibilityReasons({ corporatePanel: { membershipValidityRequired: true } })).toHaveLength(1);
  });
  it('uses the configured identity label and validates merged date range', () => {
    expect(() => validateMembershipDetails({ panelMemberId: ' ' }, { memberIdRequired: true, memberIdLabel: 'Employee ID' })).toThrow('Employee ID is required');
    expect(() => validateMembershipDetails({ ...membership, membershipValidFrom: new Date('2026-09-24') }, {})).toThrow('end date');
  });
  it('rejects invalid and timestamp membership dates without silently shifting them', () => {
    for (const value of ['', '2026-02-30', '2026-09-23T00:00:00Z']) expect(updatePanelPatientSchema.safeParse({ membershipValidTo: value }).success).toBe(false);
    expect(updatePanelPatientSchema.parse({ membershipValidTo: null }).membershipValidTo).toBeNull();
    expect(updatePanelPatientSchema.parse({ membershipValidTo: '2026-09-23' }).membershipValidTo).toEqual(new Date('2026-09-23'));
  });
  it('does not accept client supplied history, MRN or actor fields', () => {
    const parsed = createPanelPatientSchema.parse({ fullName: 'Test', corporatePanelId: '11111111-1111-4111-8111-111111111111', mrNumber: 'FORGED', membershipHistory: [{}], createdById: 'forged' });
    expect(parsed).not.toHaveProperty('membershipHistory');
    expect(parsed).not.toHaveProperty('mrNumber');
    expect(parsed).not.toHaveProperty('createdById');
  });
  it('serializes membership without retaining mutable Date objects', () => {
    expect(membershipSnapshot(membership).membershipValidTo).toBe('2026-09-23');
    expect(membershipSnapshot({}).membershipValidTo).toBeNull();
  });
});
