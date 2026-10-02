import type { NextFunction, Request, Response } from 'express';
import { AuthorizationError } from '@/shared/errors/AppError';
import type { Action, ModuleKey, PortalRole } from '@/config/constants';

const fullAccess: Action[] = ['view', 'create', 'edit', 'delete'];

/**
 * pharmacy.md §2.1 — Super Admin and Admin share the same Management Portal
 * screens (identical module access here); the SUPER_ADMIN-only vs
 * ADMIN-only distinction ("Create Admin" vs "Create Sales", protected
 * account governance) is enforced precisely in `identity.service.ts`, not
 * this coarse per-module map — a role can only create the one tier below it.
 */
const POLICY: Record<PortalRole, Partial<Record<ModuleKey, Set<Action>>>> = {
  SUPER_ADMIN: {
    identity: new Set(fullAccess),
    pharmacy: new Set(fullAccess),
    vendors: new Set(fullAccess),
    purchaseOrders: new Set(fullAccess),
    cash: new Set(fullAccess),
    expenses: new Set(fullAccess),
    reports: new Set<Action>(['view']),
    dashboard: new Set<Action>(['view']),
    settings: new Set<Action>(['view', 'edit']),
    units: new Set<Action>(['view', 'create', 'edit']),
  },
  ADMIN: {
    identity: new Set(fullAccess),
    pharmacy: new Set(fullAccess),
    vendors: new Set(fullAccess),
    purchaseOrders: new Set(fullAccess),
    cash: new Set(fullAccess),
    expenses: new Set(fullAccess),
    reports: new Set<Action>(['view']),
    dashboard: new Set<Action>(['view']),
    settings: new Set<Action>(['view', 'edit']),
    units: new Set<Action>(['view', 'create', 'edit']),
  },
  SALES_DISPENSING: {
    // pharmacy.md §4 Sales User Restriction — no users/vendors/medicine
    // masters/purchase stock/manual qty edit; only POS, HMS fulfillment,
    // allowed returns, own cash control. Purchase Orders are the one
    // exception: a zero-stock/zero-financial-impact procurement reminder, so
    // a counter-staff member can flag "need more of this" without Admin.
    pharmacy: new Set<Action>(['view', 'create']),
    purchaseOrders: new Set<Action>(['view', 'create']),
    cash: new Set<Action>(['view', 'create']),
    reports: new Set<Action>(['view']),
    dashboard: new Set<Action>(['view']),
    units: new Set<Action>(['view']), // POS needs the unit list read-only
  },
};

/** Per-route authorization middleware. Must run after `authenticate`. */
export function authorize(module: ModuleKey, action: Action) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !POLICY[role]?.[module]?.has(action)) {
      throw new AuthorizationError(`Role ${role ?? 'UNKNOWN'} cannot ${action} ${module}`);
    }
    next();
  };
}
