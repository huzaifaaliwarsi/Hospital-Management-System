import { NavGroup, PortalConfig, User } from '../types';
import {
  getHospitalProfile,
  formatHospitalAddress,
  getProfileFieldValue,
} from '../services/hospitalProfileService';
import { CANONICAL_HOSPITAL_MANAGEMENT_NAV_GROUPS } from './portalNavigations';

/**
 * Centralized Hospital Information
 * Strictly delegates to the centralized hospitalProfileService.
 * Zero fabricated registration, tax, or contact numbers.
 */
export const HOSPITAL_INFO = {
  get name() {
    return getHospitalProfile().name || 'CH Sharif and Saeed Hospital';
  },
  get shortName() {
    return getHospitalProfile().shortName || 'CSS Hospital';
  },
  get city() {
    const p = getHospitalProfile();
    return p.city ? (p.country ? `${p.city}, ${p.country}` : p.city) : 'Not configured';
  },
  get phone() {
    return getProfileFieldValue(getHospitalProfile().primaryPhone);
  },
  get emergencyLine() {
    return getProfileFieldValue(getHospitalProfile().emergencyPhone);
  },
  get email() {
    return getProfileFieldValue(getHospitalProfile().primaryEmail);
  },
  get website() {
    return getProfileFieldValue(getHospitalProfile().website);
  },
  get registrationNo() {
    return getProfileFieldValue(getHospitalProfile().registrationNumber);
  },
  get licenseNo() {
    return getProfileFieldValue(getHospitalProfile().licenseNumber);
  },
  get ntn() {
    return getProfileFieldValue(getHospitalProfile().taxNumber);
  },
  get address() {
    return formatHospitalAddress(getHospitalProfile());
  },
};

export const SOFTWARE_PROVIDER = {
  name: 'iSysware Software Solutions',
  tagline: 'Enterprise Healthcare Intelligence',
  version: 'v2.4.0-Enterprise',
  supportEmail: 'support@isysware.com',
  website: 'www.isysware.com',
};

export const DEFAULT_MOCK_USER: User = {
  id: 'usr_superadmin_01',
  username: 'superadmin',
  name: 'Super Admin',
  email: 'superadmin@sharif-saeed.hospital',
  role: 'Super Admin',
  portal: 'super-admin',
  allowedPortals: [
    'super-admin',
  ],
  department: 'Hospital Administration & Governance',
  lastLogin: 'Today at 08:30 AM',
  isSuperAdminProtected: true,
};

export const PORTALS: PortalConfig[] = [
  {
    id: 'super-admin',
    key: 'super-admin',
    name: 'Super Admin Portal',
    portalCode: 'SUPER ADMIN PORTAL',
    shortName: 'Super Admin',
    routePrefix: '/super-admin',
    defaultRoute: '/super-admin/dashboard',
    loginRoute: '/login/super-admin',
    role: 'Super Admin',
    description: 'Unrestricted central governance, audit oversight, settings & admin control',
    badgeBg: 'bg-slate-900 border-slate-700',
    badgeText: 'text-slate-100',
    accentColor: '#0f172a',
    allowedRoles: ['Super Admin'],
  },
  {
    id: 'admin',
    key: 'admin',
    name: 'Hospital Admin Portal',
    portalCode: 'ADMIN PORTAL',
    shortName: 'Admin',
    routePrefix: '/admin',
    defaultRoute: '/admin/dashboard',
    loginRoute: '/login/admin',
    role: 'Admin',
    description: 'Operational management across doctors, services, admissions & billing',
    badgeBg: 'bg-[#effaf5] border-[#c2e7db]',
    badgeText: 'text-[#08775A]',
    accentColor: '#08775A',
    allowedRoles: ['Admin'],
  },
  {
    id: 'front-desk',
    key: 'front-desk',
    name: 'Front Desk & Billing Desk',
    portalCode: 'FRONT DESK & BILLING',
    shortName: 'Front Desk',
    routePrefix: '/front-desk',
    defaultRoute: '/front-desk/dashboard',
    loginRoute: '/login/front-desk',
    role: 'Front Desk & Billing',
    description: 'Patient token issuance, OPD registration, invoice cashiering & receipts',
    badgeBg: 'bg-[#effaf5] border-[#c2e7db]',
    badgeText: 'text-[#08775A]',
    accentColor: '#149E75',
    allowedRoles: ['Billing Officer', 'Front Desk & Billing'],
  },
  {
    id: 'admission',
    key: 'admission',
    name: 'Inpatient & Admission Desk',
    portalCode: 'ADMISSION PORTAL',
    shortName: 'Admission',
    routePrefix: '/admission',
    defaultRoute: '/admission/dashboard',
    loginRoute: '/login/admission',
    role: 'Admission',
    description: 'Bed allocation, ward management, admission notes & IPD discharge',
    badgeBg: 'bg-[#effaf5] border-[#c2e7db]',
    badgeText: 'text-[#08775A]',
    accentColor: '#0f766e',
    allowedRoles: ['Admission Officer', 'Admission'],
  },
  {
    id: 'inventory',
    key: 'inventory',
    name: 'Central Inventory & Stores',
    portalCode: 'INVENTORY MANAGEMENT',
    shortName: 'Inventory',
    routePrefix: '/inventory',
    defaultRoute: '/inventory/dashboard',
    loginRoute: '/login/inventory',
    role: 'Inventory Management',
    description: 'Bulk procurement, GRN logs, supplier ledgers, stock alerts & transfer notes',
    badgeBg: 'bg-amber-900 border-amber-700',
    badgeText: 'text-amber-100',
    accentColor: '#78350f',
    allowedRoles: ['Store Manager', 'Inventory Management'],
  },
];

