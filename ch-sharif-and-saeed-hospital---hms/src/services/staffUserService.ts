import * as XLSX from 'xlsx';
import { User } from '../types';
import {
  StaffUser,
  StaffCredential,
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
  STAFF_PORTALS,
} from '../types/staffUser';
import { DepartmentService, formatAuditUser, formatAuditTimestamp } from './departmentService';

export const STAFF_USERS_STORAGE_KEY = 'hms_staff_users_master_catalog_v1';
export const STAFF_CREDENTIALS_STORAGE_KEY = 'hms_staff_credentials_store_v1';
export const STAFF_AUDIT_STORAGE_KEY = 'hms_staff_audit_logs_v1';

export const INITIAL_STAFF_CREDENTIALS: StaffCredential[] = [
  {
    staffUserId: 'STF-001',
    username: 'frontdesk',
    demoPassword: '123456',
    assignedPortal: 'front-desk',
    requirePasswordChange: false,
    updatedAt: '01 Jan 2024, 09:00 AM',
  },
  {
    staffUserId: 'STF-002',
    username: 'demo.frontdesk',
    demoPassword: 'Demo12345',
    assignedPortal: 'front-desk',
    requirePasswordChange: false,
    updatedAt: '01 Feb 2024, 09:00 AM',
  },
  {
    staffUserId: 'STF-003',
    username: 'admission',
    demoPassword: '123456',
    assignedPortal: 'admission',
    requirePasswordChange: false,
    updatedAt: '01 Jan 2024, 09:00 AM',
  },
  {
    staffUserId: 'STF-004',
    username: 'hamza.admission',
    demoPassword: 'Hamza123',
    assignedPortal: 'admission',
    requirePasswordChange: false,
    updatedAt: '15 Feb 2024, 10:30 AM',
  },
  {
    staffUserId: 'STF-007',
    username: 'inventory',
    demoPassword: '123456',
    assignedPortal: 'inventory',
    requirePasswordChange: false,
    updatedAt: '01 Jan 2024, 09:00 AM',
  },
  {
    staffUserId: 'STF-008',
    username: 'bilal.store',
    demoPassword: 'Bilal123',
    assignedPortal: 'inventory',
    requirePasswordChange: false,
    updatedAt: '10 Apr 2024, 02:00 PM',
  },
  {
    staffUserId: 'STF-012',
    username: 'kamran.billing',
    demoPassword: 'Kamran123',
    assignedPortal: 'front-desk',
    requirePasswordChange: false,
    updatedAt: '01 May 2024, 09:00 AM',
  },
];

