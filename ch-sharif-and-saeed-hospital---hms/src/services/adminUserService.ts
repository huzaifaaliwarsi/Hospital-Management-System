import apiClient from './apiClient';
import {
  AdminUser,
  AdminUserFilterState,
  AdminUserFormValues,
  ImportedAdminRow,
} from '../types/adminUser';
import { User } from '../types';
import { formatDisplayDate } from '../utils/dateConstants';

/**
 * Live Admin Users service — every read/write round-trips through
 * `/api/v1/portal-users*`, filtered to the Admin-tier roles
 * (`SUPER_ADMIN`, `ADMIN`). Same in-memory-cache pattern as the other
 * rewired Super Admin services — never localStorage, no fabricated
 * credentials/audit-log store. The backend's real `AuditLog` table
 * (populated automatically for every mutating request, see `app.ts`'s
 * `auditLog` middleware) is the actual audit trail now; there is no
 * client-facing read endpoint for it yet (tracked in the completion plan).
 */

const ADMIN_ROLES = 'SUPER_ADMIN,ADMIN';

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dateStr = formatDisplayDate(d);
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

/**
 * Maps a backend PortalUser row onto the frontend `AdminUser` shape.
 * `employeeCode` has no real backend equivalent for accounts with no linked
 * Staff record (e.g. the root Super Admin) — it falls back to a stable,
 * id-derived display code rather than being fabricated business data.
 */
function toAdminUser(raw: Record<string, any>): AdminUser {
  return {
    id: raw.id,
    employeeCode: raw.staff?.employeeId || `ADM-${String(raw.id).slice(0, 8).toUpperCase()}`,
    fullName: raw.displayName || raw.staff?.fullName || raw.username,
    username: raw.username,
    email: raw.email || '',
    phone: raw.phone || '',
    role: raw.role,
    status: raw.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
    isProtectedSuperAdmin: !!raw.isProtected,
    lastLoginAt: raw.lastLoginAt ? formatTimestamp(raw.lastLoginAt) : 'Never',
    createdBy: raw.createdBy || 'System',
    createdAt: formatTimestamp(raw.createdAt),
    updatedBy: raw.updatedBy || 'System',
    updatedAt: formatTimestamp(raw.updatedAt),
    passwordResetBy: raw.passwordResetBy || undefined,
    passwordResetAt: raw.passwordResetAt ? formatTimestamp(raw.passwordResetAt) : undefined,
    requirePasswordChangeOnLogin: !!raw.mustResetPassword,
    linkedActivityCount: 0,
  };
}

let cachedAdminUsers: AdminUser[] = [];

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const res = await apiClient.get<{ data: Record<string, any>[] }>('/portal-users', { params: { roles: ADMIN_ROLES, pageSize: 100 } });
  cachedAdminUsers = res.data.data.map(toAdminUser);
  return cachedAdminUsers;
}

export async function primeAdminUsersCache(): Promise<void> {
  try {
    await fetchAdminUsers();
  } catch {
    // Leave cache empty; the Admin Users page itself will surface the real error on its own fetch.
  }
}

export class AdminUserService {
  static getAdminUsers(): AdminUser[] {
    return cachedAdminUsers;
  }

  static getAdminUserById(id: string): AdminUser | undefined {
    return cachedAdminUsers.find((u) => u.id === id);
  }

  static getAdminUserByUsername(username: string): AdminUser | undefined {
    return cachedAdminUsers.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  }

  static isActorSuperAdmin(currentUser?: User | null): boolean {
    if (!currentUser) return false;
    const roleStr = String(currentUser.role || '').toUpperCase();
    return roleStr === 'SUPER ADMIN' || roleStr === 'SUPER_ADMIN';
  }