/**
 * @deprecated Legacy monolithic navigation definition retired in Phase 0.1 architecture alignment.
 * Active HMS portals strictly use PORTAL_NAVIGATION_MAP and CANONICAL_HOSPITAL_MANAGEMENT_NAV_GROUPS.
 */
export const NAVIGATION_GROUPS: NavGroup[] = CANONICAL_HOSPITAL_MANAGEMENT_NAV_GROUPS;

export const MOCK_DEPARTMENTS = [
  { id: 'dept_cardiology', name: 'Cardiology & Cath Lab', head: 'Prof. Dr. Tariq Saeed' },
  { id: 'dept_ortho', name: 'Orthopedics & Spine Surgery', head: 'Dr. M. Sharif Chaudhary' },
  { id: 'dept_peds', name: 'Pediatrics & Neonatology', head: 'Dr. Ayesha Malik' },
  { id: 'dept_genmed', name: 'General Medicine & Diabetology', head: 'Dr. Salman Haider' },
  { id: 'dept_gynae', name: 'Obstetrics & Gynaecology', head: 'Dr. Farhana Yasmeen' },
  { id: 'dept_gensurg', name: 'General & Laparoscopic Surgery', head: 'Dr. Kamran Akram' },
  { id: 'dept_er', name: 'Emergency & Trauma Center', head: 'Dr. Bilal Qureshi' },
  { id: 'dept_nephro', name: 'Nephrology & Dialysis', head: 'Dr. Usman Ghani' },
];

export const MOCK_DOCTORS = [
  { id: 'doc_1', name: 'Prof. Dr. Tariq Saeed', department: 'Cardiology & Cath Lab', fee: 3500, room: 'Room 102 - Executive Block' },
  { id: 'doc_2', name: 'Dr. M. Sharif Chaudhary', department: 'Orthopedics & Spine Surgery', fee: 3000, room: 'Room 108 - Ortho Clinic' },
  { id: 'doc_3', name: 'Dr. Ayesha Malik', department: 'Pediatrics & Neonatology', fee: 2500, room: 'Room 204 - Child Care' },
  { id: 'doc_4', name: 'Dr. Salman Haider', department: 'General Medicine & Diabetology', fee: 2000, room: 'Room 105 - OPD Wing' },
  { id: 'doc_5', name: 'Dr. Farhana Yasmeen', department: 'Obstetrics & Gynaecology', fee: 3000, room: 'Room 210 - Maternal Health' },
  { id: 'doc_6', name: 'Dr. Kamran Akram', department: 'General & Laparoscopic Surgery', fee: 3500, room: 'Room 114 - Surgical OPD' },
];

export const MOCK_PAYMENT_METHODS = [
  { id: 'cash', name: 'Cash Counter (PKR)', icon: 'Banknote' },
  { id: 'jazzcash_easypaisa', name: 'JazzCash / EasyPaisa QR', icon: 'Smartphone' },
  { id: 'pos_card', name: 'Credit/Debit Card (POS Terminal)', icon: 'CreditCard' },
  { id: 'bank_transfer', name: 'Direct Bank Transfer (IBAN)', icon: 'Building' },
  { id: 'panel_insurance', name: 'Corporate Panel / Insurance Approval', icon: 'Shield' },
];

export const MOCK_SERVICES = [
  { id: 'srv_1', name: 'General OPD Consultation', code: 'SRV-OPD-01', rate: 2000, department: 'General Medicine' },
  { id: 'srv_2', name: 'Specialist Physician Review', code: 'SRV-OPD-02', rate: 3500, department: 'Cardiology' },
  { id: 'srv_3', name: 'Emergency Triage & Resuscitation', code: 'SRV-ER-01', rate: 4500, department: 'Emergency' },
  { id: 'srv_4', name: 'Digital X-Ray Chest PA', code: 'SRV-RAD-04', rate: 1800, department: 'Radiology' },
  { id: 'srv_5', name: 'Complete Blood Count (CBC)', code: 'SRV-LAB-01', rate: 950, department: 'Pathology' },
  { id: 'srv_6', name: 'Echocardiography (2D Color Doppler)', code: 'SRV-CARD-08', rate: 7500, department: 'Cardiology' },
  { id: 'srv_7', name: 'Private Deluxe Room Bed Charge (Per Day)', code: 'SRV-IPD-03', rate: 12000, department: 'Inpatient' },
];
