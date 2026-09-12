/**
 * Cross-cutting constants. Business-rule constants that belong to a single
 * module (e.g. commission rule types) live in that module's `*.types.ts`
 * instead — this file is for values shared across the whole app.
 */

// Portal roles — mirrors prisma `PortalRole` enum and PROJECT_MASTER_SPEC.md §3.1.
export const PORTAL_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'FRONT_DESK_BILLING',
  'ADMISSION',
  'INVENTORY_MANAGEMENT',
  'PHARMACY_SUPER_ADMIN',
  'PHARMACY_MANAGER',
  'PHARMACY_SALES_DISPENSING',
] as const;

export type PortalRole = (typeof PORTAL_ROLES)[number];

// Module keys used by the authorization policy map (§3.3, §7.9).
export const MODULE_KEYS = [
  'identity',
  'setup',
  'attendance',
  'payroll',
  'commission',
  'frontdesk',
  'admission',
  'inventory',
  'pharmacy',
  'pharmacy-bridge',
  'cash',
  'reports',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const API_PREFIX = '/api/v1';
