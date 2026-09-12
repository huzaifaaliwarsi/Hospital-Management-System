export type AdminUserRole = 'SUPER_ADMIN' | 'ADMIN';
export type AdminUserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface AdminUser {
  id: string; // e.g. 'ADM-001'
  employeeCode: string; // e.g. 'EMP-SA-01'
  fullName: string;
  username: string;
  email: string;
  phone: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  isProtectedSuperAdmin: boolean;
  lastLoginAt?: string;
  lastLoginIpPlaceholder?: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  statusChangedBy?: string;
  statusChangedAt?: string;
  passwordResetBy?: string;
  passwordResetAt?: string;
  requirePasswordChangeOnLogin?: boolean;
  linkedActivityCount?: number; // non-zero prevents hard deletion
}

export interface AdminCredential {
  adminUserId: string;
  username: string; // lowercase
  password: string; // configured demo password
  requirePasswordChange?: boolean;
  updatedAt: string;
}

export interface AdminUserFilterState {
  searchTerm: string;
  role: 'ALL' | AdminUserRole;
  status: 'ALL' | AdminUserStatus;
}

export interface AdminUserFormValues {
  fullName: string;
  employeeCode: string;
  username: string;
  email: string;
  phone: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  password?: string;
  confirmPassword?: string;
  requirePasswordChangeOnLogin?: boolean;
}

export interface AdminUserAuditLogEntry {
  id: string;
  actionType:
    | 'CREATE_ADMIN'
    | 'UPDATE_ADMIN'
    | 'CHANGE_ROLE'
    | 'ACTIVATE_ADMIN'
    | 'DEACTIVATE_ADMIN'
    | 'SUSPEND_ADMIN'
    | 'RESET_PASSWORD'
    | 'DELETE_ADMIN'
    | 'IMPORT_ADMINS';
  actorUserId: string;
  actorName: string;
  targetUserId: string;
  targetName: string;
  details: string;
  timestamp: string;
}

export interface ImportedAdminRow {
  rowNumber: number;
  fullName: string;
  employeeCode: string;
  username: string;
  email: string;
  phone: string;
  status: AdminUserStatus;
  isValid: boolean;
  errors: string[];
  tempPassword?: string;
}
