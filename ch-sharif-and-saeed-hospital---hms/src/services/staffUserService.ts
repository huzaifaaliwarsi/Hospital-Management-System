import * as XLSX from 'xlsx';
import apiClient from './apiClient';
import { User } from '../types';
import {
  StaffUser,
  StaffUserFormValues,
  StaffUserFilterState,
  StaffAuditLogEntry,
  ImportedStaffRow,
  StaffImportValidationResult,
  StaffAccessType,
  StaffPortalKey,
  StaffRole,
  StaffStatus,
  StaffCategory,
  STAFF_PORTAL_ROLES,
  STAFF_CATEGORIES,
} from '../types/staffUser';
import { DepartmentService } from './departmentService';
import { formatDisplayDate } from '../utils/dateConstants';

/**
 * Live Staff Users service — combines two real backend resources into one
 * flattened `StaffUser` row per the frontend's existing contract:
 *   - the HR record: `/api/v1/staff*` (Prisma `Staff`)
 *   - the optional login/portal account linked to it: `/api/v1/portal-users*`
 *     (Prisma `PortalUser`, `staffId` FK) — its absence IS the
 *     'STAFF_RECORD_ONLY' access type, a valid, deliberate state.
 * Same in-memory-cache pattern as the other rewired services — never
 * localStorage, no fake credential store, no fabricated audit log.
 */

const PORTAL_ROLE_TO_KEY: Record<string, StaffPortalKey> = {
  FRONT_DESK_BILLING: 'front-desk',
  ADMISSION: 'admission',
  INVENTORY_MANAGEMENT: 'inventory',
};
const KEY_TO_PORTAL_ROLE: Record<StaffPortalKey, string> = {
  'front-desk': 'FRONT_DESK_BILLING',
  admission: 'ADMISSION',
  inventory: 'INVENTORY_MANAGEMENT',
};
// Staff-tier portal roles this page manages (Admin/Super Admin accounts live on the Admin Users page).
const STAFF_PORTAL_ROLES_QUERY = 'FRONT_DESK_BILLING,ADMISSION,INVENTORY_MANAGEMENT';

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dateStr = formatDisplayDate(d);
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

/** Maps a backend Staff row (with its `portalUser` relation included) onto the frontend `StaffUser` shape. */
function toStaffUser(raw: Record<string, any>): StaffUser {
  const pu = raw.portalUser;
  const assignedPortal = pu ? PORTAL_ROLE_TO_KEY[pu.role] ?? null : null;
  const isSuspended = pu?.status === 'SUSPENDED' || (raw.notes && String(raw.notes).startsWith('[SUSPENDED]'));
  const status: StaffStatus = isSuspended ? 'SUSPENDED' : !raw.isActive ? 'INACTIVE' : 'ACTIVE';

  // Multi-department assignment: use junction table data if present, else fall back to primary dept
  const staffDepts: Array<{ departmentId: string; department: { id: string; name: string } }> =
    raw.staffDepartments ?? [];
  const departmentIds: string[] =
    staffDepts.length > 0 ? staffDepts.map((sd: any) => sd.departmentId) : raw.departmentId ? [raw.departmentId] : [];
  const departmentNames: string[] =
    staffDepts.length > 0 ? staffDepts.map((sd: any) => sd.department?.name ?? '') : raw.department?.name ? [raw.department.name] : [];

  return {
    id: raw.id,
    employeeCode: raw.employeeId,
    fullName: raw.fullName,
    fatherGuardianName: raw.fatherGuardianName || undefined,
    phone: raw.phone,
    alternatePhone: raw.alternatePhone || undefined,
    email: raw.email || '',
    cnic: raw.cnic || undefined,
    designation: raw.designation,
    departmentId: raw.departmentId,
    departmentName: raw.department?.name || '',
    departmentIds,
    departmentNames,
    staffCategory: raw.category as StaffCategory,
    accessType: pu ? 'PORTAL_USER' : 'STAFF_RECORD_ONLY',
    assignedPortal,
    staffRole: pu ? raw.designation : null,
    username: pu?.username || null,
    status,
    requirePasswordChange: pu?.mustResetPassword ?? false,
    lastLoginAt: pu?.lastLoginAt ? formatTimestamp(pu.lastLoginAt) : null,
    createdBy: raw.createdBy || 'System',
    createdAt: formatTimestamp(raw.createdAt),
    updatedBy: raw.updatedBy || 'System',
    updatedAt: formatTimestamp(raw.updatedAt),
    passwordResetBy: pu?.passwordResetBy || undefined,
    passwordResetAt: pu?.passwordResetAt ? formatTimestamp(pu.passwordResetAt) : undefined,
    clinicalAuthUsername: raw.clinicalAuthUsername ?? null,
    clinicalAuthActive: !!raw.clinicalAuthActive,
    clinicalAuthUpdatedAt: raw.clinicalAuthUpdatedAt ? formatTimestamp(raw.clinicalAuthUpdatedAt) : undefined,
    availableForOpd: !!raw.availableForOpd,
    availableForObservation: !!raw.availableForObservation,
    availableForEmergency: !!raw.availableForEmergency,
    doctorSponsoredDiscountTrackingEnabled: !!raw.doctorSponsoredDiscountTrackingEnabled,
    linkedActivityCount: 0,
    notes: raw.notes || undefined,
    // Internal, not part of the public StaffUser type but read back by this module below.
    // @ts-expect-error - stash the linked portal user id for update/status/reset calls.
    __portalUserId: pu?.id,
  };
}

