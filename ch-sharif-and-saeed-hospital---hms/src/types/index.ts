import type { ReactNode } from 'react';

export type UserRole =
  | 'Super Admin'
  | 'Admin'
  | 'Billing Officer'
  | 'Front Desk & Billing'
  | 'Admission Officer'
  | 'Admission'
  | 'Pharmacist'
  | 'Pharmacy'
  | 'Store Manager'
  | 'Inventory Management';

export type PortalKey =
  | 'super-admin'
  | 'admin'
  | 'front-desk'
  | 'admission'
  | 'inventory';

export type PortalType = PortalKey;

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  portal: PortalKey;
  allowedPortals: PortalKey[];
  permissions?: string[];
  status?: 'active' | 'suspended' | 'inactive';
  lastLogin?: string;
  isSuperAdminProtected?: boolean; // Super Admin cannot be deleted, deactivated or modified by Admin
}

export interface UserSession {
  userId: string;
  name: string;
  username: string;
  role: UserRole;
  selectedPortal: PortalKey;
  allowedPortals: PortalKey[];
  permissions: string[];
  status: 'active' | 'suspended' | 'inactive';
  loginTime: string;
  token?: string;
}

export interface AccountabilityAuditTrace {
  createdBy: string;
  updatedBy: string;
  collectedBy: string;
  approvedBy: string;
  refundedBy: string;
  voidedBy: string;
  cancelledBy: string;
  dispensedBy: string;
  receivedBy: string;
  issuedBy: string;
  dischargedBy: string;
}

export interface BillingAuditStamp {
  invoiceNumber: string;
  createdBy: string;
  createdDateTime: string;
  collectedBy?: string;
  collectedDateTime?: string;
  discountAppliedBy?: string;
  discountApprovedBy?: string;
  refundCreatedBy?: string;
  refundApprovedBy?: string;
  voidedBy?: string;
  voidReason?: string;
  counterName: string;
}

export interface StaffAccount {
  username: string;
  password: string;
  user: User;
}

export interface PortalConfig {
  id: PortalKey;
  key: PortalKey;
  name: string;
  portalCode: string;
  shortName: string;
  routePrefix: string;
  defaultRoute: string;
  loginRoute: string;
  role: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  accentColor: string;
  allowedRoles: UserRole[];
}

export type StatusType =
  | 'Active'
  | 'Inactive'
  | 'Pending'
  | 'Paid'
  | 'Partially Paid'
  | 'Unpaid'
  | 'Cancelled'
  | 'Refunded'
  | 'Admitted'
  | 'Discharged'
  | 'In Stock'
  | 'Low Stock'
  | 'Out of Stock'
  | 'Expired'
  | 'Near Expiry';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  active?: boolean;
}

export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string | number;
  badgeVariant?: 'default' | 'danger' | 'warning' | 'success';
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export interface TableColumn<T> {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (item: T) => ReactNode;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'urgent' | 'warning' | 'info' | 'success';
  module: string;
}

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  duration?: number;
}

export interface ImportRow {
  rowNumber: number;
  data: Record<string, any>;
  status: 'valid' | 'invalid' | 'duplicate';
  errors?: string[];
}

export * from './patient';
export * from './shift';