export const INITIAL_STAFF_USERS: StaffUser[] = [
  {
    id: 'STF-001',
    employeeCode: 'EMP-FD-01',
    fullName: 'Ahmed Raza',
    fatherGuardianName: 'Muhammad Raza',
    phone: '+92 301 2345678',
    alternatePhone: '+92 301 2345679',
    email: 'ahmed.raza@sharif-saeed.hospital',
    cnic: '35201-1234567-1',
    designation: 'Senior Billing Officer',
    departmentId: 'DEP-09',
    departmentName: 'Hospital Administration & Executive Services',
    staffCategory: 'Billing / Cashier',
    accessType: 'PORTAL_USER',
    assignedPortal: 'front-desk',
    staffRole: 'Senior Billing Officer / Cashier',
    username: 'frontdesk',
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: '09 Sep 2026, 08:00 AM',
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2024, 09:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '08 Sep 2026, 04:30 PM',
    linkedActivityCount: 185,
  },
  {
    id: 'STF-002',
    employeeCode: 'EMP-FD-02',
    fullName: 'Zainab Tariq',
    fatherGuardianName: 'Tariq Mehmood',
    phone: '+92 302 3456789',
    alternatePhone: '',
    email: 'zainab.tariq@sharif-saeed.hospital',
    cnic: '35201-2345678-2',
    designation: 'Front Desk Officer',
    departmentId: 'DEP-09',
    departmentName: 'Hospital Administration & Executive Services',
    staffCategory: 'Front Desk / Reception',
    accessType: 'PORTAL_USER',
    assignedPortal: 'front-desk',
    staffRole: 'Front Desk Officer',
    username: 'demo.frontdesk',
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: '08 Sep 2026, 09:15 AM',
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Feb 2024, 09:00 AM',
    updatedBy: 'Dr. Farhana Yasmeen (Admin)',
    updatedAt: '07 Sep 2026, 02:20 PM',
    linkedActivityCount: 92,
  },
  {
    id: 'STF-003',
    employeeCode: 'EMP-ADM-01',
    fullName: 'Sara Khan',
    fatherGuardianName: 'Muhammad Akram Khan',
    phone: '+92 303 4567890',
    alternatePhone: '+92 333 4567890',
    email: 'sara.khan@sharif-saeed.hospital',
    cnic: '35202-3456789-3',
    designation: 'Admission Officer',
    departmentId: 'DEP-09',
    departmentName: 'Hospital Administration & Executive Services',
    staffCategory: 'Admission',
    accessType: 'PORTAL_USER',
    assignedPortal: 'admission',
    staffRole: 'Admission Officer',
    username: 'admission',
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: '09 Sep 2026, 07:45 AM',
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2024, 09:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '08 Sep 2026, 05:10 PM',
    linkedActivityCount: 140,
  },
  {
    id: 'STF-004',
    employeeCode: 'EMP-ADM-02',
    fullName: 'Hamza Naveed',
    fatherGuardianName: 'Naveed Akhtar',
    phone: '+92 304 5678901',
    alternatePhone: '',
    email: 'hamza.naveed@sharif-saeed.hospital',
    cnic: '35202-4567890-4',
    designation: 'Ward Inpatient Coordinator',
    departmentId: 'DEP-01',
    departmentName: 'Internal Medicine & Critical Care',
    staffCategory: 'Admission',
    accessType: 'PORTAL_USER',
    assignedPortal: 'admission',
    staffRole: 'Ward Coordinator',
    username: 'hamza.admission',
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: '08 Sep 2026, 03:20 PM',
    createdBy: 'Dr. Farhana Yasmeen (Admin)',
    createdAt: '15 Feb 2024, 10:30 AM',
    updatedBy: 'Dr. Farhana Yasmeen (Admin)',
    updatedAt: '06 Sep 2026, 11:45 AM',
    linkedActivityCount: 78,
  },
  {
    id: 'STF-005',
    employeeCode: 'EMP-PH-01',
    fullName: 'Ali Hassan',
    fatherGuardianName: 'Hassan Raza',
    phone: '+92 305 6789012',
    alternatePhone: '',
    email: 'ali.hassan@sharif-saeed.hospital',
    cnic: '35201-5678901-5',
    designation: 'Head Pharmacist',
    departmentId: 'DEP-08',
    departmentName: 'Pharmacy & Central Dispensary',
    staffCategory: 'Pharmacy',
    accessType: 'STAFF_RECORD_ONLY',
    assignedPortal: null,
    staffRole: null,
    username: null,
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: null,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2024, 09:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '07 Sep 2026, 06:10 PM',
    linkedActivityCount: 310,
  },
  {
    id: 'STF-006',
    employeeCode: 'EMP-PH-02',
    fullName: 'Ayesha Noor',
    fatherGuardianName: 'Noor Muhammad',
    phone: '+92 306 7890123',
    alternatePhone: '+92 321 7890123',
    email: 'ayesha.noor@sharif-saeed.hospital',
    cnic: '35201-6789012-6',
    designation: 'Pharmacy Cashier',
    departmentId: 'DEP-08',
    departmentName: 'Pharmacy & Central Dispensary',
    staffCategory: 'Pharmacy',
    accessType: 'STAFF_RECORD_ONLY',
    assignedPortal: null,
    staffRole: null,
    username: null,
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: null,
    createdBy: 'Dr. Farhana Yasmeen (Admin)',
    createdAt: '01 Mar 2024, 11:00 AM',
    updatedBy: 'Dr. Farhana Yasmeen (Admin)',
    updatedAt: '05 Sep 2026, 04:00 PM',
    linkedActivityCount: 165,
  },
  {
    id: 'STF-007',
    employeeCode: 'EMP-INV-01',
    fullName: 'Usman Ali',
    fatherGuardianName: 'Muhammad Ali',
    phone: '+92 307 8901234',
    alternatePhone: '',
    email: 'usman.ali@sharif-saeed.hospital',
    cnic: '35202-7890123-7',
    designation: 'Central Store Manager',
    departmentId: 'DEP-08',
    departmentName: 'Pharmacy & Central Dispensary',
    staffCategory: 'Inventory / Store',
    accessType: 'PORTAL_USER',
    assignedPortal: 'inventory',
    staffRole: 'Store Manager',
    username: 'inventory',
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: '09 Sep 2026, 08:05 AM',
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2024, 09:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '08 Sep 2026, 03:50 PM',
    linkedActivityCount: 220,
  },
  {
    id: 'STF-008',
    employeeCode: 'EMP-INV-02',
    fullName: 'Bilal Siddiqui',
    fatherGuardianName: 'Siddiq Ahmed',
    phone: '+92 308 9012345',
    alternatePhone: '',
    email: 'bilal.siddiqui@sharif-saeed.hospital',
    cnic: '35201-8901234-8',
    designation: 'Store Keeper & Inventory Officer',
    departmentId: 'DEP-08',
    departmentName: 'Pharmacy & Central Dispensary',
    staffCategory: 'Inventory / Store',
    accessType: 'PORTAL_USER',
    assignedPortal: 'inventory',
    staffRole: 'Store Keeper',
    username: 'bilal.store',
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: '07 Sep 2026, 11:30 AM',
    createdBy: 'Dr. Farhana Yasmeen (Admin)',
    createdAt: '10 Apr 2024, 02:00 PM',
    updatedBy: 'Dr. Farhana Yasmeen (Admin)',
    updatedAt: '04 Sep 2026, 09:15 AM',
    linkedActivityCount: 95,
  },
  {
    id: 'STF-009',
    employeeCode: 'EMP-DOC-01',
    fullName: 'Dr. Ayesha Malik',
    fatherGuardianName: 'Dr. Abdul Malik',
    phone: '+92 300 1122334',
    alternatePhone: '',
    email: 'ayesha.malik@sharif-saeed.hospital',
    cnic: '35202-9012345-9',
    designation: 'Senior Interventional Cardiologist',
    departmentId: 'DEP-03',
    departmentName: 'Cardiology & CCU',
    staffCategory: 'Doctor',
    accessType: 'STAFF_RECORD_ONLY',
    assignedPortal: null,
    staffRole: null,
    username: null,
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: null,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '15 Jan 2024, 10:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '01 Sep 2026, 11:00 AM',
    linkedActivityCount: 45,
  },
  {
    id: 'STF-010',
    employeeCode: 'EMP-DOC-02',
    fullName: 'Dr. Tariq Qureshi',
    fatherGuardianName: 'Muhammad Ishaq Qureshi',
    phone: '+92 300 2233445',
    alternatePhone: '',
    email: 'tariq.qureshi@sharif-saeed.hospital',
    cnic: '35201-0123456-0',
    designation: 'Consultant General & Laparoscopic Surgeon',
    departmentId: 'DEP-02',
    departmentName: 'General & Laparoscopic Surgery',
    staffCategory: 'Doctor',
    accessType: 'STAFF_RECORD_ONLY',
    assignedPortal: null,
    staffRole: null,
    username: null,
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: null,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Feb 2024, 09:30 AM',
    updatedBy: 'Dr. Farhana Yasmeen (Admin)',
    updatedAt: '03 Sep 2026, 02:40 PM',
    linkedActivityCount: 38,
  },
  {
    id: 'STF-011',
    employeeCode: 'EMP-NUR-01',
    fullName: 'Sister Fatima Bibi',
    fatherGuardianName: 'Bashir Ahmed',
    phone: '+92 300 3344556',
    alternatePhone: '',
    email: 'fatima.bibi@sharif-saeed.hospital',
    cnic: '35202-1234567-8',
    designation: 'Head Emergency & Trauma Nurse',
    departmentId: 'DEP-07',
    departmentName: 'Emergency & Trauma Complex',
    staffCategory: 'Nursing',
    accessType: 'STAFF_RECORD_ONLY',
    assignedPortal: null,
    staffRole: null,
    username: null,
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: null,
    createdBy: 'Dr. Farhana Yasmeen (Admin)',
    createdAt: '15 Mar 2024, 08:30 AM',
    updatedBy: 'Dr. Farhana Yasmeen (Admin)',
    updatedAt: '02 Sep 2026, 10:15 AM',
    linkedActivityCount: 12,
  },
  {
    id: 'STF-012',
    employeeCode: 'EMP-FD-03',
    fullName: 'Kamran Asif',
    fatherGuardianName: 'Asif Mehmood',
    phone: '+92 300 4455667',
    alternatePhone: '',
    email: 'kamran.asif@sharif-saeed.hospital',
    cnic: '35201-3456789-4',
    designation: 'Night Billing Cashier',
    departmentId: 'DEP-09',
    departmentName: 'Hospital Administration & Executive Services',
    staffCategory: 'Billing / Cashier',
    accessType: 'PORTAL_USER',
    assignedPortal: 'front-desk',
    staffRole: 'Billing Officer',
    username: 'kamran.billing',
    status: 'INACTIVE',
    requirePasswordChange: false,
    lastLoginAt: '12 Aug 2026, 11:45 PM',
    createdBy: 'Dr. Farhana Yasmeen (Admin)',
    createdAt: '01 May 2024, 09:00 AM',
    updatedBy: 'Dr. Farhana Yasmeen (Admin)',
    updatedAt: '15 Aug 2026, 09:00 AM',
    statusChangedBy: 'Dr. Farhana Yasmeen (Admin)',
    statusChangedAt: '15 Aug 2026, 09:00 AM',
    linkedActivityCount: 24,
  },
  {
    id: 'STF-013',
    employeeCode: 'EMP-PH-03',
    fullName: 'Nasir Mehmood',
    fatherGuardianName: 'Mehmood Ul Hassan',
    phone: '+92 300 5566778',
    alternatePhone: '',
    email: 'nasir.mehmood@sharif-saeed.hospital',
    cnic: '35202-5678901-2',
    designation: 'Assistant Pharmacy Technician',
    departmentId: 'DEP-08',
    departmentName: 'Pharmacy & Central Dispensary',
    staffCategory: 'Pharmacy',
    accessType: 'STAFF_RECORD_ONLY',
    assignedPortal: null,
    staffRole: null,
    username: null,
    status: 'SUSPENDED',
    requirePasswordChange: false,
    lastLoginAt: null,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '15 Jun 2024, 10:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '25 Jul 2026, 11:30 AM',
    statusChangedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    statusChangedAt: '25 Jul 2026, 11:30 AM',
    linkedActivityCount: 18,
  },
  {
    id: 'STF-014',
    employeeCode: 'EMP-CLN-01',
    fullName: 'Muhammad Waqas',
    fatherGuardianName: 'Muhammad Rafiq',
    phone: '+92 300 6677889',
    alternatePhone: '',
    email: 'm.waqas@sharif-saeed.hospital',
    cnic: '35201-7890123-6',
    designation: 'Senior Medical Laboratory Technologist',
    departmentId: 'DEP-06',
    departmentName: 'Pathology & Diagnostic Laboratories',
    staffCategory: 'Clinical Support',
    accessType: 'STAFF_RECORD_ONLY',
    assignedPortal: null,
    staffRole: null,
    username: null,
    status: 'ACTIVE',
    requirePasswordChange: false,
    lastLoginAt: null,
    createdBy: 'Dr. Farhana Yasmeen (Admin)',
    createdAt: '01 Jul 2024, 09:30 AM',
    updatedBy: 'Dr. Farhana Yasmeen (Admin)',
    updatedAt: '05 Sep 2026, 01:20 PM',
    linkedActivityCount: 0,
  },
];