function getPortalUserId(u: StaffUser): string | undefined {
  return (u as any).__portalUserId;
}

let cachedStaffUsers: StaffUser[] = [];

export async function fetchStaffUsers(): Promise<StaffUser[]> {
  const rows: Record<string, any>[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await apiClient.get<{ data: Record<string, any>[]; meta?: { pagination?: { totalPages: number } } }>(
      '/staff', { params: { pageSize: 100, page } }
    );
    rows.push(...res.data.data);
    totalPages = res.data.meta?.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);
  cachedStaffUsers = rows.map(toStaffUser);
  return cachedStaffUsers;
}

export async function primeStaffUsersCache(): Promise<void> {
  try {
    await fetchStaffUsers();
  } catch {
    // Leave cache empty; the Staff Users page itself will surface the real error on its own fetch.
  }
}

export class StaffUserService {
  static getStaffUsers(): StaffUser[] {
    return cachedStaffUsers;
  }

  static getStaffUserById(id: string): StaffUser | undefined {
    return cachedStaffUsers.find((u) => u.id === id);
  }

  static getStaffUserByUsername(username: string): StaffUser | undefined {
    const clean = username.trim().toLowerCase();
    return cachedStaffUsers.find((u) => u.username && u.username.toLowerCase() === clean);
  }

  /**
   * The offline/backend-unreachable fallback login path in `AuthContext.tsx`
   * calls these — there is no more local plaintext-credential store (real
   * passwords only ever live, hashed, on the backend), so they always
   * report "no local credential", correctly failing that fallback closed.
   */
  static getCredentialByUserId(_staffUserId: string): undefined {
    return undefined;
  }
  static getCredentialByUsername(_username: string): undefined {
    return undefined;
  }
  static recordLogin(_id: string): void {
    // No-op — real last-login tracking happens server-side (`PortalUser.lastLoginAt`).
  }

  static getAuditLogs(): StaffAuditLogEntry[] {
    // The backend's real `AuditLog` table (populated automatically per
    // request) is the actual audit trail now; there is no client-facing
    // read endpoint for it yet (tracked in the completion plan), so this
    // returns empty rather than fabricated entries.
    return [];
  }

  static isValidCNIC(cnic?: string | null): boolean {
    if (!cnic || !cnic.trim()) return true;
    return /^\d{5}-\d{7}-\d{1}$/.test(cnic.trim());
  }

