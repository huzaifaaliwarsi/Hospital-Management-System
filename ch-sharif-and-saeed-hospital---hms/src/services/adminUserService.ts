import { User } from '../types';
import {
  AdminUser,
  AdminUserFormValues,
  AdminUserFilterState,
  AdminUserAuditLogEntry,
  ImportedAdminRow,
  AdminUserRole,
  AdminUserStatus,
  AdminCredential,
} from '../types/adminUser';

export const ADMIN_USERS_STORAGE_KEY = 'hms_admin_users_master_catalog_v1';
export const ADMIN_AUDIT_STORAGE_KEY = 'hms_admin_audit_logs_v1';
export const ADMIN_CREDENTIALS_STORAGE_KEY = 'hms_admin_credentials_store_v1';

export const INITIAL_ADMIN_CREDENTIALS: AdminCredential[] = [
  { adminUserId: 'ADM-001', username: 'superadmin', password: '123456', updatedAt: '01 Jan 2024, 09:00 AM' },
  { adminUserId: 'ADM-002', username: 'sharif.clinical', password: '123456', updatedAt: '01 Jan 2024, 10:00 AM' },
  { adminUserId: 'ADM-003', username: 'admin', password: '123456', updatedAt: '15 Feb 2024, 09:00 AM' },
  { adminUserId: 'ADM-004', username: 'bilal.operations', password: '123456', updatedAt: '01 Mar 2024, 09:30 AM' },
  { adminUserId: 'ADM-005', username: 'rashid.admin', password: '123456', updatedAt: '10 Apr 2024, 11:00 AM' },
  { adminUserId: 'ADM-006', username: 'zainab.admin', password: '123456', updatedAt: '01 May 2024, 10:30 AM' },
  { adminUserId: 'ADM-007', username: 'tariq.trainee', password: '123456', updatedAt: '07 Sep 2026, 11:30 AM' },
];