  /** Best-effort UX guard — the backend's `isProtected` flag is the real enforcement (§3.2). */
  static canActorModifyTarget(currentUser: User | null | undefined, target: AdminUser): { allowed: boolean; reason?: string } {
    if (!currentUser) return { allowed: false, reason: 'Authentication required to modify administrative users.' };
    if (target.isProtectedSuperAdmin) {
      return { allowed: false, reason: 'This account is protected and cannot be modified.' };
    }
    return { allowed: true };
  }

  static validateSelfAction(currentUser: User | null | undefined, target: AdminUser): { allowed: boolean; reason?: string } {
    if (!currentUser) return { allowed: false, reason: 'Authentication required to perform this action.' };
    const isSameUsername = currentUser.username && target.username && currentUser.username.trim().toLowerCase() === target.username.trim().toLowerCase();
    if (isSameUsername) return { allowed: false, reason: 'You cannot disable your currently active account.' };
    return { allowed: true };
  }

  static validateUsername(username: string, currentId?: string): { isValid: boolean; message?: string } {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) return { isValid: false, message: 'Username is required.' };
    if (trimmed.length < 3) return { isValid: false, message: 'Username must be at least 3 characters.' };
    if (!/^[a-z0-9._-]+$/.test(trimmed)) {
      return { isValid: false, message: 'Username may only contain letters, numbers, dots, hyphens, and underscores.' };
    }
    if (cachedAdminUsers.some((u) => u.username.toLowerCase() === trimmed && u.id !== currentId)) {
      return { isValid: false, message: 'Username is already in use.' };
    }
    return { isValid: true };
  }

  static validateEmail(email: string, currentId?: string): { isValid: boolean; message?: string } {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return { isValid: false, message: 'Email address is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { isValid: false, message: 'Please enter a valid email address.' };
    if (cachedAdminUsers.some((u) => u.email.toLowerCase() === trimmed && u.id !== currentId)) {
      return { isValid: false, message: 'An account with this email already exists.' };
    }
    return { isValid: true };
  }

  /** Employee codes are display-only for Admin accounts (see `toAdminUser`) — this only guards against local duplicates. */
  static validateEmployeeCode(code: string, currentId?: string): { isValid: boolean; message?: string } {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { isValid: true };
    if (cachedAdminUsers.some((u) => u.employeeCode?.toUpperCase() === trimmed && u.id !== currentId)) {
      return { isValid: false, message: `Employee code "${trimmed}" already exists.` };
    }
    return { isValid: true };
  }

  static validatePassword(password: string): { isValid: boolean; message?: string } {
    if (!password) return { isValid: false, message: 'Password is required.' };
    if (password.length < 8) return { isValid: false, message: 'Password must be at least 8 characters long.' };
    if (!/[A-Za-z]/.test(password)) return { isValid: false, message: 'Password must contain at least one letter.' };
    if (!/[0-9]/.test(password)) return { isValid: false, message: 'Password must contain at least one number.' };
    return { isValid: true };
  }

  /**
   * The offline/backend-unreachable fallback login path in `AuthContext.tsx`
   * calls these — there is no more local plaintext-credential store to
   * fall back to (real passwords only ever live, hashed, on the backend),
   * so they always report "no local credential", which correctly fails
   * that fallback closed instead of trusting a stale mock password.
   */
  static getCredentialByUserId(_userId: string): undefined {
    return undefined;
  }
  static getCredentialByUsername(_username: string): undefined {
    return undefined;
  }
  static recordLogin(_userId: string): void {
    // No-op — real last-login tracking happens server-side (`PortalUser.lastLoginAt`).
  }

  static generateTemporaryPassword(): string {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    const numbers = '23456789';
    let res = '';
    for (let i = 0; i < 6; i++) res += letters.charAt(Math.floor(Math.random() * letters.length));
    for (let i = 0; i < 3; i++) res += numbers.charAt(Math.floor(Math.random() * numbers.length));
    return res;
  }

  /** `POST /portal-users` */
  static async createAdmin(values: AdminUserFormValues, currentUser?: User | null): Promise<AdminUser> {
    if (!currentUser) throw new Error('Authentication required: You must be signed in to create administrative users.');
    if (!values.fullName.trim()) throw new Error('Full Name is required.');
    const pwdCheck = this.validatePassword(values.password || '');
    if (!pwdCheck.isValid) throw new Error(pwdCheck.message);
    if (values.password !== values.confirmPassword) throw new Error('Password and Confirm Password must match.');

    const res = await apiClient.post<{ data: Record<string, any> }>('/portal-users', {
      fullName: values.fullName.trim(),
      username: values.username.trim().toLowerCase(),
      email: values.email.trim(),
      phone: values.phone?.trim() || undefined,
      password: values.password,
      role: values.role,
    });
    const created = toAdminUser(res.data.data);
    if (values.status === 'SUSPENDED' || values.status === 'INACTIVE') {
      await apiClient.post(`/portal-users/${created.id}/status`, { status: 'SUSPENDED' });
      created.status = 'SUSPENDED';
    }
    cachedAdminUsers = [created, ...cachedAdminUsers];
    return created;
  }

  /** `PATCH /portal-users/:id` (username is immutable post-creation — the backend rejects it) */
  static async updateAdmin(id: string, values: AdminUserFormValues, currentUser?: User | null): Promise<AdminUser> {
    if (!currentUser) throw new Error('Authentication required: You must be signed in to update administrative users.');
    if (!values.fullName.trim()) throw new Error('Full Name is required.');

    const existing = this.getAdminUserById(id);
    const res = await apiClient.patch<{ data: Record<string, any> }>(`/portal-users/${id}`, {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      phone: values.phone?.trim() || undefined,
      role: values.role,
    });
    let updated = toAdminUser(res.data.data);

    const wantsSuspended = values.status === 'SUSPENDED' || values.status === 'INACTIVE';
    if (existing && wantsSuspended !== (existing.status === 'SUSPENDED')) {
      const statusRes = await apiClient.post<{ data: Record<string, any> }>(`/portal-users/${id}/status`, {
        status: wantsSuspended ? 'SUSPENDED' : 'ACTIVE',
      });
      updated = toAdminUser(statusRes.data.data);
    }

    cachedAdminUsers = cachedAdminUsers.map((u) => (u.id === id ? updated : u));
    return updated;
  }

  /** `POST /portal-users/:id/reset-password` */
  static async resetPassword(
    id: string,
    newPassword: string,
    confirmPassword: string,
    _requireChange: boolean,
    currentUser?: User | null
  ): Promise<{ success: boolean; message: string }> {
    if (!currentUser) throw new Error('Authentication required: You must be signed in to reset passwords.');
    const pwdCheck = this.validatePassword(newPassword);
    if (!pwdCheck.isValid) throw new Error(pwdCheck.message);
    if (newPassword !== confirmPassword) throw new Error('Password and Confirm Password must match.');

    const res = await apiClient.post<{ data: Record<string, any> }>(`/portal-users/${id}/reset-password`, { newPassword });
    const updated = toAdminUser(res.data.data);
    cachedAdminUsers = cachedAdminUsers.map((u) => (u.id === id ? updated : u));
    return { success: true, message: 'Temporary password updated successfully.' };
  }

  /** `POST /portal-users/:id/status` */
  static async changeStatus(id: string, newStatus: AdminUser['status'], currentUser?: User | null): Promise<{ success: boolean; user: AdminUser }> {
    if (!currentUser) throw new Error('Authentication required: You must be signed in to change user status.');
    const res = await apiClient.post<{ data: Record<string, any> }>(`/portal-users/${id}/status`, {
      status: newStatus === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
    });
    const updated = toAdminUser(res.data.data);
    cachedAdminUsers = cachedAdminUsers.map((u) => (u.id === id ? updated : u));
    return { success: true, user: updated };
  }

  /** `DELETE /portal-users/:id` */
  static async deleteAdmin(id: string, currentUser?: User | null): Promise<{ success: boolean; message?: string }> {
    if (!currentUser) return { success: false, message: 'Authentication required to delete administrative accounts.' };
    try {
      await apiClient.delete(`/portal-users/${id}`);
      cachedAdminUsers = cachedAdminUsers.filter((u) => u.id !== id);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to delete administrative account.' };
    }
  }

  static validateImportRow(
    row: Partial<ImportedAdminRow>,
    existingUsers: AdminUser[],
    stagedUsernames: Set<string>,
    stagedEmails: Set<string>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!row.fullName || !row.fullName.trim()) errors.push('Full name is required.');

    const username = row.username?.trim().toLowerCase();
    if (!username) {
      errors.push('Username is required.');
    } else if (username.length < 3) {
      errors.push('Username must be at least 3 characters.');
    } else if (!/^[a-z0-9._-]+$/.test(username)) {
      errors.push('Username contains invalid characters.');
    } else if (existingUsers.some((u) => u.username.toLowerCase() === username) || stagedUsernames.has(username)) {
      errors.push('Duplicate username.');
    }

    const email = row.email?.trim().toLowerCase();
    if (!email) {
      errors.push('Email is required.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Invalid email format.');
    } else if (existingUsers.some((u) => u.email.toLowerCase() === email) || stagedEmails.has(email)) {
      errors.push('Duplicate email.');
    }

    if (row.status && row.status !== 'ACTIVE' && row.status !== 'INACTIVE' && row.status !== 'SUSPENDED') {
      errors.push('Invalid status (must be ACTIVE, INACTIVE, or SUSPENDED).');
    }

    return { isValid: errors.length === 0, errors };
  }

  /** Persists each validated row via a real `POST /portal-users` call (role always ADMIN, never SUPER_ADMIN). */
  static async executeAdminImport(
    validRows: ImportedAdminRow[],
    currentUser?: User | null
  ): Promise<{ success: boolean; count: number; failures: string[]; credentials: { fullName: string; username: string; tempPassword: string }[] }> {
    if (!currentUser) throw new Error('Authentication required: You must be signed in to import administrative users.');

    const credentials: { fullName: string; username: string; tempPassword: string }[] = [];
    const failures: string[] = [];
    let count = 0;

    for (const r of validRows) {
      const tempPassword = r.tempPassword || this.generateTemporaryPassword();
      try {
        await this.createAdmin(
          {
            fullName: r.fullName.trim(),
            employeeCode: r.employeeCode?.trim() || '',
            username: r.username.trim().toLowerCase(),
            email: r.email.trim().toLowerCase(),
            phone: r.phone?.trim() || '',
            role: 'ADMIN',
            status: r.status || 'ACTIVE',
            password: tempPassword,
            confirmPassword: tempPassword,
            requirePasswordChangeOnLogin: true,
          },
          currentUser
        );
        credentials.push({ fullName: r.fullName.trim(), username: r.username.trim().toLowerCase(), tempPassword });
        count += 1;
      } catch (err: any) {
        failures.push(`${r.username}: ${err?.message || 'Failed to import'}`);
      }
    }

    return { success: true, count, failures, credentials };
  }

  static filterAdminUsers(users: AdminUser[], filters: AdminUserFilterState): AdminUser[] {
    const query = filters.searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      if (query) {
        const matches =
          u.id.toLowerCase().includes(query) ||
          (u.employeeCode?.toLowerCase().includes(query) ?? false) ||
          u.fullName.toLowerCase().includes(query) ||
          u.username.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          (u.phone?.toLowerCase().includes(query) ?? false);
        if (!matches) return false;
      }
      if (filters.role !== 'ALL' && u.role !== filters.role) return false;
      if (filters.status !== 'ALL' && u.status !== filters.status) return false;
      return true;
    });
  }
}