  static isValidPhone(phone?: string | null): boolean {
    if (!phone || !phone.trim()) return false;
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('92') && digits.length === 12) digits = `0${digits.slice(2)}`;
    else if (digits.length === 10 && digits.startsWith('3')) digits = `0${digits}`;
    return digits.length === 11 && digits.startsWith('03');
  }

  static isValidPassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters long.' };
    if (!/[A-Za-z]/.test(password)) return { valid: false, message: 'Password must contain at least one letter.' };
    if (!/[0-9]/.test(password)) return { valid: false, message: 'Password must contain at least one number.' };
    return { valid: true };
  }

  static getNextNumericEmployeeCode(): string {
    let maxNum = 1000;
    for (const s of cachedStaffUsers) {
      const num = parseInt(s.employeeCode, 10);
      if (!Number.isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
    return String(maxNum + 1);
  }

  static isEmployeeCodeDuplicate(code: string, currentId?: string): boolean {
    const clean = code.trim().toLowerCase();
    return cachedStaffUsers.some((u) => u.employeeCode.toLowerCase() === clean && u.id !== currentId);
  }

  static isUsernameDuplicate(username: string, currentId?: string): boolean {
    const clean = username.trim().toLowerCase();
    if (!clean) return false;
    return cachedStaffUsers.some((u) => u.username && u.username.toLowerCase() === clean && u.id !== currentId);
  }

  /** `POST /staff` (+ `POST /portal-users` when Portal User access is requested) */
  static async createStaffUser(values: StaffUserFormValues, currentUser: User | null): Promise<{ success: boolean; user?: StaffUser; error?: string }> {
    if (!values.fullName.trim()) return { success: false, error: 'Full Name is required.' };
    if (!values.phone.trim()) return { success: false, error: 'Primary phone number is required.' };
    if (!values.designation.trim()) return { success: false, error: 'Designation is required.' };
    if (!values.departmentId) return { success: false, error: 'Department selection is required.' };
    if (values.cnic && !this.isValidCNIC(values.cnic)) {
      return { success: false, error: 'Invalid CNIC format. Please use standard format (xxxxx-xxxxxxx-x).' };
    }

    if (values.accessType === 'PORTAL_USER') {
      if (!values.assignedPortal) return { success: false, error: 'Assigned Portal is required for Portal User.' };
      if (!values.staffRole) return { success: false, error: 'Staff Role is required for Portal User.' };
      const allowedRoles = STAFF_PORTAL_ROLES[values.assignedPortal as StaffPortalKey] || [];
      if (!allowedRoles.includes(values.staffRole as StaffRole)) {
        return { success: false, error: `Staff role "${values.staffRole}" is incompatible with portal "${values.assignedPortal}".` };
      }
      if (!values.username.trim()) return { success: false, error: 'Username is required for Portal User.' };
      if (!values.password) return { success: false, error: 'Temporary password is required for Portal User.' };
      const passValidation = this.isValidPassword(values.password);
      if (!passValidation.valid) return { success: false, error: passValidation.message };
      if (values.password !== values.confirmPassword) return { success: false, error: 'Password and Confirm Password do not match.' };
    }

    try {
      const staffRes = await apiClient.post<{ data: Record<string, any> }>('/staff', {
        fullName: values.fullName.trim(),
        fatherGuardianName: values.fatherGuardianName?.trim() || undefined,
        cnic: values.cnic?.trim() || undefined,
        category: values.staffCategory,
        departmentId: values.departmentId,
        // Doctor multi-department: send the full list so the junction table is populated
        ...(values.staffCategory === 'Doctor' && values.departmentIds && values.departmentIds.length > 0
          ? { departmentIds: values.departmentIds }
          : {}),
        designation: values.designation.trim(),
        phone: values.phone.trim(),
        alternatePhone: values.alternatePhone?.trim() || undefined,
        email: values.email?.trim() || undefined,
        joiningDate: new Date().toISOString().slice(0, 10), // not yet collected by this form — defaults to today
        availableForOpd: values.availableForOpd,
        availableForObservation: values.availableForObservation,
        availableForEmergency: values.availableForEmergency,
        doctorSponsoredDiscountTrackingEnabled: values.doctorSponsoredDiscountTrackingEnabled,
      });
      const staffId = staffRes.data.data.id;

      // Canonical Salary Profile creation (if enabled)
      if (values.salaryEnabled && values.baseSalary && Number(values.baseSalary) > 0) {
        await this.saveSalaryProfile(staffId, {
          salaryBasis: values.salaryBasis || 'MONTHLY',
          baseAmount: Number(values.baseSalary),
          effectiveFrom: values.salaryEffectiveFrom || new Date().toISOString().slice(0, 10),
        });
      }

      if (values.accessType === 'PORTAL_USER') {
        await apiClient.post('/portal-users', {
          staffId,
          fullName: values.fullName.trim(),
          username: values.username.trim().toLowerCase(),
          email: values.email?.trim() || undefined,
          phone: values.phone.trim(),
          password: values.password,
          role: KEY_TO_PORTAL_ROLE[values.assignedPortal as StaffPortalKey],
        });
      }
      if (values.status === 'INACTIVE') {
        await apiClient.post(`/staff/${staffId}/deactivate`);
      }

      // Patient Discharge Credentials (Clinical Discharge Authorization — Doctors only)
      if (
        values.staffCategory === 'Doctor' &&
        values.clinicalAuthUsername?.trim() &&
        values.clinicalAuthPassword?.trim()
      ) {
        await this.setClinicalAuth(
          staffId,
          values.clinicalAuthUsername.trim(),
          values.clinicalAuthPassword.trim()
        );
        if (values.clinicalAuthActive === false) {
          await this.setClinicalAuthActive(staffId, false);
        }
      }

      await fetchStaffUsers();
      const created = this.getStaffUserById(staffId);
      return { success: true, user: created };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create staff user.' };
    }
  }

  /** `PATCH /staff/:id` (+ create/update/remove the linked `/portal-users*` record as access type changes) */
  static async updateStaffUser(id: string, values: StaffUserFormValues, currentUser: User | null): Promise<{ success: boolean; user?: StaffUser; error?: string }> {
    const existing = this.getStaffUserById(id);
    if (!existing) return { success: false, error: 'Staff user not found.' };

    if (!values.fullName.trim()) return { success: false, error: 'Full Name is required.' };
    if (!values.phone.trim()) return { success: false, error: 'Primary phone number is required.' };
    if (!values.departmentId) return { success: false, error: 'Department selection is required.' };
    if (values.cnic && !this.isValidCNIC(values.cnic)) {
      return { success: false, error: 'Invalid CNIC format. Please use standard format (xxxxx-xxxxxxx-x).' };
    }

    if (values.accessType === 'PORTAL_USER') {
      if (!values.assignedPortal || !values.staffRole) {
        return { success: false, error: 'Assigned Portal and Staff Role are required for Portal User.' };
      }
      if (existing.accessType === 'STAFF_RECORD_ONLY') {
        if (!values.username.trim()) return { success: false, error: 'Username is required for Portal User.' };
        if (!values.password) return { success: false, error: 'Temporary password is required when enabling Portal User access.' };
        const passValidation = this.isValidPassword(values.password);
        if (!passValidation.valid) return { success: false, error: passValidation.message };
        if (values.password !== values.confirmPassword) return { success: false, error: 'Password and Confirm Password do not match.' };
      }
    }

    try {
      await apiClient.patch(`/staff/${id}`, {
        fullName: values.fullName.trim(),
        fatherGuardianName: values.fatherGuardianName?.trim() || undefined,
        cnic: values.cnic?.trim() || undefined,
        category: values.staffCategory,
        departmentId: values.departmentId,
        // Doctor multi-department: sync the junction table on every update
        ...(values.staffCategory === 'Doctor' && values.departmentIds && values.departmentIds.length > 0
          ? { departmentIds: values.departmentIds }
          : {}),
        designation: values.designation.trim(),
        phone: values.phone.trim(),
        alternatePhone: values.alternatePhone?.trim() || undefined,
        email: values.email?.trim() || undefined,
        isActive: values.status !== 'INACTIVE',
        availableForOpd: values.availableForOpd,
        availableForObservation: values.availableForObservation,
        availableForEmergency: values.availableForEmergency,
        doctorSponsoredDiscountTrackingEnabled: values.doctorSponsoredDiscountTrackingEnabled,
      });

      // Canonical Salary Profile update/creation (if enabled)
      if (values.salaryEnabled && values.baseSalary && Number(values.baseSalary) > 0) {
        await this.saveSalaryProfile(id, {
          salaryBasis: values.salaryBasis || 'MONTHLY',
          baseAmount: Number(values.baseSalary),
          effectiveFrom: values.salaryEffectiveFrom || new Date().toISOString().slice(0, 10),
        });
      }

      const portalUserId = getPortalUserId(existing);
      if (values.accessType === 'PORTAL_USER') {
        if (portalUserId) {
          await apiClient.patch(`/portal-users/${portalUserId}`, {
            fullName: values.fullName.trim(),
            email: values.email?.trim() || undefined,
            phone: values.phone.trim(),
            role: KEY_TO_PORTAL_ROLE[values.assignedPortal as StaffPortalKey],
          });
          const wantsSuspended = values.status === 'SUSPENDED';
          if (wantsSuspended !== (existing.status === 'SUSPENDED')) {
            await apiClient.post(`/portal-users/${portalUserId}/status`, { status: wantsSuspended ? 'SUSPENDED' : 'ACTIVE' });
          }
        } else {
          // Converting from STAFF_RECORD_ONLY to PORTAL_USER
          await apiClient.post('/portal-users', {
            staffId: id,
            fullName: values.fullName.trim(),
            username: values.username.trim().toLowerCase(),
            email: values.email?.trim() || undefined,
            phone: values.phone.trim(),
            password: values.password,
            role: KEY_TO_PORTAL_ROLE[values.assignedPortal as StaffPortalKey],
          });
        }
      } else if (portalUserId) {
        // Converting to STAFF_RECORD_ONLY: remove portal access if it has no linked activity.
        try {
          await apiClient.delete(`/portal-users/${portalUserId}`);
        } catch (err: any) {
          await fetchStaffUsers();
          return {
            success: false,
            error: err?.message || 'This account has linked activity and its portal access cannot be removed. Suspend it instead.',
          };
        }
      }

      // Patient Discharge Credentials (Clinical Discharge Authorization — Doctors only)
      if (values.staffCategory === 'Doctor') {
        const docUsername = values.clinicalAuthUsername?.trim();
        const docPassword = values.clinicalAuthPassword?.trim();
        if (docUsername && docPassword) {
          const isConfigured = !!existing.clinicalAuthUsername;
          if (isConfigured && docUsername === existing.clinicalAuthUsername) {
            await this.resetClinicalAuthPassword(id, docPassword);
          } else {
            await this.setClinicalAuth(id, docUsername, docPassword);
          }
        }
        if (
          values.clinicalAuthActive !== undefined &&
          values.clinicalAuthActive !== existing.clinicalAuthActive &&
          (existing.clinicalAuthUsername || docUsername)
        ) {
          await this.setClinicalAuthActive(id, values.clinicalAuthActive);
        }
      }

      await fetchStaffUsers();
      const updated = this.getStaffUserById(id);
      return { success: true, user: updated };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update staff user.' };
    }
  }

  /** `POST /staff/:id/deactivate` or `PATCH /staff/:id` (reactivate), plus `/portal-users/:id/status` when applicable */
  static async updateStaffStatus(
    id: string,
    newStatus: StaffStatus,
    _currentUser: User | null,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = this.getStaffUserById(id);
    if (!existing) return { success: false, error: 'Staff user not found.' };

    try {
      const portalUserId = getPortalUserId(existing);

      if (newStatus === 'INACTIVE') {
        await apiClient.post(`/staff/${id}/deactivate`, { reason: reason || 'Administrative deactivation' });
      } else if (newStatus === 'SUSPENDED') {
        if (portalUserId) {
          await apiClient.post(`/portal-users/${portalUserId}/status`, {
            status: 'SUSPENDED',
            reason: reason || 'Administrative suspension',
          });
        }
        const existingNotes = existing.notes || '';
        const cleanNotes = existingNotes.replace(/^\[SUSPENDED\]\s*/, '');
        const newNotes = `[SUSPENDED] ${reason || 'Suspended by administrator'}${cleanNotes ? ' | ' + cleanNotes : ''}`;
        await apiClient.patch(`/staff/${id}`, { notes: newNotes });
      } else if (newStatus === 'ACTIVE') {
        const existingNotes = existing.notes || '';
        const cleanNotes = existingNotes.replace(/^\[SUSPENDED\]\s*/, '');
        await apiClient.patch(`/staff/${id}`, {
          isActive: true,
          employmentStatus: 'ACTIVE',
          notes: cleanNotes || undefined,
        });

        if (portalUserId) {
          await apiClient.post(`/portal-users/${portalUserId}/status`, {
            status: 'ACTIVE',
            reason: reason || 'Reactivated by administrator',
          });
        }
      }

      await fetchStaffUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update status.' };
    }
  }

  /** `POST /portal-users/:id/reset-password` */
  static async resetStaffPassword(id: string, newPassword: string, _requirePasswordChange: boolean, _currentUser: User | null): Promise<{ success: boolean; error?: string }> {
    const existing = this.getStaffUserById(id);
    if (!existing) return { success: false, error: 'Staff user not found.' };
    if (existing.accessType !== 'PORTAL_USER') return { success: false, error: 'Cannot reset password for a Staff Record Only entry.' };

    const validation = this.isValidPassword(newPassword);
    if (!validation.valid) return { success: false, error: validation.message };

    try {
      const portalUserId = getPortalUserId(existing);
      await apiClient.post(`/portal-users/${portalUserId}/reset-password`, { newPassword });
      await fetchStaffUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to reset password.' };
    }
  }

  // ── v7.2 Salary Profile (HMS_V7.2_NEW_REQUIREMENTS.md §2.7) ─────────────
  // Creating a new profile server-side closes out whichever row was
  // previously current — this is a "set current profile" action, not a
  // patch, matching StaffEmploymentHistory/DoctorCommissionRule's
  // effective-dated-history pattern.
  static async saveSalaryProfile(
    id: string,
    values: {
      salaryBasis: 'MONTHLY' | 'PER_DAY';
      baseAmount: number;
      payrollDivisor?: number;
      salaryTaxMethod?: 'PERCENTAGE' | 'FIXED' | '';
      salaryTaxValue?: number | '';
      effectiveFrom: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.post(`/staff/${id}/salary-profile`, {
        salaryBasis: values.salaryBasis,
        baseAmount: values.baseAmount,
        payrollDivisor: values.payrollDivisor,
        salaryTaxMethod: values.salaryTaxMethod || undefined,
        salaryTaxValue: values.salaryTaxValue === '' ? undefined : values.salaryTaxValue,
        effectiveFrom: values.effectiveFrom,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error?.message || err?.message || 'Failed to save salary profile.' };
    }
  }

  /** Staff 360° read — current salary profile + commission rules, used by the Salary Profile modal to prefill. */
  static async fetchFullProfile(id: string): Promise<Record<string, any>> {
    const res = await apiClient.get<{ data: Record<string, any> }>(`/staff/${id}/360`);
    return res.data.data;
  }

  // ── v7.2 Doctor Clinical Discharge Authorization (HMS_V7.2_NEW_REQUIREMENTS.md
  // §2.4) — a credential separate from the portal login above; usable even
  // for a Staff Record Only doctor. Consumed later by the Admission
  // Portal's discharge re-authentication popup (not built in this phase).

  /** Creates or replaces a doctor's clinical discharge credential (also (re)activates it). */
  static async setClinicalAuth(id: string, username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.post(`/staff/${id}/clinical-auth`, { username, password });
      await fetchStaffUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error?.message || err?.message || 'Failed to set clinical discharge credential.' };
    }
  }

  /** Rotates the password on an existing clinical discharge credential without changing the username. */
  static async resetClinicalAuthPassword(id: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.post(`/staff/${id}/clinical-auth/reset-password`, { password });
      await fetchStaffUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error?.message || err?.message || 'Failed to reset clinical discharge password.' };
    }
  }

  static async setClinicalAuthActive(id: string, active: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.post(`/staff/${id}/clinical-auth/${active ? 'activate' : 'deactivate'}`);
      await fetchStaffUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error?.message || err?.message || 'Failed to update clinical discharge authorization status.' };
    }
  }

  /** Permanently delete staff user (or guides to deactivation if hospital activity is recorded). */
  static async deleteStaffUser(id: string, _currentUser: User | null): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.delete(`/staff/${id}`);
      await fetchStaffUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to delete staff account.' };
    }
  }

  static filterStaffUsers(users: StaffUser[], filters: StaffUserFilterState): StaffUser[] {
    const search = (filters.searchTerm || '').trim().toLowerCase();
    return users.filter((u) => {
      if (search) {
        const matches =
          u.employeeCode.toLowerCase().includes(search) ||
          u.fullName.toLowerCase().includes(search) ||
          u.phone.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          (u.cnic && u.cnic.toLowerCase().includes(search)) ||
          u.designation.toLowerCase().includes(search) ||
          u.departmentName.toLowerCase().includes(search) ||
          (u.username && u.username.toLowerCase().includes(search));
        if (!matches) return false;
      }
      if (filters.departmentId && filters.departmentId !== 'ALL' && u.departmentId !== filters.departmentId) return false;
      if (filters.staffCategory && filters.staffCategory !== 'ALL' && u.staffCategory !== filters.staffCategory) return false;
      if (filters.accessType && filters.accessType !== 'ALL' && u.accessType !== filters.accessType) return false;
      if (filters.assignedPortal && filters.assignedPortal !== 'ALL' && u.assignedPortal !== filters.assignedPortal) return false;
      if (filters.status && filters.status !== 'ALL' && u.status !== filters.status) return false;
      if (filters.staffRole && filters.staffRole !== 'ALL' && u.staffRole !== filters.staffRole) return false;
      return true;
    });
  }

  static generateImportTemplate(): void {
    const templateData = [
      {
        employee_code: 'EMP-FD-10',
        full_name: 'Bilal Khan',
        father_guardian_name: 'Muhammad Khan',
        phone: '+92 300 1234567',
        alternate_phone: '',
        email: 'bilal.khan@sharif-saeed.hospital',
        cnic: '35201-1122334-1',
        designation: 'Reception Officer',
        department_code: 'DEP-09',
        staff_category: 'Front Desk / Reception',
        access_type: 'PORTAL_USER',
        assigned_portal: 'front-desk',
        staff_role: 'Front Desk Officer',
        status: 'ACTIVE',
        username: 'bilal.reception',
      },
      {
        employee_code: 'EMP-DOC-15',
        full_name: 'Dr. Shahzad Ali',
        father_guardian_name: 'Ali Nawaz',
        phone: '+92 300 7654321',
        alternate_phone: '',
        email: 'shahzad.ali@sharif-saeed.hospital',
        cnic: '35202-2233445-2',
        designation: 'Consultant Pediatrician',
        department_code: 'DEP-04',
        staff_category: 'Doctor',
        access_type: 'STAFF_RECORD_ONLY',
        assigned_portal: '',
        staff_role: '',
        status: 'ACTIVE',
        username: '',
      },
    ];

    const instructionsData = [
      { Instruction: 'Allowed staff_category values:', ValidOptions: STAFF_CATEGORIES.join(', ') },
      { Instruction: 'Allowed access_type values:', ValidOptions: 'PORTAL_USER, STAFF_RECORD_ONLY' },
      { Instruction: 'Allowed assigned_portal values:', ValidOptions: 'front-desk, admission, inventory (Leave blank for STAFF_RECORD_ONLY)' },
      { Instruction: 'Allowed status values:', ValidOptions: 'ACTIVE, INACTIVE, SUSPENDED' },
      { Instruction: 'Role mapping:', ValidOptions: 'Must match valid roles for the selected portal (e.g. Front Desk Officer, Billing Officer, Admission Officer, Inventory Manager)' },
      { Instruction: 'Automatic Passwords:', ValidOptions: 'For PORTAL_USER rows, secure temporary credentials will be auto-generated and available for download upon import confirmation.' },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wsInfo = XLSX.utils.json_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Staff Import Template');
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Field Instructions');
    XLSX.writeFile(wb, 'staff_users_import_template.xlsx');
  }

  static async parseAndValidateImport(file: File): Promise<StaffImportValidationResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet);

          const existingUsers = this.getStaffUsers();
          const existingCodes = new Set(existingUsers.map((u) => u.employeeCode.toLowerCase()));
          const existingUsernames = new Set(existingUsers.filter((u) => u.username).map((u) => u.username!.toLowerCase()));
          const existingCnics = new Set(existingUsers.filter((u) => u.cnic).map((u) => u.cnic!.toLowerCase()));

          const departments = DepartmentService.getDepartments();
          const deptMap = new Map<string, { id: string; name: string }>();
          departments.forEach((d) => {
            deptMap.set(d.code.toLowerCase(), { id: d.id, name: d.name });
            deptMap.set(d.id.toLowerCase(), { id: d.id, name: d.name });
            deptMap.set(d.name.toLowerCase(), { id: d.id, name: d.name });
          });

          const seenBatchCodes = new Set<string>();
          const seenBatchUsernames = new Set<string>();
          const rows: ImportedStaffRow[] = [];

          rawRows.forEach((row, idx) => {
            const rowNumber = idx + 2;
            const errors: string[] = [];

            const employeeCode = String(row.employee_code || row.EmployeeCode || '').trim();
            const fullName = String(row.full_name || row.FullName || row.Name || '').trim();
            const fatherGuardianName = String(row.father_guardian_name || row.FatherName || '').trim();
            const phone = String(row.phone || row.Phone || row.Contact || '').trim();
            const alternatePhone = String(row.alternate_phone || '').trim();
            const email = String(row.email || row.Email || '').trim().toLowerCase();
            const cnic = String(row.cnic || row.CNIC || '').trim();
            const designation = String(row.designation || row.Designation || '').trim();
            const departmentCode = String(row.department_code || row.DepartmentCode || row.department || '').trim();
            const staffCategory = String(row.staff_category || row.StaffCategory || row.category || '').trim();
            const accessType = String(row.access_type || row.AccessType || 'PORTAL_USER').trim().toUpperCase();
            const assignedPortal = String(row.assigned_portal || row.AssignedPortal || row.portal || '').trim().toLowerCase();
            const staffRole = String(row.staff_role || row.StaffRole || row.role || '').trim();
            const rawUsername = String(row.username || row.Username || '').trim();
            const status = String(row.status || row.Status || 'ACTIVE').trim().toUpperCase();

            if (!employeeCode) {
              errors.push('Employee Code is required.');
            } else if (existingCodes.has(employeeCode.toLowerCase())) {
              errors.push(`Employee Code "${employeeCode}" already exists in system.`);
            } else if (seenBatchCodes.has(employeeCode.toLowerCase())) {
              errors.push(`Duplicate Employee Code "${employeeCode}" within uploaded spreadsheet.`);
            } else {
              seenBatchCodes.add(employeeCode.toLowerCase());
            }

            if (!fullName) errors.push('Staff Full Name is required.');
            if (!phone) errors.push('Phone number is required.');
            if (!designation) errors.push('Designation is required.');

            let resolvedDept: { id: string; name: string } | undefined;
            if (!departmentCode) {
              errors.push('Department code is required.');
            } else {
              resolvedDept = deptMap.get(departmentCode.toLowerCase());
              if (!resolvedDept) {
                errors.push(`Unknown department code "${departmentCode}".`);
              }
            }

            if (!staffCategory || !STAFF_CATEGORIES.includes(staffCategory as StaffCategory)) {
              errors.push(`Invalid staff category "${staffCategory}". Allowed: ${STAFF_CATEGORIES.slice(0, 5).join(', ')}...`);
            }

            if (accessType !== 'PORTAL_USER' && accessType !== 'STAFF_RECORD_ONLY') {
              errors.push('Access Type must be either PORTAL_USER or STAFF_RECORD_ONLY.');
            }

            let validatedUsername: string | undefined;
            if (accessType === 'PORTAL_USER') {
              const validPortals: StaffPortalKey[] = ['front-desk', 'admission', 'inventory'];
              if (!assignedPortal || !validPortals.includes(assignedPortal as StaffPortalKey)) {
                errors.push('Assigned portal must be one of: front-desk, admission, inventory.');
              } else {
                const allowedRoles = STAFF_PORTAL_ROLES[assignedPortal as StaffPortalKey];
                if (!staffRole) {
                  errors.push(`Staff role is required for portal "${assignedPortal}".`);
                } else if (!allowedRoles.includes(staffRole as StaffRole)) {
                  errors.push(`Role "${staffRole}" is invalid for portal "${assignedPortal}". Allowed: ${allowedRoles.join(', ')}`);
                }
              }

              if (rawUsername) {
                if (existingUsernames.has(rawUsername.toLowerCase())) {
                  errors.push(`Username "${rawUsername}" is already in use.`);
                } else if (seenBatchUsernames.has(rawUsername.toLowerCase())) {
                  errors.push(`Duplicate username "${rawUsername}" in uploaded file.`);
                } else {
                  validatedUsername = rawUsername.toLowerCase();
                  seenBatchUsernames.add(validatedUsername);
                }
              } else {
                const parts = fullName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
                const base = parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] || 'staff';
                let candidate = base;
                let counter = 1;
                while (existingUsernames.has(candidate) || seenBatchUsernames.has(candidate)) {
                  candidate = `${base}${counter}`;
                  counter++;
                }
                validatedUsername = candidate;
                seenBatchUsernames.add(candidate);
              }
            }

            if (cnic) {
              if (!this.isValidCNIC(cnic)) {
                errors.push('CNIC must follow format xxxxx-xxxxxxx-x.');
              } else if (existingCnics.has(cnic.toLowerCase())) {
                errors.push(`CNIC "${cnic}" already registered to another staff user.`);
              }
            }

            if (status !== 'ACTIVE' && status !== 'INACTIVE' && status !== 'SUSPENDED') {
              errors.push('Status must be ACTIVE, INACTIVE, or SUSPENDED.');
            }

            rows.push({
              rowNumber,
              employeeCode,
              fullName,
              fatherGuardianName,
              phone,
              alternatePhone,
              email,
              cnic,
              designation,
              departmentCode,
              departmentName: resolvedDept?.name,
              staffCategory,
              accessType,
              assignedPortal: accessType === 'PORTAL_USER' ? assignedPortal : undefined,
              staffRole: accessType === 'PORTAL_USER' ? staffRole : undefined,
              username: validatedUsername,
              status,
              isValid: errors.length === 0,
              errors,
            });
          });

          const validRows = rows.filter((r) => r.isValid).length;
          resolve({ totalRows: rows.length, validRows, invalidRows: rows.length - validRows, rows });
        } catch (err: any) {
          reject(new Error(err?.message || 'Failed to parse Excel file. Please ensure it is a valid .xlsx file.'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file from disk.'));
      reader.readAsArrayBuffer(file);
    });
  }

  /** Persists each validated row via real `POST /staff` (+ `/portal-users`) calls, one row at a time. */
  static async commitImport(
    validRows: ImportedStaffRow[],
    currentUser: User | null
  ): Promise<{
    success: boolean;
    importedCount: number;
    failures: string[];
    generatedCredentials: { employeeCode: string; fullName: string; portal: string; role: string; username: string; temporaryPassword: string }[];
  }> {
    const departments = DepartmentService.getDepartments();
    const deptMap = new Map<string, { id: string; name: string }>();
    departments.forEach((d) => {
      deptMap.set(d.code.toLowerCase(), { id: d.id, name: d.name });
      deptMap.set(d.id.toLowerCase(), { id: d.id, name: d.name });
      deptMap.set(d.name.toLowerCase(), { id: d.id, name: d.name });
    });

    const generatedCredentials: { employeeCode: string; fullName: string; portal: string; role: string; username: string; temporaryPassword: string }[] = [];
    const failures: string[] = [];
    let importedCount = 0;

    for (const row of validRows) {
      const dept = deptMap.get(row.departmentCode.toLowerCase());
      if (!dept) {
        failures.push(`${row.employeeCode}: department "${row.departmentCode}" not found`);
        continue;
      }
      const tempPassword = `Staff#${Math.floor(1000 + Math.random() * 9000)}`;
      try {
        const result = await this.createStaffUser(
          {
            fullName: row.fullName,
            employeeCode: row.employeeCode,
            fatherGuardianName: row.fatherGuardianName || '',
            cnic: row.cnic || '',
            phone: row.phone,
            alternatePhone: row.alternatePhone || '',
            email: row.email,
            designation: row.designation,
            departmentId: dept.id,
            departmentName: dept.name,
            staffCategory: row.staffCategory as StaffCategory,
            status: (row.status as StaffStatus) || 'ACTIVE',
            accessType: row.accessType as StaffAccessType,
            assignedPortal: (row.assignedPortal as StaffPortalKey) || '',
            staffRole: row.staffRole || '',
            username: row.username || '',
            password: tempPassword,
            confirmPassword: tempPassword,
            requirePasswordChange: true,
            doctorSponsoredDiscountTrackingEnabled: false,
          },
          currentUser
        );
        if (!result.success) {
          failures.push(`${row.employeeCode}: ${result.error}`);
          continue;
        }
        importedCount += 1;
        if (row.accessType === 'PORTAL_USER' && row.username) {
          generatedCredentials.push({
            employeeCode: row.employeeCode,
            fullName: row.fullName,
            portal: row.assignedPortal || '',
            role: row.staffRole || 'Staff',
            username: row.username,
            temporaryPassword: tempPassword,
          });
        }
      } catch (err: any) {
        failures.push(`${row.employeeCode}: ${err?.message || 'Failed to import'}`);
      }
    }

    return { success: true, importedCount, failures, generatedCredentials };
  }

  static downloadTemporaryCredentials(
    creds: { employeeCode: string; fullName: string; portal: string; role: string; username: string; temporaryPassword: string }[]
  ): void {
    const wb = XLSX.utils.book_new();
    const formatted = creds.map((c) => ({
      'Employee Code': c.employeeCode,
      'Full Name': c.fullName,
      'Assigned Portal': c.portal,
      'Staff Role': c.role,
      Username: c.username,
      'Temporary Password': c.temporaryPassword,
      Note: 'Must change password on first login.',
    }));
    const ws = XLSX.utils.json_to_sheet(formatted);
    XLSX.utils.book_append_sheet(wb, ws, 'Staff Credentials');
    XLSX.writeFile(wb, `staff_temporary_credentials_${Date.now()}.xlsx`);
  }
}