export const INITIAL_ADMIN_USERS: AdminUser[] = [
  {
    id: 'ADM-001',
    employeeCode: 'EMP-SA-01',
    fullName: 'Prof. Dr. Tariq Saeed',
    username: 'superadmin',
    email: 'superadmin@sharif-saeed.hospital',
    phone: '+92 300 1234567',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    isProtectedSuperAdmin: true,
    lastLoginAt: '09 Sep 2026, 08:30 AM',
    lastLoginIpPlaceholder: '192.168.10.42 (Hospital Executive LAN)',
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2024, 09:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '08 Sep 2026, 06:15 PM',
    linkedActivityCount: 142,
  },
  {
    id: 'ADM-002',
    employeeCode: 'EMP-SA-02',
    fullName: 'Dr. M. Sharif Chaudhary',
    username: 'sharif.clinical',
    email: 'sharif.chaudhary@sharif-saeed.hospital',
    phone: '+92 300 8887654',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    isProtectedSuperAdmin: true,
    lastLoginAt: '08 Sep 2026, 02:30 PM',
    lastLoginIpPlaceholder: '192.168.10.45 (Hospital Executive LAN)',
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2024, 10:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '04 Sep 2026, 03:20 PM',
    linkedActivityCount: 88,
  },
  {
    id: 'ADM-003',
    employeeCode: 'EMP-ADM-01',
    fullName: 'Dr. Farhana Yasmeen',
    username: 'admin',
    email: 'admin@sharif-saeed.hospital',
    phone: '+92 321 9876543',
    role: 'ADMIN',
    status: 'ACTIVE',
    isProtectedSuperAdmin: false,
    lastLoginAt: '09 Sep 2026, 08:45 AM',
    lastLoginIpPlaceholder: '192.168.20.15 (Medical Admin Office)',
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '15 Jan 2024, 09:30 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '05 Sep 2026, 11:20 AM',
    linkedActivityCount: 64,
  },
  {
    id: 'ADM-004',
    employeeCode: 'EMP-ADM-02',
    fullName: 'Engr. Bilal Ahmed',
    username: 'bilal.operations',
    email: 'bilal.ahmed@sharif-saeed.hospital',
    phone: '+92 333 5551234',
    role: 'ADMIN',
    status: 'ACTIVE',
    isProtectedSuperAdmin: false,
    lastLoginAt: '08 Sep 2026, 04:45 PM',
    lastLoginIpPlaceholder: '192.168.20.22 (Operations Desk)',
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Feb 2024, 11:00 AM',
    updatedBy: 'Dr. Farhana Yasmeen (Admin)',
    updatedAt: '06 Sep 2026, 09:10 AM',
    linkedActivityCount: 31,
  },
  {
    id: 'ADM-005',
    employeeCode: 'EMP-ADM-03',
    fullName: 'Rashid Mehmood',
    username: 'rashid.admin',
    email: 'rashid.mehmood@sharif-saeed.hospital',
    phone: '+92 345 7771234',
    role: 'ADMIN',
    status: 'SUSPENDED',
    isProtectedSuperAdmin: false,
    lastLoginAt: '20 Aug 2026, 10:15 AM',
    lastLoginIpPlaceholder: '192.168.20.30',
    createdBy: 'Dr. Farhana Yasmeen (Admin)',
    createdAt: '10 Mar 2024, 02:00 PM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '21 Aug 2026, 09:00 AM',
    statusChangedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    statusChangedAt: '21 Aug 2026, 09:00 AM',
    linkedActivityCount: 12,
  },
  {
    id: 'ADM-006',
    employeeCode: 'EMP-ADM-04',
    fullName: 'Zainab Batool',
    username: 'zainab.admin',
    email: 'zainab.batool@sharif-saeed.hospital',
    phone: '+92 312 4449876',
    role: 'ADMIN',
    status: 'INACTIVE',
    isProtectedSuperAdmin: false,
    lastLoginAt: '15 Jul 2026, 03:40 PM',
    lastLoginIpPlaceholder: '192.168.20.18',
    createdBy: 'Dr. Farhana Yasmeen (Admin)',
    createdAt: '01 May 2024, 10:30 AM',
    updatedBy: 'Dr. Farhana Yasmeen (Admin)',
    updatedAt: '01 Aug 2026, 05:00 PM',
    statusChangedBy: 'Dr. Farhana Yasmeen (Admin)',
    statusChangedAt: '01 Aug 2026, 05:00 PM',
    linkedActivityCount: 5,
  },
  {
    id: 'ADM-007',
    employeeCode: 'EMP-ADM-05',
    fullName: 'Tariq Jameel (Trainee)',
    username: 'tariq.trainee',
    email: 'tariq.trainee@sharif-saeed.hospital',
    phone: '+92 301 9991234',
    role: 'ADMIN',
    status: 'ACTIVE',
    isProtectedSuperAdmin: false,
    lastLoginAt: 'Never',
    createdBy: 'Dr. Farhana Yasmeen (Admin)',
    createdAt: '07 Sep 2026, 11:30 AM',
    updatedBy: 'Dr. Farhana Yasmeen (Admin)',
    updatedAt: '07 Sep 2026, 11:30 AM',
    linkedActivityCount: 0,
  },
];

export function formatAuditUser(currentUser?: User | null): string {
  if (!currentUser) {
    throw new Error('Authentication required: No authenticated user session found.');
  }
  const name = currentUser.name?.trim() || currentUser.username || 'Administrator';
  const role = currentUser.role || 'Admin';
  return `${name} (${role})`;
}

