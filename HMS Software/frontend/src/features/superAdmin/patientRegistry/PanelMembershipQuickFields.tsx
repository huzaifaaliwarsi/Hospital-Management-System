import React from 'react';
import type { PanelMembershipDetails } from '../../../types/patient';
import { DateInputControl } from '../../../components/forms/FormControls';

/**
 * Front Desk's quick-registration counterpart to `PanelMembershipFields`
 * (Super Admin Patient Registry). Front Desk registers under an existing
 * active company and captures the Member ID/Card, never the company's own
 * contract policy details (panel.md §4.4: Membership Effective From /
 * Expiry / Policy / Plan are "Optional/configured", not a Front Desk data
 * entry job) — so this shows only Valid From/To, and only when the
 * selected company's `membershipValidityRequired` policy demands it.
 * Membership status, policy/plan/principal/relationship, and saved
 * membership history stay Super Admin/Admin-only, edited later from the
 * Patient Registry.
 */
export default function PanelMembershipQuickFields({ value, onChange, datesRequired }: {
  value: PanelMembershipDetails;
  onChange: (patch: Partial<PanelMembershipDetails>) => void;
  datesRequired?: boolean;
}) {
  if (!datesRequired) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <DateInputControl
        label="Membership Valid From *"
        required
        value={value.membershipValidFrom || ''}
        max={value.membershipValidTo || undefined}
        onChange={(e) => onChange({ membershipValidFrom: e.target.value })}
      />
      <DateInputControl
        label="Membership Valid Through *"
        required
        value={value.membershipValidTo || ''}
        min={value.membershipValidFrom || undefined}
        onChange={(e) => onChange({ membershipValidTo: e.target.value })}
      />
    </div>
  );
}
