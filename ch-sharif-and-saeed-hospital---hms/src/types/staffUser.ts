import { PortalKey } from './index';

export type StaffAccessType = 'PORTAL_USER' | 'STAFF_RECORD_ONLY';

export type StaffPortalKey = 'front-desk' | 'admission' | 'inventory';

export type StaffCategory =
  | 'Front Desk / Reception'
  | 'Billing / Cashier'
  | 'Admission'
  | 'Pharmacy'
  | 'Inventory / Store'
  | 'Doctor'
  | 'Nursing'
  | 'Clinical Support'
  | 'Administrative Support'
  | 'Other';

export type StaffRole =
  // Front Desk & Billing
  | 'Front Desk Officer'
  | 'Receptionist'
  | 'Billing Officer'
  | 'Senior Billing Officer / Cashier'
  // Admission
  | 'Admission Officer'
  | 'Admission Coordinator'
  | 'Ward Coordinator'
  // Pharmacy
  | 'Pharmacist'
  | 'Pharmacy Cashier'
  | 'Pharmacy Assistant'
  // Inventory
  | 'Store Manager'
  | 'Inventory Officer'
  | 'Store Keeper';

export type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface StaffUser {
  id: string; // e.g. 'STF-001'
  employeeCode: string; // e.g. 'EMP-FD-01'

  fullName: string;
  fatherGuardianName?: string;

  phone: string;
  alternatePhone?: string;
  email: string;
  cnic?: string; // Pakistan CNIC: xxxxx-xxxxxxx-x

  designation: string;

  departmentId: string;
  departmentName: string;
  // Multi-department assignment (junction table) — populated for all staff;
  // only meaningful / editable for Doctor-category staff.
  departmentIds: string[];     // all assigned dept IDs including primary
  departmentNames: string[];   // display names in same order

  staffCategory: StaffCategory;

  accessType: StaffAccessType;

  assignedPortal: StaffPortalKey | null;
  staffRole: StaffRole | string | null;

  username: string | null;

  status: StaffStatus;
  requirePasswordChange: boolean;

  lastLoginAt: string | null;

  createdBy: string;
  createdAt: string;

  updatedBy: string;
  updatedAt: string;

  statusChangedBy?: string;
  statusChangedAt?: string;

  passwordResetBy?: string;
  passwordResetAt?: string;

  // v7.2 Doctor Clinical Discharge Authorization (HMS_V7.2_NEW_REQUIREMENTS.md
  // §2.4) — separate from portal login above; only meaningful for doctors,
  // but present on every row (undefined/false when not configured).
  clinicalAuthUsername?: string | null;
  clinicalAuthActive?: boolean;
  clinicalAuthUpdatedAt?: string;
  doctorSponsoredDiscountTrackingEnabled?: boolean;

  linkedActivityCount: number;
  notes?: string;
  baseSalary?: number;
  commissionEnabled?: boolean;
}

export interface StaffCredential {
  staffUserId: string;
  username: string;
  demoPassword: string; // Isolated credential, never exported in normal directory
  assignedPortal: StaffPortalKey;
  requirePasswordChange: boolean;
  updatedAt: string;
}

export interface StaffUserFormValues {
  fullName: string;
  employeeCode: string;
  fatherGuardianName: string;
  cnic: string;
  phone: string;
  alternatePhone: string;
  email: string;

  designation: string;
  departmentId: string;
  departmentName: string;
  // For Doctor multi-department assignment
  departmentIds?: string[];
  staffCategory: StaffCategory;
  status: StaffStatus;

  accessType: StaffAccessType;

  assignedPortal: StaffPortalKey | '';
  staffRole: string;
  username: string;
  password?: string;
  confirmPassword?: string;
  requirePasswordChange: boolean;

  // v7.2 (HMS_V7.2_NEW_REQUIREMENTS.md §2.3/§3.1) — only meaningful when staffCategory === 'Doctor'.
  doctorSponsoredDiscountTrackingEnabled: boolean;

  // Canonical Salary & Commission compensation integration
  salaryEnabled?: boolean;
  salaryBasis?: 'MONTHLY' | 'PER_DAY';
  baseSalary?: number;
  salaryEffectiveFrom?: string;
  commissionEnabled?: boolean;

  // v7.2 Doctor Patient Discharge Credentials (Clinical Discharge Authorization)
  clinicalAuthUsername?: string;
  clinicalAuthPassword?: string;
  clinicalAuthActive?: boolean;
}

export interface StaffUserFilterState {
  searchTerm: string;
  departmentId: string; // 'ALL' | string
  staffCategory: string; // 'ALL' | StaffCategory
  accessType: string; // 'ALL' | StaffAccessType
  assignedPortal: string; // 'ALL' | StaffPortalKey
  status: string; // 'ALL' | StaffStatus
  staffRole?: string; // 'ALL' | string
}

export interface StaffAuditLogEntry {
  id: string;
  staffUserId: string;
  staffName: string;
  employeeCode: string;
  action: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'PASSWORD_RESET' | 'DELETE' | 'IMPORT';
  actorName: string;
  actorRole: string;
  timestamp: string;
  details: string;
}

export interface ImportedStaffRow {
  rowNumber: number;
  employeeCode: string;
  fullName: string;
  fatherGuardianName?: string;
  phone: string;
  alternatePhone?: string;
  email: string;
  cnic?: string;
  designation: string;
  departmentCode: string;
  departmentName?: string;
  staffCategory: string;
  accessType: string;
  assignedPortal?: string;
  staffRole?: string;
  username?: string;
  status: string;

  isValid: boolean;
  errors: string[];
}

export interface StaffImportValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportedStaffRow[];
}

export const STAFF_PORTAL_ROLES: Record<StaffPortalKey, StaffRole[]> = {
  'front-desk': [
    'Front Desk Officer',
    'Receptionist',
    'Billing Officer',
    'Senior Billing Officer / Cashier',
  ],
  admission: [
    'Admission Officer',
    'Admission Coordinator',
    'Ward Coordinator',
  ],
  inventory: [
    'Store Manager',
    'Inventory Officer',
    'Store Keeper',
  ],
};

export const STAFF_CATEGORIES: StaffCategory[] = [
  'Front Desk / Reception',
  'Billing / Cashier',
  'Admission',
  'Pharmacy',
  'Inventory / Store',
  'Doctor',
  'Nursing',
  'Clinical Support',
  'Administrative Support',
  'Other',
];

export const STAFF_PORTALS: { key: StaffPortalKey; label: string }[] = [
  { key: 'front-desk', label: 'Front Desk & Billing' },
  { key: 'admission', label: 'Admission' },
  { key: 'inventory', label: 'Inventory' },
];
