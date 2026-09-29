/**
 * Cross-cutting constants shared across the whole app.
 */

// Mirrors prisma `PortalRole` enum. pharmacy.md §2 — collapsed from the older
// 3-portal design: SUPER_ADMIN + ADMIN share one Management Portal.
export const PORTAL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SALES_DISPENSING'] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

// Module keys used by the authorization policy map.
export const MODULE_KEYS = [
  'identity',
  'pharmacy',
  'vendors',
  'cash',
  'expenses',
  'reports',
  'dashboard',
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export type Action = 'view' | 'create' | 'edit' | 'delete';