export class StaffUserService {
  /**
   * Retrieve all staff users from localStorage, initializing if empty
   */
  static getStaffUsers(): StaffUser[] {
    try {
      const stored = localStorage.getItem(STAFF_USERS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load staff users from localStorage, falling back to initial data', e);
    }
    // Initialize defaults
    StaffUserService.saveStaffUsers(INITIAL_STAFF_USERS);
    StaffUserService.saveCredentials(INITIAL_STAFF_CREDENTIALS);
    return INITIAL_STAFF_USERS;
  }

  /**
   * Save staff users dataset to localStorage
   */
  static saveStaffUsers(users: StaffUser[]): void {
    try {
      localStorage.setItem(STAFF_USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save staff users to localStorage', e);
    }
  }

  /**
   * Retrieve credentials store
   */
  static getCredentials(): StaffCredential[] {
    try {
      const stored = localStorage.getItem(STAFF_CREDENTIALS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load staff credentials from localStorage', e);
    }
    StaffUserService.saveCredentials(INITIAL_STAFF_CREDENTIALS);
    return INITIAL_STAFF_CREDENTIALS;
  }

  /**
   * Save credentials store
   */
  static saveCredentials(creds: StaffCredential[]): void {
    try {
      localStorage.setItem(STAFF_CREDENTIALS_STORAGE_KEY, JSON.stringify(creds));
    } catch (e) {
      console.error('Failed to save staff credentials to localStorage', e);
    }
  }

  /**
   * Retrieve audit logs
   */
  static getAuditLogs(): StaffAuditLogEntry[] {
    try {
      const stored = localStorage.getItem(STAFF_AUDIT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load staff audit logs from localStorage', e);
    }
    return [];
  }

  /**
   * Log an audit event
   */
  static logAudit(
    entry: Omit<StaffAuditLogEntry, 'id' | 'timestamp'>
  ): void {
    const logs = StaffUserService.getAuditLogs();
    const newEntry: StaffAuditLogEntry = {
      ...entry,
      id: `LOG-STF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: formatAuditTimestamp(),
    };
    logs.unshift(newEntry);
    try {
      localStorage.setItem(STAFF_AUDIT_STORAGE_KEY, JSON.stringify(logs.slice(0, 500)));
    } catch (e) {
      console.error('Failed to save staff audit log', e);
    }
  }

  /**
   * Get single staff user by ID
   */
  static getStaffUserById(id: string): StaffUser | undefined {
    const users = StaffUserService.getStaffUsers();
    return users.find((u) => u.id === id);
  }

  /**
   * Get staff user by username (case-insensitive)
   */
  static getStaffUserByUsername(username: string): StaffUser | undefined {
    const clean = username.trim().toLowerCase();
    const users = StaffUserService.getStaffUsers();
    return users.find((u) => u.username && u.username.toLowerCase() === clean);
  }

  /**
   * Get credential by staff user ID
   */
  static getCredentialByUserId(staffUserId: string): StaffCredential | undefined {
    const creds = StaffUserService.getCredentials();
    return creds.find((c) => c.staffUserId === staffUserId);
  }

  /**
   * Get credential by username
   */
  static getCredentialByUsername(username: string): StaffCredential | undefined {
    const clean = username.trim().toLowerCase();
    const creds = StaffUserService.getCredentials();
    return creds.find((c) => c.username.toLowerCase() === clean);
  }

  /**
   * Validate CNIC formatting (xxxxx-xxxxxxx-x)
   */
  static isValidCNIC(cnic?: string | null): boolean {
    if (!cnic || !cnic.trim()) return true; // optional
    const regex = /^\d{5}-\d{7}-\d{1}$/;
    return regex.test(cnic.trim());
  }

  /**
   * Validate password rules (min 8 chars, 1 letter, 1 number)
   */
  static isValidPassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long.' };
    }
    if (!/[A-Za-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one letter.' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number.' };
    }
    return { valid: true };
  }

  /**
   * Check if employeeCode is already in use
   */
  static isEmployeeCodeDuplicate(code: string, currentId?: string): boolean {
    const clean = code.trim().toLowerCase();
    const users = StaffUserService.getStaffUsers();
    return users.some(
      (u) => u.employeeCode.toLowerCase() === clean && u.id !== currentId
    );
  }

  /**
   * Check if username is already in use
   */
  static isUsernameDuplicate(username: string, currentId?: string): boolean {
    const clean = username.trim().toLowerCase();
    if (!clean) return false;
    const users = StaffUserService.getStaffUsers();
    return users.some(
      (u) => u.username && u.username.toLowerCase() === clean && u.id !== currentId
    );
  }

  /**
   * Generate next sequential Staff User ID e.g. STF-015
   */
  static generateNextId(): string {
    const users = StaffUserService.getStaffUsers();
    let maxNum = 0;
    users.forEach((u) => {
      const match = u.id.match(/^STF-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `STF-${String(maxNum + 1).padStart(3, '0')}`;
  }

  /**
   * Create a new Staff User
   */
  static createStaffUser(
    values: StaffUserFormValues,
    currentUser: User | null
  ): { success: boolean; user?: StaffUser; error?: string } {
    // 1. Basic validation
    if (!values.fullName.trim()) {
      return { success: false, error: 'Full Name is required.' };
    }
    if (!values.employeeCode.trim()) {
      return { success: false, error: 'Employee Code is required.' };
    }
    if (StaffUserService.isEmployeeCodeDuplicate(values.employeeCode)) {
      return {
        success: false,
        error: `Employee Code "${values.employeeCode}" is already in use by another staff member.`,
      };
    }
    if (!values.phone.trim()) {
      return { success: false, error: 'Primary phone number is required.' };
    }
    if (!values.designation.trim()) {
      return { success: false, error: 'Designation is required.' };
    }
    if (!values.departmentId) {
      return { success: false, error: 'Department selection is required.' };
    }
    if (values.cnic && !StaffUserService.isValidCNIC(values.cnic)) {
      return {
        success: false,
        error: 'Invalid CNIC format. Please use standard format (xxxxx-xxxxxxx-x).',
      };
    }

    // 2. Portal User specific validation
    if (values.accessType === 'PORTAL_USER') {
      if (!values.assignedPortal) {
        return { success: false, error: 'Assigned Portal is required for Portal User.' };
      }
      if (!values.staffRole) {
        return { success: false, error: 'Staff Role is required for Portal User.' };
      }
      const allowedRoles = STAFF_PORTAL_ROLES[values.assignedPortal as StaffPortalKey] || [];
      if (!allowedRoles.includes(values.staffRole as StaffRole)) {
        return {
          success: false,
          error: `Staff role "${values.staffRole}" is incompatible with portal "${values.assignedPortal}".`,
        };
      }
      if (!values.username.trim()) {
        return { success: false, error: 'Username is required for Portal User.' };
      }
      if (StaffUserService.isUsernameDuplicate(values.username)) {
        return {
          success: false,
          error: `Username "${values.username}" is already taken. Please choose another.`,
        };
      }
      if (!values.password) {
        return { success: false, error: 'Temporary password is required for Portal User.' };
      }
      const passValidation = StaffUserService.isValidPassword(values.password);
      if (!passValidation.valid) {
        return { success: false, error: passValidation.message };
      }
      if (values.password !== values.confirmPassword) {
        return { success: false, error: 'Password and Confirm Password do not match.' };
      }
    }

    // Resolve Department details
    const departments = DepartmentService.getDepartments();
    const dept = departments.find((d) => d.id === values.departmentId);
    const departmentName = dept ? dept.name : values.departmentName || 'General Department';

    const newId = StaffUserService.generateNextId();
    const timestamp = formatAuditTimestamp();
    const actor = formatAuditUser(currentUser);

    const newStaff: StaffUser = {
      id: newId,
      employeeCode: values.employeeCode.trim().toUpperCase(),
      fullName: values.fullName.trim(),
      fatherGuardianName: values.fatherGuardianName.trim() || undefined,
      phone: values.phone.trim(),
      alternatePhone: values.alternatePhone.trim() || undefined,
      email: values.email.trim().toLowerCase(),
      cnic: values.cnic.trim() || undefined,
      designation: values.designation.trim(),
      departmentId: values.departmentId,
      departmentName,
      staffCategory: values.staffCategory,
      accessType: values.accessType,
      assignedPortal: values.accessType === 'PORTAL_USER' ? (values.assignedPortal as StaffPortalKey) : null,
      staffRole: values.accessType === 'PORTAL_USER' ? values.staffRole : null,
      username: values.accessType === 'PORTAL_USER' ? values.username.trim().toLowerCase() : null,
      status: values.status,
      requirePasswordChange: values.accessType === 'PORTAL_USER' ? values.requirePasswordChange : false,
      lastLoginAt: null,
      createdBy: actor,
      createdAt: timestamp,
      updatedBy: actor,
      updatedAt: timestamp,
      linkedActivityCount: 0,
    };

    // Save Staff User
    const users = StaffUserService.getStaffUsers();
    users.unshift(newStaff);
    StaffUserService.saveStaffUsers(users);

    // Save Credentials if Portal User
    if (values.accessType === 'PORTAL_USER' && values.password) {
      const creds = StaffUserService.getCredentials();
      creds.push({
        staffUserId: newId,
        username: newStaff.username!,
        demoPassword: values.password,
        assignedPortal: newStaff.assignedPortal!,
        requirePasswordChange: values.requirePasswordChange,
        updatedAt: timestamp,
      });
      StaffUserService.saveCredentials(creds);
    }

    // Audit log
    StaffUserService.logAudit({
      staffUserId: newId,
      staffName: newStaff.fullName,
      employeeCode: newStaff.employeeCode,
      action: 'CREATE',
      actorName: currentUser?.name || 'Prof. Dr. Tariq Saeed',
      actorRole: currentUser?.role || 'Super Admin',
      details: `Created new staff user (${values.accessType === 'PORTAL_USER' ? `Portal: ${values.assignedPortal}` : 'Staff Record Only'})`,
    });

    return { success: true, user: newStaff };
  }

  /**
   * Update an existing Staff User
   */
  static updateStaffUser(
    id: string,
    values: StaffUserFormValues,
    currentUser: User | null
  ): { success: boolean; user?: StaffUser; error?: string } {
    const users = StaffUserService.getStaffUsers();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) {
      return { success: false, error: 'Staff user not found.' };
    }

    const existing = users[index];

    // Basic validation
    if (!values.fullName.trim()) {
      return { success: false, error: 'Full Name is required.' };
    }
    if (!values.employeeCode.trim()) {
      return { success: false, error: 'Employee Code is required.' };
    }
    if (StaffUserService.isEmployeeCodeDuplicate(values.employeeCode, id)) {
      return {
        success: false,
        error: `Employee Code "${values.employeeCode}" is already in use by another staff member.`,
      };
    }
    if (!values.phone.trim()) {
      return { success: false, error: 'Primary phone number is required.' };
    }
    if (!values.designation.trim()) {
      return { success: false, error: 'Designation is required.' };
    }
    if (!values.departmentId) {
      return { success: false, error: 'Department selection is required.' };
    }
    if (values.cnic && !StaffUserService.isValidCNIC(values.cnic)) {
      return {
        success: false,
        error: 'Invalid CNIC format. Please use standard format (xxxxx-xxxxxxx-x).',
      };
    }

    // Access type transitions & validation
    if (values.accessType === 'PORTAL_USER') {
      if (!values.assignedPortal) {
        return { success: false, error: 'Assigned Portal is required for Portal User.' };
      }
      if (!values.staffRole) {
        return { success: false, error: 'Staff Role is required for Portal User.' };
      }
      const allowedRoles = STAFF_PORTAL_ROLES[values.assignedPortal as StaffPortalKey] || [];
      if (!allowedRoles.includes(values.staffRole as StaffRole)) {
        return {
          success: false,
          error: `Staff role "${values.staffRole}" is incompatible with portal "${values.assignedPortal}".`,
        };
      }
      if (!values.username.trim()) {
        return { success: false, error: 'Username is required for Portal User.' };
      }
      if (StaffUserService.isUsernameDuplicate(values.username, id)) {
        return {
          success: false,
          error: `Username "${values.username}" is already taken. Please choose another.`,
        };
      }

      // If converting from STAFF_RECORD_ONLY to PORTAL_USER, password is required
      if (existing.accessType === 'STAFF_RECORD_ONLY') {
        if (!values.password) {
          return {
            success: false,
            error: 'Temporary password is required when enabling Portal User access.',
          };
        }
        const passValidation = StaffUserService.isValidPassword(values.password);
        if (!passValidation.valid) {
          return { success: false, error: passValidation.message };
        }
        if (values.password !== values.confirmPassword) {
          return { success: false, error: 'Password and Confirm Password do not match.' };
        }
      }
    }

    // Resolve Department details
    const departments = DepartmentService.getDepartments();
    const dept = departments.find((d) => d.id === values.departmentId);
    const departmentName = dept ? dept.name : values.departmentName || existing.departmentName;

    const timestamp = formatAuditTimestamp();
    const actor = formatAuditUser(currentUser);

    const updatedUser: StaffUser = {
      ...existing,
      employeeCode: values.employeeCode.trim().toUpperCase(),
      fullName: values.fullName.trim(),
      fatherGuardianName: values.fatherGuardianName.trim() || undefined,
      phone: values.phone.trim(),
      alternatePhone: values.alternatePhone.trim() || undefined,
      email: values.email.trim().toLowerCase(),
      cnic: values.cnic.trim() || undefined,
      designation: values.designation.trim(),
      departmentId: values.departmentId,
      departmentName,
      staffCategory: values.staffCategory,
      accessType: values.accessType,
      assignedPortal: values.accessType === 'PORTAL_USER' ? (values.assignedPortal as StaffPortalKey) : null,
      staffRole: values.accessType === 'PORTAL_USER' ? values.staffRole : null,
      username: values.accessType === 'PORTAL_USER' ? values.username.trim().toLowerCase() : null,
      status: values.status,
      requirePasswordChange:
        values.accessType === 'PORTAL_USER' ? values.requirePasswordChange : false,
      updatedBy: actor,
      updatedAt: timestamp,
    };

    users[index] = updatedUser;
    StaffUserService.saveStaffUsers(users);

    // Handle credentials updates
    const creds = StaffUserService.getCredentials();
    const credIndex = creds.findIndex((c) => c.staffUserId === id);

    if (values.accessType === 'PORTAL_USER') {
      if (credIndex >= 0) {
        // Update existing credentials record (portal/username/requirePasswordChange)
        creds[credIndex] = {
          ...creds[credIndex],
          username: updatedUser.username!,
          assignedPortal: updatedUser.assignedPortal!,
          requirePasswordChange: values.requirePasswordChange,
          updatedAt: timestamp,
          ...(values.password ? { demoPassword: values.password } : {}),
        };
      } else if (values.password) {
        // Create new credential record (converted from STAFF_RECORD_ONLY)
        creds.push({
          staffUserId: id,
          username: updatedUser.username!,
          demoPassword: values.password,
          assignedPortal: updatedUser.assignedPortal!,
          requirePasswordChange: values.requirePasswordChange,
          updatedAt: timestamp,
        });
      }
      StaffUserService.saveCredentials(creds);
    } else {
      // Converted to STAFF_RECORD_ONLY: remove credentials from login store
      if (credIndex >= 0) {
        creds.splice(credIndex, 1);
        StaffUserService.saveCredentials(creds);
      }
    }

    // Audit log
    StaffUserService.logAudit({
      staffUserId: id,
      staffName: updatedUser.fullName,
      employeeCode: updatedUser.employeeCode,
      action: 'UPDATE',
      actorName: currentUser?.name || 'Prof. Dr. Tariq Saeed',
      actorRole: currentUser?.role || 'Super Admin',
      details: `Updated staff profile details (Status: ${updatedUser.status}, Access: ${updatedUser.accessType})`,
    });

    return { success: true, user: updatedUser };
  }

  /**
   * Update staff account status (ACTIVE, INACTIVE, SUSPENDED)
   */
  static updateStaffStatus(
    id: string,
    newStatus: StaffStatus,
    currentUser: User | null
  ): { success: boolean; error?: string } {
    const users = StaffUserService.getStaffUsers();
    const user = users.find((u) => u.id === id);
    if (!user) {
      return { success: false, error: 'Staff user not found.' };
    }

    const timestamp = formatAuditTimestamp();
    const actor = formatAuditUser(currentUser);

    user.status = newStatus;
    user.statusChangedBy = actor;
    user.statusChangedAt = timestamp;
    user.updatedBy = actor;
    user.updatedAt = timestamp;

    StaffUserService.saveStaffUsers(users);

    StaffUserService.logAudit({
      staffUserId: id,
      staffName: user.fullName,
      employeeCode: user.employeeCode,
      action: 'STATUS_CHANGE',
      actorName: currentUser?.name || 'Prof. Dr. Tariq Saeed',
      actorRole: currentUser?.role || 'Super Admin',
      details: `Changed account status to ${newStatus}`,
    });

    return { success: true };
  }

  /**
   * Reset staff user password (Portal User only)
   */
  static resetStaffPassword(
    id: string,
    newPassword: string,
    requirePasswordChange: boolean,
    currentUser: User | null
  ): { success: boolean; error?: string } {
    const user = StaffUserService.getStaffUserById(id);
    if (!user) {
      return { success: false, error: 'Staff user not found.' };
    }
    if (user.accessType !== 'PORTAL_USER') {
      return { success: false, error: 'Cannot reset password for a Staff Record Only entry.' };
    }

    const validation = StaffUserService.isValidPassword(newPassword);
    if (!validation.valid) {
      return { success: false, error: validation.message };
    }

    const timestamp = formatAuditTimestamp();
    const actor = formatAuditUser(currentUser);

    // Update credential store
    const creds = StaffUserService.getCredentials();
    const credIndex = creds.findIndex((c) => c.staffUserId === id);
    if (credIndex >= 0) {
      creds[credIndex].demoPassword = newPassword;
      creds[credIndex].requirePasswordChange = requirePasswordChange;
      creds[credIndex].updatedAt = timestamp;
    } else {
      creds.push({
        staffUserId: id,
        username: user.username || `staff.${id.toLowerCase()}`,
        demoPassword: newPassword,
        assignedPortal: user.assignedPortal || 'front-desk',
        requirePasswordChange,
        updatedAt: timestamp,
      });
    }
    StaffUserService.saveCredentials(creds);

    // Update staff user record
    const users = StaffUserService.getStaffUsers();
    const u = users.find((item) => item.id === id);
    if (u) {
      u.passwordResetBy = actor;
      u.passwordResetAt = timestamp;
      u.requirePasswordChange = requirePasswordChange;
      u.updatedBy = actor;
      u.updatedAt = timestamp;
      StaffUserService.saveStaffUsers(users);
    }

    StaffUserService.logAudit({
      staffUserId: id,
      staffName: user.fullName,
      employeeCode: user.employeeCode,
      action: 'PASSWORD_RESET',
      actorName: currentUser?.name || 'Prof. Dr. Tariq Saeed',
      actorRole: currentUser?.role || 'Super Admin',
      details: 'Workstation credentials reset by management',
    });

    return { success: true };
  }

  /**
   * Delete staff user with activity safeguard
   */
  static deleteStaffUser(
    id: string,
    currentUser: User | null
  ): { success: boolean; error?: string } {
    const users = StaffUserService.getStaffUsers();
    const user = users.find((u) => u.id === id);
    if (!user) {
      return { success: false, error: 'Staff user not found.' };
    }

    // Safeguard check: If staff has recorded hospital activity, prevent hard deletion
    if (user.linkedActivityCount && user.linkedActivityCount > 0) {
      return {
        success: false,
        error:
          'This staff account has recorded hospital activity and cannot be permanently deleted. Deactivate it instead.',
      };
    }

    // Perform deletion
    const filteredUsers = users.filter((u) => u.id !== id);
    StaffUserService.saveStaffUsers(filteredUsers);

    // Clean up credentials
    const creds = StaffUserService.getCredentials().filter((c) => c.staffUserId !== id);
    StaffUserService.saveCredentials(creds);

    StaffUserService.logAudit({
      staffUserId: id,
      staffName: user.fullName,
      employeeCode: user.employeeCode,
      action: 'DELETE',
      actorName: currentUser?.name || 'Prof. Dr. Tariq Saeed',
      actorRole: currentUser?.role || 'Super Admin',
      details: `Permanently removed staff record (0 linked activities)`,
    });

    return { success: true };
  }

  /**
   * Record login time on authentication
   */
  static recordLogin(id: string): void {
    const users = StaffUserService.getStaffUsers();
    const user = users.find((u) => u.id === id);
    if (user) {
      user.lastLoginAt = formatAuditTimestamp();
      StaffUserService.saveStaffUsers(users);
    }
  }

  /**
   * Filter and search staff users
   */
  static filterStaffUsers(
    users: StaffUser[],
    filters: StaffUserFilterState
  ): StaffUser[] {
    const search = (filters.searchTerm || '').trim().toLowerCase();

    return users.filter((u) => {
      // 1. Search filter across Employee Code, Staff Name, Phone, Email, CNIC, Designation, Department, Username
      if (search) {
        const matchesSearch =
          u.employeeCode.toLowerCase().includes(search) ||
          u.fullName.toLowerCase().includes(search) ||
          u.phone.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          (u.cnic && u.cnic.toLowerCase().includes(search)) ||
          u.designation.toLowerCase().includes(search) ||
          u.departmentName.toLowerCase().includes(search) ||
          (u.username && u.username.toLowerCase().includes(search));

        if (!matchesSearch) return false;
      }

      // 2. Department filter
      if (filters.departmentId && filters.departmentId !== 'ALL') {
        if (u.departmentId !== filters.departmentId) return false;
      }

      // 3. Staff Category filter
      if (filters.staffCategory && filters.staffCategory !== 'ALL') {
        if (u.staffCategory !== filters.staffCategory) return false;
      }

      // 4. Access Type filter
      if (filters.accessType && filters.accessType !== 'ALL') {
        if (u.accessType !== filters.accessType) return false;
      }

      // 5. Assigned Portal filter
      if (filters.assignedPortal && filters.assignedPortal !== 'ALL') {
        if (u.assignedPortal !== filters.assignedPortal) return false;
      }

      // 6. Status filter
      if (filters.status && filters.status !== 'ALL') {
        if (u.status !== filters.status) return false;
      }

      // 7. Optional Staff Role filter
      if (filters.staffRole && filters.staffRole !== 'ALL') {
        if (u.staffRole !== filters.staffRole) return false;
      }

      return true;
    });
  }

  /**
   * Generate downloadable Excel import template
   */
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

  /**
   * Parse and validate uploaded Excel file
   */
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

          const existingUsers = StaffUserService.getStaffUsers();
          const existingCodes = new Set(existingUsers.map((u) => u.employeeCode.toLowerCase()));
          const existingUsernames = new Set(
            existingUsers.filter((u) => u.username).map((u) => u.username!.toLowerCase())
          );
          const existingCnics = new Set(
            existingUsers.filter((u) => u.cnic).map((u) => u.cnic!.toLowerCase())
          );

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
            const rowNumber = idx + 2; // header is row 1
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

            // Validate Employee Code
            if (!employeeCode) {
              errors.push('Employee Code is required.');
            } else if (existingCodes.has(employeeCode.toLowerCase())) {
              errors.push(`Employee Code "${employeeCode}" already exists in system.`);
            } else if (seenBatchCodes.has(employeeCode.toLowerCase())) {
              errors.push(`Duplicate Employee Code "${employeeCode}" within uploaded spreadsheet.`);
            } else {
              seenBatchCodes.add(employeeCode.toLowerCase());
            }

            // Validate Full Name
            if (!fullName) {
              errors.push('Staff Full Name is required.');
            }

            // Validate Phone
            if (!phone) {
              errors.push('Phone number is required.');
            }

            // Validate Designation
            if (!designation) {
              errors.push('Designation is required.');
            }

            // Validate Department
            let resolvedDept: { id: string; name: string } | undefined;
            if (!departmentCode) {
              errors.push('Department code is required.');
            } else {
              resolvedDept = deptMap.get(departmentCode.toLowerCase());
              if (!resolvedDept) {
                // Try keyword match
                resolvedDept = deptMap.get('dep-09'); // fallback
                if (!resolvedDept) {
                  errors.push(`Unknown department code "${departmentCode}".`);
                }
              }
            }

            // Validate Staff Category
            if (!staffCategory || !STAFF_CATEGORIES.includes(staffCategory as StaffCategory)) {
              errors.push(
                `Invalid staff category "${staffCategory}". Allowed: ${STAFF_CATEGORIES.slice(0, 5).join(', ')}...`
              );
            }

            // Validate Access Type
            if (accessType !== 'PORTAL_USER' && accessType !== 'STAFF_RECORD_ONLY') {
              errors.push('Access Type must be either PORTAL_USER or STAFF_RECORD_ONLY.');
            }

            // Portal User validations
            let validatedUsername: string | undefined;
            if (accessType === 'PORTAL_USER') {
              const validPortals: StaffPortalKey[] = ['front-desk', 'admission', 'inventory'];
              if (!assignedPortal || !validPortals.includes(assignedPortal as StaffPortalKey)) {
                errors.push('Assigned portal must be one of: front-desk, admission, inventory.');
              } else {
                // Validate role for selected portal
                const allowedRoles = STAFF_PORTAL_ROLES[assignedPortal as StaffPortalKey];
                if (!staffRole) {
                  errors.push(`Staff role is required for portal "${assignedPortal}".`);
                } else if (!allowedRoles.includes(staffRole as StaffRole)) {
                  errors.push(
                    `Role "${staffRole}" is invalid for portal "${assignedPortal}". Allowed: ${allowedRoles.join(', ')}`
                  );
                }
              }

              // Resolve username
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
                // Auto generate username: first.last
                const parts = fullName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
                let base = parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] || 'staff';
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

            // Validate CNIC format if present
            if (cnic) {
              if (!StaffUserService.isValidCNIC(cnic)) {
                errors.push('CNIC must follow format xxxxx-xxxxxxx-x.');
              } else if (existingCnics.has(cnic.toLowerCase())) {
                errors.push(`CNIC "${cnic}" already registered to another staff user.`);
              }
            }

            // Validate status
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
          resolve({
            totalRows: rows.length,
            validRows,
            invalidRows: rows.length - validRows,
            rows,
          });
        } catch (err: any) {
          reject(new Error(err?.message || 'Failed to parse Excel file. Please ensure it is a valid .xlsx file.'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file from disk.'));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Commit verified imported rows and generate temporary credentials for Portal Users
   */
  static commitImport(
    validRows: ImportedStaffRow[],
    currentUser: User | null
  ): {
    success: boolean;
    importedCount: number;
    generatedCredentials: {
      employeeCode: string;
      fullName: string;
      portal: string;
      role: string;
      username: string;
      temporaryPassword: string;
    }[];
  } {
    const departments = DepartmentService.getDepartments();
    const deptMap = new Map<string, { id: string; name: string }>();
    departments.forEach((d) => {
      deptMap.set(d.code.toLowerCase(), { id: d.id, name: d.name });
      deptMap.set(d.id.toLowerCase(), { id: d.id, name: d.name });
      deptMap.set(d.name.toLowerCase(), { id: d.id, name: d.name });
    });

    const timestamp = formatAuditTimestamp();
    const actor = formatAuditUser(currentUser);
    const users = StaffUserService.getStaffUsers();
    const creds = StaffUserService.getCredentials();

    const generatedCredentials: {
      employeeCode: string;
      fullName: string;
      portal: string;
      role: string;
      username: string;
      temporaryPassword: string;
    }[] = [];

    validRows.forEach((row) => {
      const newId = StaffUserService.generateNextId();
      const dept = deptMap.get(row.departmentCode.toLowerCase()) || {
        id: 'DEP-09',
        name: 'Hospital Administration & Executive Services',
      };

      // Generate random temporary password for Portal User
      const tempPassword = `Staff#${Math.floor(1000 + Math.random() * 9000)}`;

      const newStaff: StaffUser = {
        id: newId,
        employeeCode: row.employeeCode.toUpperCase(),
        fullName: row.fullName,
        fatherGuardianName: row.fatherGuardianName || undefined,
        phone: row.phone,
        alternatePhone: row.alternatePhone || undefined,
        email: row.email,
        cnic: row.cnic || undefined,
        designation: row.designation,
        departmentId: dept.id,
        departmentName: dept.name,
        staffCategory: row.staffCategory as StaffCategory,
        accessType: row.accessType as StaffAccessType,
        assignedPortal: row.accessType === 'PORTAL_USER' ? (row.assignedPortal as StaffPortalKey) : null,
        staffRole: row.accessType === 'PORTAL_USER' ? row.staffRole || null : null,
        username: row.accessType === 'PORTAL_USER' ? row.username || null : null,
        status: (row.status as StaffStatus) || 'ACTIVE',
        requirePasswordChange: true,
        lastLoginAt: null,
        createdBy: actor,
        createdAt: timestamp,
        updatedBy: actor,
        updatedAt: timestamp,
        linkedActivityCount: 0,
      };

      users.unshift(newStaff);

      if (row.accessType === 'PORTAL_USER' && newStaff.username && newStaff.assignedPortal) {
        creds.push({
          staffUserId: newId,
          username: newStaff.username,
          demoPassword: tempPassword,
          assignedPortal: newStaff.assignedPortal,
          requirePasswordChange: true,
          updatedAt: timestamp,
        });

        generatedCredentials.push({
          employeeCode: newStaff.employeeCode,
          fullName: newStaff.fullName,
          portal: newStaff.assignedPortal,
          role: newStaff.staffRole || 'Staff',
          username: newStaff.username,
          temporaryPassword: tempPassword,
        });
      }
    });

    StaffUserService.saveStaffUsers(users);
    StaffUserService.saveCredentials(creds);

    StaffUserService.logAudit({
      staffUserId: 'BATCH',
      staffName: 'Batch Import',
      employeeCode: 'MULTIPLE',
      action: 'IMPORT',
      actorName: currentUser?.name || 'Prof. Dr. Tariq Saeed',
      actorRole: currentUser?.role || 'Super Admin',
      details: `Successfully batch imported ${validRows.length} staff records`,
    });

    return {
      success: true,
      importedCount: validRows.length,
      generatedCredentials,
    };
  }

  /**
   * Download temporary credentials as Excel workbook
   */
  static downloadTemporaryCredentials(
    creds: {
      employeeCode: string;
      fullName: string;
      portal: string;
      role: string;
      username: string;
      temporaryPassword: string;
    }[]
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
