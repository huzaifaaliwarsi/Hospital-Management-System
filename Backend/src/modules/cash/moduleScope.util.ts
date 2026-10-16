import type { CashModuleScope } from '@prisma/client';
import type { PortalRole } from '@/config/constants';

/**
 * Resolves which `CashModuleScope` a cash-handling user's own Balance Sheet /
 * Account Settlement rows belong to (inventory.md §7.3, §9 step 2). Previously
 * `cash.service.ts`/`settlement.service.ts` hardcoded `'BILLING'` everywhere —
 * correct for Front Desk, silently wrong for every other cash-handling role
 * (an Inventory user's own settlement was being written/read as BILLING).
 *
 * ADMIN/SUPER_ADMIN have no fixed module — they only touch cash "if
 * personally handling cash" (PROJECT_MASTER_SPEC.md §4.9), an edge case this
 * fix doesn't change: they fall through to the same BILLING default the code
 * already used for everyone, unchanged.
 */
const ROLE_MODULE_SCOPE: Partial<Record<PortalRole, CashModuleScope>> = {
  FRONT_DESK_BILLING: 'BILLING',
  INVENTORY_MANAGEMENT: 'INVENTORY',
  PHARMACY_SUPER_ADMIN: 'PHARMACY',
  PHARMACY_MANAGER: 'PHARMACY',
  PHARMACY_SALES_DISPENSING: 'PHARMACY',
};

export function resolveCashModuleScope(role: PortalRole): CashModuleScope {
  return ROLE_MODULE_SCOPE[role] ?? 'BILLING';
}