export function formatAuditTimestamp(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${day} ${month} ${year}, ${time}`;
}

export class AdminUserService {
  // --------------------------------------------------------------------------
  // Retrieval & Persistence
  // --------------------------------------------------------------------------
  static getAdminUsers(): AdminUser[] {
    try {
      const stored = localStorage.getItem(ADMIN_USERS_STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(ADMIN_USERS_STORAGE_KEY, JSON.stringify(INITIAL_ADMIN_USERS));
        return INITIAL_ADMIN_USERS;
      }
      const parsed: AdminUser[] = JSON.parse(stored);
      // Ensure root superadmin is always protected
      return parsed.map((u) => ({
        ...u,
        isProtectedSuperAdmin: u.role === 'SUPER_ADMIN',
      }));
    } catch (err) {
      console.error('Failed to load admin users:', err);
      return INITIAL_ADMIN_USERS;
    }
  }

  static saveAdminUsers(users: AdminUser[]): void {
    try {
      localStorage.setItem(ADMIN_USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (err) {
      console.error('Failed to save admin users:', err);
    }
  }

  static getAdminUserById(id: string): AdminUser | undefined {
    return this.getAdminUsers().find((u) => u.id === id);
  }

  static getAdminUserByUsername(username: string): AdminUser | undefined {
    return this.getAdminUsers().find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );
  }

  // --------------------------------------------------------------------------
  // Administrative Credentials Persistence (Isolated from Master Profile)
  // --------------------------------------------------------------------------
  static getCredentials(): AdminCredential[] {
    try {
      const stored = localStorage.getItem(ADMIN_CREDENTIALS_STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(
          ADMIN_CREDENTIALS_STORAGE_KEY,
          JSON.stringify(INITIAL_ADMIN_CREDENTIALS)
        );
        return INITIAL_ADMIN_CREDENTIALS;
      }
      return JSON.parse(stored);
    } catch (err) {
      console.error('Failed to load admin credentials:', err);
      return INITIAL_ADMIN_CREDENTIALS;
    }
  }

  static saveCredentials(creds: AdminCredential[]): void {
    try {
      localStorage.setItem(ADMIN_CREDENTIALS_STORAGE_KEY, JSON.stringify(creds));
    } catch (err) {
      console.error('Failed to save admin credentials:', err);
    }
  }

  static getCredentialByUsername(username: string): AdminCredential | undefined {
    const creds = this.getCredentials();
    const clean = username.trim().toLowerCase();
    return creds.find((c) => c.username.toLowerCase() === clean);
  }

  static getCredentialByUserId(userId: string): AdminCredential | undefined {
    const creds = this.getCredentials();
    return creds.find((c) => c.adminUserId === userId);
  }

  static setCredential(
    adminUserId: string,
    username: string,
    password: string,
    requirePasswordChange = false
  ): void {
    const creds = this.getCredentials();
    const cleanUsername = username.trim().toLowerCase();
    const existingIdx = creds.findIndex(
      (c) => c.adminUserId === adminUserId || c.username.toLowerCase() === cleanUsername
    );
    const newCred: AdminCredential = {
      adminUserId,
      username: cleanUsername,
      password,
      requirePasswordChange,
      updatedAt: formatAuditTimestamp(),
    };
    let updated: AdminCredential[];
    if (existingIdx >= 0) {
      updated = [...creds];
      updated[existingIdx] = newCred;
    } else {
      updated = [...creds, newCred];
    }
    this.saveCredentials(updated);
  }

  static removeCredential(adminUserId: string): void {
    const creds = this.getCredentials();
    const updated = creds.filter((c) => c.adminUserId !== adminUserId);
    this.saveCredentials(updated);
  }

  static recordLogin(adminUserId: string): void {
    const users = this.getAdminUsers();
    const target = users.find((u) => u.id === adminUserId);
    if (!target) return;
    const now = new Date();
    const timeStr = formatAuditTimestamp(now);
    const updatedUser: AdminUser = {
      ...target,
      lastLoginAt: timeStr,
    };
    this.saveAdminUsers(users.map((u) => (u.id === adminUserId ? updatedUser : u)));
    this.recordAuditLog({
      actionType: 'CREATE_ADMIN',
      actorUserId: target.id,
      actorName: `${target.fullName} (${target.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'})`,
      targetUserId: target.id,
      targetName: target.fullName,
      details: `User session authenticated successfully to hospital portal.`,
    });
  }

  // --------------------------------------------------------------------------
  // Audit Logs Persistence
  // --------------------------------------------------------------------------
  static getAuditLogs(): AdminUserAuditLogEntry[] {
    try {
      const stored = localStorage.getItem(ADMIN_AUDIT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static recordAuditLog(entry: Omit<AdminUserAuditLogEntry, 'id' | 'timestamp'>): void {
    try {
      const logs = this.getAuditLogs();
      const newEntry: AdminUserAuditLogEntry = {
        ...entry,
        id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        timestamp: formatAuditTimestamp(),
      };
      const updated = [newEntry, ...logs].slice(0, 200); // keep recent 200
      localStorage.setItem(ADMIN_AUDIT_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to record audit log:', err);
    }
  }

  // --------------------------------------------------------------------------
  // Security & Authorization Guards
  // --------------------------------------------------------------------------
  static isActorSuperAdmin(currentUser?: User | null): boolean {
    if (!currentUser) return false; // Fail closed: unauthenticated or missing actor is never Super Admin
    const roleStr = String(currentUser.role || '').toUpperCase();
    return roleStr === 'SUPER ADMIN' || roleStr === 'SUPER_ADMIN';
  }

  /**
   * Evaluates if the current actor is permitted to modify/deactivate/delete the target user.
   */
  static canActorModifyTarget(
    currentUser: User | null | undefined,
    target: AdminUser
  ): { allowed: boolean; reason?: string } {
    if (!currentUser) {
      return {
        allowed: false,
        reason: 'Authentication required to modify administrative users.',
      };
    }

    const actorIsSuperAdmin = this.isActorSuperAdmin(currentUser);

    // If target is a Super Admin and actor is NOT a Super Admin
    if (target.role === 'SUPER_ADMIN' && !actorIsSuperAdmin) {
      return {
        allowed: false,
        reason:
          'This Super Admin account is protected and cannot be modified by an Admin user.',
      };
    }

    return { allowed: true };
  }

  /**
   * Validates that current user is not attempting self-deletion or self-deactivation.
   */
  static validateSelfAction(
    currentUser: User | null | undefined,
    target: AdminUser
  ): { allowed: boolean; reason?: string } {
    if (!currentUser) {
      return {
        allowed: false,
        reason: 'Authentication required to perform this action.',
      };
    }

    const isSameId = currentUser.id && target.id && currentUser.id === target.id;
    const isSameUsername =
      currentUser.username &&
      target.username &&
      currentUser.username.trim().toLowerCase() === target.username.trim().toLowerCase();

    if (isSameId || isSameUsername) {
      return {
        allowed: false,
        reason: 'You cannot disable your currently active account.',
      };
    }

    return { allowed: true };
  }

  /**
   * Prevents disabling, deleting, or demoting the last active Super Admin account.
   */
  static validateLastActiveSuperAdmin(
    users: AdminUser[],
    targetId: string,
    isDemotingOrDeactivating: boolean
  ): { allowed: boolean; reason?: string } {
    if (!isDemotingOrDeactivating) return { allowed: true };

    const target = users.find((u) => u.id === targetId);
    if (!target || target.role !== 'SUPER_ADMIN' || target.status !== 'ACTIVE') {
      return { allowed: true };
    }

    const activeSuperAdmins = users.filter(
      (u) => u.role === 'SUPER_ADMIN' && u.status === 'ACTIVE'
    );

    if (activeSuperAdmins.length <= 1) {
      return {
        allowed: false,
        reason: 'At least one active Super Admin account must remain in the system.',
      };
    }

    return { allowed: true };
  }

  // --------------------------------------------------------------------------
  // Field Validations
  // --------------------------------------------------------------------------
  static validateUsername(
    username: string,
    currentId?: string
  ): { isValid: boolean; message?: string } {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      return { isValid: false, message: 'Username is required.' };
    }
    if (trimmed.length < 3) {
      return { isValid: false, message: 'Username must be at least 3 characters.' };
    }
    if (!/^[a-z0-9._-]+$/.test(trimmed)) {
      return {
        isValid: false,
        message: 'Username may only contain letters, numbers, dots, hyphens, and underscores.',
      };
    }

    const users = this.getAdminUsers();
    const isDup = users.some(
      (u) => u.username.toLowerCase() === trimmed && u.id !== currentId
    );
    if (isDup) {
      return { isValid: false, message: 'Username is already in use.' };
    }

    return { isValid: true };
  }

  static validateEmail(
    email: string,
    currentId?: string
  ): { isValid: boolean; message?: string } {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return { isValid: false, message: 'Email address is required.' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { isValid: false, message: 'Please enter a valid email address.' };
    }

    const users = this.getAdminUsers();
    const isDup = users.some(
      (u) => u.email.toLowerCase() === trimmed && u.id !== currentId
    );
    if (isDup) {
      return { isValid: false, message: 'An account with this email already exists.' };
    }

    return { isValid: true };
  }

  static validateEmployeeCode(
    code: string,
    currentId?: string
  ): { isValid: boolean; message?: string } {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { isValid: true }; // Optional field

    const users = this.getAdminUsers();
    const isDup = users.some(
      (u) => u.employeeCode && u.employeeCode.toUpperCase() === trimmed && u.id !== currentId
    );
    if (isDup) {
      return { isValid: false, message: `Employee code "${trimmed}" already exists.` };
    }

    return { isValid: true };
  }

  static validatePassword(password: string): { isValid: boolean; message?: string } {
    if (!password) {
      return { isValid: false, message: 'Password is required.' };
    }
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long.' };
    }
    if (!/[A-Za-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one letter.' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number.' };
    }
    return { isValid: true };
  }

  // --------------------------------------------------------------------------
  // CRUD Operations
  // --------------------------------------------------------------------------
  static createAdmin(
    values: AdminUserFormValues,
    currentUser?: User | null
  ): AdminUser {
    if (!currentUser) {
      throw new Error('Authentication required: You must be signed in to create administrative users.');
    }

    const actorIsSuperAdmin = this.isActorSuperAdmin(currentUser);

    // Guard: Admin cannot create Super Admin
    if (values.role === 'SUPER_ADMIN' && !actorIsSuperAdmin) {
      throw new Error('This Super Admin account is protected and cannot be created by an Admin user.');
    }

    // Name validation
    if (!values.fullName.trim()) {
      throw new Error('Full Name is required.');
    }

    // Username validation
    const userCheck = this.validateUsername(values.username);
    if (!userCheck.isValid) throw new Error(userCheck.message);

    // Email validation
    const emailCheck = this.validateEmail(values.email);
    if (!emailCheck.isValid) throw new Error(emailCheck.message);

    // Employee Code validation
    if (values.employeeCode) {
      const codeCheck = this.validateEmployeeCode(values.employeeCode);
      if (!codeCheck.isValid) throw new Error(codeCheck.message);
    }

    // Password validation
    const pwdCheck = this.validatePassword(values.password || '');
    if (!pwdCheck.isValid) throw new Error(pwdCheck.message);

    if (values.password !== values.confirmPassword) {
      throw new Error('Password and Confirm Password must match.');
    }

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();
    const users = this.getAdminUsers();

    // Auto-generate employee code if missing
    const generatedEmpCode =
      values.employeeCode?.trim().toUpperCase() ||
      (values.role === 'SUPER_ADMIN'
        ? `EMP-SA-0${users.length + 1}`
        : `EMP-ADM-0${users.length + 1}`);

    const newAdmin: AdminUser = {
      id: `ADM-00${users.length + 1}`,
      employeeCode: generatedEmpCode,
      fullName: values.fullName.trim(),
      username: values.username.trim().toLowerCase(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim() || '+92 300 0000000',
      role: values.role,
      status: values.status || 'ACTIVE',
      isProtectedSuperAdmin: values.role === 'SUPER_ADMIN',
      lastLoginAt: 'Never',
      createdBy: auditUser,
      createdAt: auditTime,
      updatedBy: auditUser,
      updatedAt: auditTime,
      requirePasswordChangeOnLogin: !!values.requirePasswordChangeOnLogin,
      linkedActivityCount: 0,
    };

    const updated = [newAdmin, ...users];
    this.saveAdminUsers(updated);

    // Persist credentials in isolated credential store
    this.setCredential(
      newAdmin.id,
      newAdmin.username,
      values.password!,
      !!values.requirePasswordChangeOnLogin
    );

    this.recordAuditLog({
      actionType: 'CREATE_ADMIN',
      actorUserId: currentUser.id,
      actorName: auditUser,
      targetUserId: newAdmin.id,
      targetName: newAdmin.fullName,
      details: `Provisioned new administrative user with role ${newAdmin.role} and status ${newAdmin.status}.`,
    });

    return newAdmin;
  }

  static updateAdmin(
    id: string,
    values: AdminUserFormValues,
    currentUser?: User | null
  ): AdminUser {
    if (!currentUser) {
      throw new Error('Authentication required: You must be signed in to update administrative users.');
    }

    const users = this.getAdminUsers();
    const existing = users.find((u) => u.id === id);
    if (!existing) throw new Error('Administrative user not found.');

    // Guard: Target protection against non-SuperAdmin modification
    const modifyCheck = this.canActorModifyTarget(currentUser, existing);
    if (!modifyCheck.allowed) {
      throw new Error(modifyCheck.reason);
    }

    const actorIsSuperAdmin = this.isActorSuperAdmin(currentUser);

    // Guard: Admin cannot promote any account to Super Admin
    if (values.role === 'SUPER_ADMIN' && !actorIsSuperAdmin) {
      throw new Error('This Super Admin account is protected and cannot be modified by an Admin user.');
    }

    // Guard: Demotion of last active superadmin
    if (existing.role === 'SUPER_ADMIN' && values.role !== 'SUPER_ADMIN') {
      const lastCheck = this.validateLastActiveSuperAdmin(users, id, true);
      if (!lastCheck.allowed) throw new Error(lastCheck.reason);
    }

    // Name check
    if (!values.fullName.trim()) {
      throw new Error('Full Name is required.');
    }

    // Username check
    const userCheck = this.validateUsername(values.username, id);
    if (!userCheck.isValid) throw new Error(userCheck.message);

    // Email check
    const emailCheck = this.validateEmail(values.email, id);
    if (!emailCheck.isValid) throw new Error(emailCheck.message);

    // Employee code check
    if (values.employeeCode) {
      const codeCheck = this.validateEmployeeCode(values.employeeCode, id);
      if (!codeCheck.isValid) throw new Error(codeCheck.message);
    }

    // Status change safety: cannot deactivate/suspend self
    if (values.status !== existing.status && (values.status === 'INACTIVE' || values.status === 'SUSPENDED')) {
      const selfCheck = this.validateSelfAction(currentUser, existing);
      if (!selfCheck.allowed) throw new Error(selfCheck.reason);

      const lastCheck = this.validateLastActiveSuperAdmin(users, id, true);
      if (!lastCheck.allowed) throw new Error(lastCheck.reason);
    }

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const roleChanged = existing.role !== values.role;
    const statusChanged = existing.status !== values.status;

    const updatedUser: AdminUser = {
      ...existing,
      fullName: values.fullName.trim(),
      employeeCode: values.employeeCode?.trim().toUpperCase() || existing.employeeCode,
      username: values.username.trim().toLowerCase(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone?.trim() || existing.phone,
      role: values.role,
      status: values.status,
      isProtectedSuperAdmin: values.role === 'SUPER_ADMIN',
      updatedBy: auditUser,
      updatedAt: auditTime,
      statusChangedBy: statusChanged ? auditUser : existing.statusChangedBy,
      statusChangedAt: statusChanged ? auditTime : existing.statusChangedAt,
    };

    const nextUsers = users.map((u) => (u.id === id ? updatedUser : u));
    this.saveAdminUsers(nextUsers);

    // Synchronize username in credential store if changed
    if (existing.username.toLowerCase() !== values.username.trim().toLowerCase()) {
      const cred = this.getCredentialByUserId(id);
      if (cred) {
        this.setCredential(
          id,
          values.username.trim().toLowerCase(),
          cred.password,
          cred.requirePasswordChange
        );
      }
    }

    this.recordAuditLog({
      actionType: roleChanged ? 'CHANGE_ROLE' : 'UPDATE_ADMIN',
      actorUserId: currentUser.id,
      actorName: auditUser,
      targetUserId: updatedUser.id,
      targetName: updatedUser.fullName,
      details: roleChanged
        ? `Role updated from ${existing.role} to ${updatedUser.role}.`
        : `Administrative profile attributes updated.`,
    });

    return updatedUser;
  }

  static resetPassword(
    id: string,
    newPassword: string,
    confirmPassword: string,
    requireChange: boolean,
    currentUser?: User | null
  ): { success: boolean; message: string } {
    if (!currentUser) {
      throw new Error('Authentication required: You must be signed in to reset passwords.');
    }

    const users = this.getAdminUsers();
    const existing = users.find((u) => u.id === id);
    if (!existing) throw new Error('Administrative user not found.');

    // Security Guard: Admin can NEVER reset a Super Admin's password
    const modifyCheck = this.canActorModifyTarget(currentUser, existing);
    if (!modifyCheck.allowed) {
      throw new Error(modifyCheck.reason);
    }

    // Password validation
    const pwdCheck = this.validatePassword(newPassword);
    if (!pwdCheck.isValid) throw new Error(pwdCheck.message);

    if (newPassword !== confirmPassword) {
      throw new Error('Password and Confirm Password must match.');
    }

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const updatedUser: AdminUser = {
      ...existing,
      passwordResetBy: auditUser,
      passwordResetAt: auditTime,
      requirePasswordChangeOnLogin: !!requireChange,
      updatedBy: auditUser,
      updatedAt: auditTime,
    };

    const nextUsers = users.map((u) => (u.id === id ? updatedUser : u));
    this.saveAdminUsers(nextUsers);

    // Persist new credential into isolated store
    this.setCredential(existing.id, existing.username, newPassword, !!requireChange);

    this.recordAuditLog({
      actionType: 'RESET_PASSWORD',
      actorUserId: currentUser.id,
      actorName: auditUser,
      targetUserId: existing.id,
      targetName: existing.fullName,
      details: `Temporary password reset performed. Require password change on first login: ${requireChange ? 'Yes' : 'No'}.`,
    });

    return {
      success: true,
      message: 'Temporary password updated successfully.',
    };
  }

  static changeStatus(
    id: string,
    newStatus: AdminUserStatus,
    currentUser?: User | null
  ): { success: boolean; user: AdminUser } {
    if (!currentUser) {
      throw new Error('Authentication required: You must be signed in to change user status.');
    }

    const users = this.getAdminUsers();
    const existing = users.find((u) => u.id === id);
    if (!existing) throw new Error('Administrative user not found.');

    // Guard: Admin cannot change Super Admin status
    const modifyCheck = this.canActorModifyTarget(currentUser, existing);
    if (!modifyCheck.allowed) {
      throw new Error(modifyCheck.reason);
    }

    // Guard: Self-action restriction
    if (newStatus === 'INACTIVE' || newStatus === 'SUSPENDED') {
      const selfCheck = this.validateSelfAction(currentUser, existing);
      if (!selfCheck.allowed) {
        throw new Error(selfCheck.reason);
      }

      // Guard: Cannot deactivate or suspend last active super admin
      const lastCheck = this.validateLastActiveSuperAdmin(users, id, true);
      if (!lastCheck.allowed) {
        throw new Error(lastCheck.reason);
      }
    }

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const updatedUser: AdminUser = {
      ...existing,
      status: newStatus,
      statusChangedBy: auditUser,
      statusChangedAt: auditTime,
      updatedBy: auditUser,
      updatedAt: auditTime,
    };

    const nextUsers = users.map((u) => (u.id === id ? updatedUser : u));
    this.saveAdminUsers(nextUsers);

    const actionType =
      newStatus === 'ACTIVE'
        ? 'ACTIVATE_ADMIN'
        : newStatus === 'SUSPENDED'
        ? 'SUSPEND_ADMIN'
        : 'DEACTIVATE_ADMIN';

    this.recordAuditLog({
      actionType,
      actorUserId: currentUser.id,
      actorName: auditUser,
      targetUserId: existing.id,
      targetName: existing.fullName,
      details: `Administrative account status transitioned to ${newStatus}.`,
    });

    return { success: true, user: updatedUser };
  }

  static deleteAdmin(
    id: string,
    currentUser?: User | null
  ): { success: boolean; message?: string } {
    if (!currentUser) {
      return {
        success: false,
        message: 'Authentication required to delete administrative accounts.',
      };
    }

    const users = this.getAdminUsers();
    const existing = users.find((u) => u.id === id);
    if (!existing) return { success: false, message: 'User not found.' };

    // Security Guard: Admin cannot delete Super Admin
    const modifyCheck = this.canActorModifyTarget(currentUser, existing);
    if (!modifyCheck.allowed) {
      return { success: false, message: modifyCheck.reason };
    }

    // Guard: Self-action
    const selfCheck = this.validateSelfAction(currentUser, existing);
    if (!selfCheck.allowed) {
      return { success: false, message: selfCheck.reason };
    }

    // Guard: Last active Super Admin
    const lastCheck = this.validateLastActiveSuperAdmin(users, id, true);
    if (!lastCheck.allowed) {
      return { success: false, message: lastCheck.reason };
    }

    // Guard: Linked activity safeguard
    if ((existing.linkedActivityCount ?? 0) > 0) {
      return {
        success: false,
        message:
          'This account has recorded system activity and cannot be permanently deleted. Deactivate it instead.',
      };
    }

    const nextUsers = users.filter((u) => u.id !== id);
    this.saveAdminUsers(nextUsers);

    // Remove credential
    this.removeCredential(id);

    const auditUser = formatAuditUser(currentUser);
    this.recordAuditLog({
      actionType: 'DELETE_ADMIN',
      actorUserId: currentUser.id,
      actorName: auditUser,
      targetUserId: existing.id,
      targetName: existing.fullName,
      details: `Admin user permanently deleted from directory.`,
    });

    return { success: true };
  }

  // --------------------------------------------------------------------------
  // Import Workflow (CRITICAL: ROLE IS ALWAYS ADMIN, NEVER SUPER ADMIN)
  // --------------------------------------------------------------------------
  static generateTemporaryPassword(): string {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    const numbers = '23456789';
    let res = '';
    for (let i = 0; i < 6; i++) {
      res += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < 3; i++) {
      res += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    return res;
  }

  static validateImportRow(
    row: Partial<ImportedAdminRow>,
    existingUsers: AdminUser[],
    stagedUsernames: Set<string>,
    stagedEmails: Set<string>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Full name
    if (!row.fullName || !row.fullName.trim()) {
      errors.push('Full name is required.');
    }

    // Username
    const username = row.username?.trim().toLowerCase();
    if (!username) {
      errors.push('Username is required.');
    } else if (username.length < 3) {
      errors.push('Username must be at least 3 characters.');
    } else if (!/^[a-z0-9._-]+$/.test(username)) {
      errors.push('Username contains invalid characters.');
    } else if (
      existingUsers.some((u) => u.username.toLowerCase() === username) ||
      stagedUsernames.has(username)
    ) {
      errors.push('Duplicate username.');
    }

    // Email
    const email = row.email?.trim().toLowerCase();
    if (!email) {
      errors.push('Email is required.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Invalid email format.');
    } else if (
      existingUsers.some((u) => u.email.toLowerCase() === email) ||
      stagedEmails.has(email)
    ) {
      errors.push('Duplicate email.');
    }

    // Status
    if (
      row.status &&
      row.status !== 'ACTIVE' &&
      row.status !== 'INACTIVE' &&
      row.status !== 'SUSPENDED'
    ) {
      errors.push('Invalid status (must be ACTIVE, INACTIVE, or SUSPENDED).');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static executeAdminImport(
    validRows: ImportedAdminRow[],
    currentUser?: User | null
  ): {
    success: boolean;
    count: number;
    credentials: { fullName: string; username: string; tempPassword: string }[];
  } {
    if (!currentUser) {
      throw new Error('Authentication required: You must be signed in to import administrative users.');
    }

    const users = this.getAdminUsers();
    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const credentialsList: {
      fullName: string;
      username: string;
      tempPassword: string;
    }[] = [];

    const newAdmins: AdminUser[] = validRows.map((r, index) => {
      const tempPass = r.tempPassword || this.generateTemporaryPassword();
      credentialsList.push({
        fullName: r.fullName.trim(),
        username: r.username.trim().toLowerCase(),
        tempPassword: tempPass,
      });

      return {
        id: `ADM-00${users.length + index + 1}`,
        employeeCode:
          r.employeeCode?.trim().toUpperCase() || `EMP-ADM-0${users.length + index + 1}`,
        fullName: r.fullName.trim(),
        username: r.username.trim().toLowerCase(),
        email: r.email.trim().toLowerCase(),
        phone: r.phone?.trim() || '+92 300 0000000',
        // CRITICAL: ALWAYS ADMIN, NEVER SUPER ADMIN
        role: 'ADMIN',
        status: r.status || 'ACTIVE',
        isProtectedSuperAdmin: false,
        lastLoginAt: 'Never',
        createdBy: auditUser,
        createdAt: auditTime,
        updatedBy: auditUser,
        updatedAt: auditTime,
        requirePasswordChangeOnLogin: true,
        linkedActivityCount: 0,
      };
    });

    const updatedUsers = [...newAdmins, ...users];
    this.saveAdminUsers(updatedUsers);

    // Save credentials into credential store
    credentialsList.forEach((c, idx) => {
      const admin = newAdmins[idx];
      this.setCredential(admin.id, admin.username, c.tempPassword, true);
    });

    this.recordAuditLog({
      actionType: 'IMPORT_ADMINS',
      actorUserId: currentUser.id,
      actorName: auditUser,
      targetUserId: 'BULK',
      targetName: `${newAdmins.length} Imported Admins`,
      details: `Bulk imported ${newAdmins.length} standard Admin accounts with temporary credentials.`,
    });

    return {
      success: true,
      count: newAdmins.length,
      credentials: credentialsList,
    };
  }

  // --------------------------------------------------------------------------
  // Combined Filtering Logic (Logical AND)
  // --------------------------------------------------------------------------
  static filterAdminUsers(
    users: AdminUser[],
    filters: AdminUserFilterState
  ): AdminUser[] {
    const query = filters.searchTerm.trim().toLowerCase();

    return users.filter((u) => {
      // 1. Search Query: User ID / Employee Code, Full Name, Username, Email, Phone
      if (query) {
        const mId = u.id.toLowerCase().includes(query);
        const mCode = u.employeeCode ? u.employeeCode.toLowerCase().includes(query) : false;
        const mName = u.fullName.toLowerCase().includes(query);
        const mUser = u.username.toLowerCase().includes(query);
        const mEmail = u.email.toLowerCase().includes(query);
        const mPhone = u.phone ? u.phone.toLowerCase().includes(query) : false;

        if (!mId && !mCode && !mName && !mUser && !mEmail && !mPhone) {
          return false;
        }
      }

      // 2. Role Filter
      if (filters.role !== 'ALL') {
        if (u.role !== filters.role) return false;
      }

      // 3. Status Filter
      if (filters.status !== 'ALL') {
        if (u.status !== filters.status) return false;
      }

      return true;
    });
  }
}
