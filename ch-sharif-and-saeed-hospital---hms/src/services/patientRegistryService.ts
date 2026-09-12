import {
  Patient,
  PatientFormData,
  PatientFilterState,
  DuplicateCheckResult,
  ImportPatientRowResult,
  ImportSummary,
  PatientStatus,
  PatientGender,
  BloodGroup,
  PayerType,
  GuardianRelation,
  PATIENT_GENDERS,
  PAYER_TYPES,
  PATIENT_STATUSES,
  BLOOD_GROUPS,
  GUARDIAN_RELATIONS,
} from '../types/patient';
import { User } from '../types';
import { getPanelById, getPanelByCode } from './panelService';

const PATIENT_REGISTRY_STORAGE_KEY = 'hms_patient_registry_v1';
const CURRENT_OPERATIONAL_YEAR = 2026;

// Normalize Pakistani CNIC to XXXXX-XXXXXXX-X format
export function normalizeCnic(rawCnic?: string): string {
  if (!rawCnic) return '';
  const clean = rawCnic.replace(/\D/g, '');
  if (clean.length === 13) {
    return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12)}`;
  }
  return rawCnic.trim();
}

// Validate Pakistani CNIC format (13 digits formatted as 5-7-1)
export function isValidCnic(cnic: string): boolean {
  if (!cnic.trim()) return true; // optional
  const cnicPattern = /^\d{5}-\d{7}-\d{1}$/;
  return cnicPattern.test(cnic.trim());
}

// Normalize Pakistani phone number
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('92') && digits.length === 12) {
    return `0${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return phone.trim();
}

// Validate primary phone
export function isValidPhone(phone: string): boolean {
  if (!phone.trim()) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

// Calculate age from Date of Birth string (YYYY-MM-DD)
export function calculateAgeFromDob(dobString: string): number {
  if (!dobString) return 0;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return 0;

  // Use hospital operational year (2026) for consistent calculation
  const today = new Date(CURRENT_OPERATIONAL_YEAR, 8, 9); // Sep 9, 2026
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

// Initial realistic Pakistani hospital patient seed dataset
export const INITIAL_MOCK_PATIENTS: Patient[] = [
  {
    id: 'PAT-001',
    mrNumber: 'MR-2026-000001',
    fullName: 'Muhammad Tariq Khan',
    fatherGuardianName: 'Abdul Hameed Khan',
    guardianRelation: 'Father',
    dateOfBirth: '1980-04-14',
    age: 46,
    ageIsEstimated: false,
    gender: 'Male',
    cnic: '35202-1428591-3',
    passportNumber: 'PA992140',
    primaryPhone: '0300-8451293',
    alternatePhone: '0321-4920194',
    email: 'tariq.khan@gmail.com',
    addressLine1: 'House 42, Sector G-3, Phase 5, DHA',
    addressLine2: 'Near Jalal Sons',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'B+',
    payerType: 'Corporate / Panel',
    panelId: 'DEMO-PNL-01',
    panelName: 'Demo Corporate Panel A',
    panelMemberId: 'DEMO-MEM-0012',
    emergencyContactName: 'Abdul Hameed Khan',
    emergencyContactRelation: 'Father',
    emergencyContactPhone: '0300-4123456',
    status: 'ACTIVE',
    registrationDate: '2026-01-05',
    lastVisitDate: '2026-09-02',
    createdBy: 'Prof. Dr. Tariq Saeed',
    createdAt: '2026-01-05T09:15:00.000Z',
    updatedBy: 'Dr. Farhana Yasmeen',
    updatedAt: '2026-09-02T11:20:00.000Z',
  },
  {
    id: 'PAT-002',
    mrNumber: 'MR-2026-000002',
    fullName: 'Zainab Bibi',
    fatherGuardianName: 'Muhammad Aslam',
    guardianRelation: 'Spouse',
    dateOfBirth: '1992-08-22',
    age: 34,
    ageIsEstimated: false,
    gender: 'Female',
    cnic: '35201-9281726-2',
    passportNumber: '',
    primaryPhone: '0321-7788990',
    alternatePhone: '',
    email: 'zainab.aslam@outlook.com',
    addressLine1: 'Flat 12-B, Askari Heights, Cantt',
    addressLine2: 'Bedian Road',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'O+',
    payerType: 'Self Pay',
    panelId: '',
    panelName: '',
    panelMemberId: '',
    emergencyContactName: 'Muhammad Aslam',
    emergencyContactRelation: 'Spouse',
    emergencyContactPhone: '0321-9988771',
    status: 'ACTIVE',
    registrationDate: '2026-01-12',
    lastVisitDate: '2026-08-28',
    createdBy: 'Prof. Dr. Tariq Saeed',
    createdAt: '2026-01-12T10:30:00.000Z',
    updatedBy: 'Prof. Dr. Tariq Saeed',
    updatedAt: '2026-08-28T14:45:00.000Z',
  },
  {
    id: 'PAT-003',
    mrNumber: 'MR-2026-000003',
    fullName: 'Chaudhry Riaz Ahmad',
    fatherGuardianName: 'Chaudhry Ghulam Rasul',
    guardianRelation: 'Father',
    dateOfBirth: '1962-11-05',
    age: 63,
    ageIsEstimated: false,
    gender: 'Male',
    cnic: '35200-4829104-5',
    passportNumber: 'AB812901',
    primaryPhone: '0333-4192834',
    alternatePhone: '042-35712345',
    email: 'riaz.chaudhry@riaztextiles.com',
    addressLine1: 'Bungalow 18, Street 4, Gulberg III',
    addressLine2: 'Opposite Jamia Mosque',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'A+',
    payerType: 'Corporate / Panel',
    panelId: 'DEMO-PNL-02',
    panelName: 'Demo Insurance Panel B',
    panelMemberId: 'DEMO-MEM-0034',
    emergencyContactName: 'Hamza Riaz',
    emergencyContactRelation: 'Son',
    emergencyContactPhone: '0333-8899221',
    status: 'ACTIVE',
    registrationDate: '2026-01-20',
    lastVisitDate: '2026-09-04',
    createdBy: 'Prof. Dr. Tariq Saeed',
    createdAt: '2026-01-20T11:00:00.000Z',
    updatedBy: 'Dr. Farhana Yasmeen',
    updatedAt: '2026-09-04T16:10:00.000Z',
  },
  {
    id: 'PAT-004',
    mrNumber: 'MR-2026-000004',
    fullName: 'Fatima Zahra',
    fatherGuardianName: 'Syed Ali Raza',
    guardianRelation: 'Father',
    dateOfBirth: '2019-06-18',
    age: 7,
    ageIsEstimated: false,
    gender: 'Female',
    cnic: '',
    passportNumber: '',
    primaryPhone: '0345-6677881',
    alternatePhone: '',
    email: 'ali.raza@syedholdings.pk',
    addressLine1: 'House 88, Block F, Model Town',
    addressLine2: '',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'O-',
    payerType: 'Self Pay',
    panelId: '',
    panelName: '',
    panelMemberId: '',
    emergencyContactName: 'Syed Ali Raza',
    emergencyContactRelation: 'Father',
    emergencyContactPhone: '0345-6677881',
    status: 'ACTIVE',
    registrationDate: '2026-02-01',
    lastVisitDate: '2026-08-15',
    createdBy: 'Dr. Farhana Yasmeen',
    createdAt: '2026-02-01T08:45:00.000Z',
    updatedBy: 'Dr. Farhana Yasmeen',
    updatedAt: '2026-08-15T09:20:00.000Z',
  },
  {
    id: 'PAT-005',
    mrNumber: 'MR-2026-000005',
    fullName: 'Maj. (R) Khalid Mahmood',
    fatherGuardianName: 'Col. Muhammad Rafiq',
    guardianRelation: 'Father',
    dateOfBirth: '1955-03-30',
    age: 71,
    ageIsEstimated: false,
    gender: 'Male',
    cnic: '35201-1928374-7',
    passportNumber: 'PK771829',
    primaryPhone: '0301-9988112',
    alternatePhone: '0300-1122334',
    email: 'khalid.mahmood@fauji.org.pk',
    addressLine1: 'House 14-C, Officers Colony, Sarwar Road',
    addressLine2: 'Cantt',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'AB+',
    payerType: 'Corporate / Panel',
    panelId: 'DEMO-PNL-03',
    panelName: 'Demo Employer Panel C',
    panelMemberId: 'DEMO-MEM-0056',
    emergencyContactName: 'Begum Nasreen Khalid',
    emergencyContactRelation: 'Spouse',
    emergencyContactPhone: '0301-8877665',
    status: 'ACTIVE',
    registrationDate: '2026-02-10',
    lastVisitDate: '2026-09-01',
    createdBy: 'Prof. Dr. Tariq Saeed',
    createdAt: '2026-02-10T14:15:00.000Z',
    updatedBy: 'Dr. Farhana Yasmeen',
    updatedAt: '2026-09-01T15:00:00.000Z',
  },
  {
    id: 'PAT-006',
    mrNumber: 'MR-2026-000006',
    fullName: 'Amina Siddiqui',
    fatherGuardianName: 'Khurram Siddiqui',
    guardianRelation: 'Spouse',
    dateOfBirth: '1988-12-04',
    age: 37,
    ageIsEstimated: false,
    gender: 'Female',
    cnic: '35202-6677889-4',
    passportNumber: '',
    primaryPhone: '0322-4455667',
    alternatePhone: '',
    email: 'amina.siddiqui@gmail.com',
    addressLine1: 'Apartment 402, Royal Residencia, Johar Town',
    addressLine2: 'Phase 2',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'B-',
    payerType: 'Corporate / Panel',
    panelId: 'DEMO-PNL-02',
    panelName: 'Demo Insurance Panel B',
    panelMemberId: 'DEMO-MEM-0067',
    emergencyContactName: 'Khurram Siddiqui',
    emergencyContactRelation: 'Spouse',
    emergencyContactPhone: '0322-8877661',
    status: 'ACTIVE',
    registrationDate: '2026-02-22',
    lastVisitDate: '2026-07-20',
    createdBy: 'Dr. Farhana Yasmeen',
    createdAt: '2026-02-22T09:30:00.000Z',
    updatedBy: 'Dr. Farhana Yasmeen',
    updatedAt: '2026-07-20T10:15:00.000Z',
  },
  {
    id: 'PAT-007',
    mrNumber: 'MR-2026-000007',
    fullName: 'Abdul Rehman',
    fatherGuardianName: 'Bashir Ahmad',
    guardianRelation: 'Father',
    dateOfBirth: '',
    age: 52,
    ageIsEstimated: true,
    gender: 'Male',
    cnic: '35201-3849102-1',
    passportNumber: '',
    primaryPhone: '0312-8899001',
    alternatePhone: '',
    email: '',
    addressLine1: 'House 19, Mohallah Chah Miran',
    addressLine2: 'Misri Shah',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'Unknown',
    payerType: 'Self Pay',
    panelId: '',
    panelName: '',
    panelMemberId: '',
    emergencyContactName: 'Bashir Ahmad',
    emergencyContactRelation: 'Father',
    emergencyContactPhone: '0312-5544332',
    status: 'ACTIVE',
    registrationDate: '2026-03-01',
    lastVisitDate: '2026-08-30',
    createdBy: 'Prof. Dr. Tariq Saeed',
    createdAt: '2026-03-01T12:20:00.000Z',
    updatedBy: 'Prof. Dr. Tariq Saeed',
    updatedAt: '2026-08-30T13:00:00.000Z',
  },
  {
    id: 'PAT-008',
    mrNumber: 'MR-2026-000008',
    fullName: 'Shahnaz Begum',
    fatherGuardianName: 'Muhammad Sharif',
    guardianRelation: 'Spouse',
    dateOfBirth: '1948-07-19',
    age: 78,
    ageIsEstimated: false,
    gender: 'Female',
    cnic: '35202-9988776-6',
    passportNumber: '',
    primaryPhone: '0300-5544332',
    alternatePhone: '',
    email: '',
    addressLine1: 'House 112, Street 8, Samanabad',
    addressLine2: 'Poonch Road',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'A-',
    payerType: 'Self Pay',
    panelId: '',
    panelName: '',
    panelMemberId: '',
    emergencyContactName: 'Tariq Sharif',
    emergencyContactRelation: 'Son',
    emergencyContactPhone: '0300-1199228',
    status: 'ACTIVE',
    registrationDate: '2026-03-15',
    lastVisitDate: '2026-08-12',
    createdBy: 'Prof. Dr. Tariq Saeed',
    createdAt: '2026-03-15T11:40:00.000Z',
    updatedBy: 'Prof. Dr. Tariq Saeed',
    updatedAt: '2026-08-12T16:50:00.000Z',
  },
  {
    id: 'PAT-009',
    mrNumber: 'MR-2026-000009',
    fullName: 'Engr. Shahbaz Akhtar',
    fatherGuardianName: 'Akhtar Hussain',
    guardianRelation: 'Father',
    dateOfBirth: '1976-02-15',
    age: 50,
    ageIsEstimated: false,
    gender: 'Male',
    cnic: '35201-5544332-9',
    passportNumber: 'OG889102',
    primaryPhone: '0345-8877665',
    alternatePhone: '051-9201948',
    email: 'shahbaz.akhtar@ogdcl.gov.pk',
    addressLine1: 'House 5, Street 2, Cavalry Ground',
    addressLine2: 'Cantt',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'AB-',
    payerType: 'Corporate / Panel',
    panelId: 'DEMO-PNL-01',
    panelName: 'Demo Corporate Panel A',
    panelMemberId: 'DEMO-MEM-0089',
    emergencyContactName: 'Dr. Saima Shahbaz',
    emergencyContactRelation: 'Spouse',
    emergencyContactPhone: '0345-1122998',
    status: 'ACTIVE',
    registrationDate: '2026-03-25',
    lastVisitDate: '2026-08-04',
    createdBy: 'Dr. Farhana Yasmeen',
    createdAt: '2026-03-25T15:10:00.000Z',
    updatedBy: 'Dr. Farhana Yasmeen',
    updatedAt: '2026-08-04T11:00:00.000Z',
  },
  {
    id: 'PAT-010',
    mrNumber: 'MR-2026-000010',
    fullName: 'Late Haji Ghulam Rasool',
    fatherGuardianName: 'Karam Din',
    guardianRelation: 'Father',
    dateOfBirth: '1940-01-10',
    age: 86,
    ageIsEstimated: false,
    gender: 'Male',
    cnic: '35200-1122334-1',
    passportNumber: '',
    primaryPhone: '0300-4499881',
    alternatePhone: '',
    email: '',
    addressLine1: 'Haveli Ghulam Rasool, Walled City',
    addressLine2: 'Bhati Gate',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'O+',
    payerType: 'Self Pay',
    panelId: '',
    panelName: '',
    panelMemberId: '',
    emergencyContactName: 'Muhammad Munir Rasool',
    emergencyContactRelation: 'Son',
    emergencyContactPhone: '0300-4499881',
    status: 'DECEASED',
    registrationDate: '2026-04-02',
    lastVisitDate: '2026-07-14',
    createdBy: 'Prof. Dr. Tariq Saeed',
    createdAt: '2026-04-02T10:00:00.000Z',
    updatedBy: 'Prof. Dr. Tariq Saeed',
    updatedAt: '2026-07-15T09:30:00.000Z',
  },
  {
    id: 'PAT-011',
    mrNumber: 'MR-2026-000011',
    fullName: 'Naseem Akhtar',
    fatherGuardianName: 'Muhammad Yaqoob',
    guardianRelation: 'Spouse',
    dateOfBirth: '1970-09-18',
    age: 55,
    ageIsEstimated: false,
    gender: 'Female',
    cnic: '35202-7711229-8',
    passportNumber: '',
    primaryPhone: '0331-4455882',
    alternatePhone: '',
    email: '',
    addressLine1: 'House 28, Block D, Faisal Town',
    addressLine2: 'Near Kotha Pind',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'B+',
    payerType: 'Corporate / Panel',
    panelId: 'PNL-01',
    panelName: 'State Life Insurance Corporation (Sehat Card Plus)',
    panelMemberId: 'SLI-338819-PK',
    emergencyContactName: 'Muhammad Yaqoob',
    emergencyContactRelation: 'Spouse',
    emergencyContactPhone: '0331-9988112',
    status: 'INACTIVE',
    registrationDate: '2026-04-18',
    lastVisitDate: '2026-05-10',
    createdBy: 'Dr. Farhana Yasmeen',
    createdAt: '2026-04-18T13:45:00.000Z',
    updatedBy: 'Dr. Farhana Yasmeen',
    updatedAt: '2026-05-10T14:20:00.000Z',
  },
  {
    id: 'PAT-012',
    mrNumber: 'MR-2026-000012',
    fullName: 'Bilal Hassan Cheema',
    fatherGuardianName: 'Hassan Nisar Cheema',
    guardianRelation: 'Father',
    dateOfBirth: '1998-05-25',
    age: 28,
    ageIsEstimated: false,
    gender: 'Male',
    cnic: '35201-8899001-3',
    passportNumber: 'CH991823',
    primaryPhone: '0334-9988776',
    alternatePhone: '',
    email: 'bilal.cheema@techventures.io',
    addressLine1: 'Apartment 701, Indigo Heights, Gulberg III',
    addressLine2: 'Noor Jahan Road',
    city: 'Lahore',
    province: 'Punjab',
    country: 'Pakistan',
    bloodGroup: 'A+',
    payerType: 'Corporate / Panel',
    panelId: 'DEMO-PNL-03',
    panelName: 'Demo Employer Panel C',
    panelMemberId: 'DEMO-MEM-0099',
    emergencyContactName: 'Hassan Nisar Cheema',
    emergencyContactRelation: 'Father',
    emergencyContactPhone: '0334-1122334',
    status: 'ACTIVE',
    registrationDate: '2026-05-02',
    lastVisitDate: undefined, // Never visited
    createdBy: 'Prof. Dr. Tariq Saeed',
    createdAt: '2026-05-02T16:00:00.000Z',
    updatedBy: 'Prof. Dr. Tariq Saeed',
    updatedAt: '2026-05-02T16:00:00.000Z',
  },
];

// Initialize patient storage if not present
export function initPatientRegistry(): Patient[] {
  if (typeof window === 'undefined') return INITIAL_MOCK_PATIENTS;
  try {
    const raw = localStorage.getItem(PATIENT_REGISTRY_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(
        PATIENT_REGISTRY_STORAGE_KEY,
        JSON.stringify(INITIAL_MOCK_PATIENTS)
      );
      return INITIAL_MOCK_PATIENTS;
    }
    // Clean up any unverified real-world insurance corporate names from older sessions:
    if (
      raw.includes('State Life') ||
      raw.includes('PNL-01') ||
      raw.includes('EFU Life') ||
      raw.includes('Jubilee Life') ||
      raw.includes('Fauji Foundation') ||
      raw.includes('OGDCL') ||
      raw.includes('PSO')
    ) {
      localStorage.setItem(
        PATIENT_REGISTRY_STORAGE_KEY,
        JSON.stringify(INITIAL_MOCK_PATIENTS)
      );
      return INITIAL_MOCK_PATIENTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(
        PATIENT_REGISTRY_STORAGE_KEY,
        JSON.stringify(INITIAL_MOCK_PATIENTS)
      );
      return INITIAL_MOCK_PATIENTS;
    }
    return parsed;
  } catch {
    return INITIAL_MOCK_PATIENTS;
  }
}

// Persist patients to storage
function savePatients(patients: Patient[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PATIENT_REGISTRY_STORAGE_KEY, JSON.stringify(patients));
  } catch (err) {
    console.error('Failed to save patient registry to storage:', err);
  }
}

export function getAllPatients(): Patient[] {
  return initPatientRegistry();
}

export function getPatientById(id: string): Patient | undefined {
  const patients = getAllPatients();
  return patients.find((p) => p.id === id);
}

export function getPatientByMr(mrNumber: string): Patient | undefined {
  const patients = getAllPatients();
  const norm = mrNumber.trim().toUpperCase();
  return patients.find((p) => p.mrNumber.toUpperCase() === norm);
}

// Centralized MR Number generator
// Pattern: MR-YYYY-XXXXXX (e.g. MR-2026-000013)
// Auto-generated, unique, sequence collision-safe across storage reloads.
export function generateNextMrNumber(): string {
  const patients = getAllPatients();
  const year = CURRENT_OPERATIONAL_YEAR;
  const prefix = `MR-${year}-`;

  let maxSeq = 0;
  for (const p of patients) {
    if (p.mrNumber && p.mrNumber.startsWith(prefix)) {
      const seqStr = p.mrNumber.slice(prefix.length);
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  }

  // Next sequence candidate
  let candidateSeq = maxSeq + 1;
  let candidate = `${prefix}${String(candidateSeq).padStart(6, '0')}`;

  // Extra collision check against all existing patients
  const existingSet = new Set(patients.map((p) => p.mrNumber.toUpperCase()));
  while (existingSet.has(candidate.toUpperCase())) {
    candidateSeq++;
    candidate = `${prefix}${String(candidateSeq).padStart(6, '0')}`;
  }

  return candidate;
}

// Centralized duplicate check with tiered severity
export function checkDuplicates(
  candidate: {
    cnic?: string;
    passportNumber?: string;
    primaryPhone?: string;
    fullName?: string;
    fatherGuardianName?: string;
    dateOfBirth?: string;
  },
  excludePatientId?: string
): DuplicateCheckResult {
  const patients = getAllPatients();
  const otherPatients = excludePatientId
    ? patients.filter((p) => p.id !== excludePatientId)
    : patients;

  const normalizedCnic = normalizeCnic(candidate.cnic);
  const normalizedPassport = candidate.passportNumber?.trim().toUpperCase();
  const normalizedPhone = candidate.primaryPhone?.replace(/\D/g, '');
  const normalizedName = candidate.fullName?.trim().toLowerCase();
  const normalizedGuardian = candidate.fatherGuardianName?.trim().toLowerCase();
  const normalizedDob = candidate.dateOfBirth?.trim();

  // 1. STRONG / EXACT: Exact CNIC (Block saving)
  if (normalizedCnic && isValidCnic(normalizedCnic)) {
    const matched = otherPatients.filter(
      (p) => p.cnic && normalizeCnic(p.cnic) === normalizedCnic
    );
    if (matched.length > 0) {
      return {
        severity: 'STRONG_EXACT',
        isExactCnic: true,
        isExactPassport: false,
        isPossibleDuplicate: false,
        matchedPatients: matched,
        reason: `Existing registered patient found with identical CNIC (${normalizedCnic}). Registration blocked to prevent duplicate identity.`,
        matchType: 'EXACT_CNIC',
      };
    }
  }

  // 1b. STRONG / EXACT: Exact Passport (Block saving)
  if (normalizedPassport && normalizedPassport.length >= 6) {
    const matched = otherPatients.filter(
      (p) =>
        p.passportNumber &&
        p.passportNumber.trim().toUpperCase() === normalizedPassport
    );
    if (matched.length > 0) {
      return {
        severity: 'STRONG_EXACT',
        isExactCnic: false,
        isExactPassport: true,
        isPossibleDuplicate: false,
        matchedPatients: matched,
        reason: `Existing registered patient found with identical Passport (${normalizedPassport}). Registration blocked to prevent duplicate identity.`,
        matchType: 'EXACT_PASSPORT',
      };
    }
  }

  // 2. HIGH WARNING:
  // Same Full Name + Date of Birth
  if (normalizedName && normalizedDob) {
    const matched = otherPatients.filter(
      (p) =>
        p.fullName.trim().toLowerCase() === normalizedName &&
        p.dateOfBirth?.trim() === normalizedDob
    );
    if (matched.length > 0) {
      return {
        severity: 'HIGH_WARNING',
        isExactCnic: false,
        isExactPassport: false,
        isPossibleDuplicate: true,
        matchedPatients: matched,
        reason: 'High Probability Duplicate: Matched existing patient with identical Full Name and Date of Birth.',
        matchType: 'NAME_DOB',
      };
    }
  }

  // Same Full Name + Father/Guardian Name + Phone
  if (normalizedName && normalizedGuardian && normalizedPhone && normalizedPhone.length >= 10) {
    const matched = otherPatients.filter(
      (p) =>
        p.fullName.trim().toLowerCase() === normalizedName &&
        p.fatherGuardianName?.trim().toLowerCase() === normalizedGuardian &&
        p.primaryPhone &&
        p.primaryPhone.replace(/\D/g, '') === normalizedPhone
    );
    if (matched.length > 0) {
      return {
        severity: 'HIGH_WARNING',
        isExactCnic: false,
        isExactPassport: false,
        isPossibleDuplicate: true,
        matchedPatients: matched,
        reason: 'High Probability Duplicate: Matched existing patient with identical Full Name, Guardian Name, and Contact Phone.',
        matchType: 'NAME_GUARDIAN_PHONE',
      };
    }
  }

  // 3. WEAK WARNING:
  // Same Primary Phone only (normalized digits >= 10)
  if (normalizedPhone && normalizedPhone.length >= 10) {
    const matched = otherPatients.filter(
      (p) => p.primaryPhone && p.primaryPhone.replace(/\D/g, '') === normalizedPhone
    );
    if (matched.length > 0) {
      return {
        severity: 'WEAK_WARNING',
        isExactCnic: false,
        isExactPassport: false,
        isPossibleDuplicate: true,
        matchedPatients: matched,
        reason: 'Shared Contact Warning: Another registered patient shares this primary phone number.',
        matchType: 'PHONE_ONLY',
      };
    }
  }

  // Same Full Name only
  if (normalizedName && normalizedName.length >= 4) {
    const matched = otherPatients.filter(
      (p) => p.fullName.trim().toLowerCase() === normalizedName
    );
    if (matched.length > 0) {
      return {
        severity: 'WEAK_WARNING',
        isExactCnic: false,
        isExactPassport: false,
        isPossibleDuplicate: true,
        matchedPatients: matched,
        reason: 'Name Match Warning: An existing patient shares this full name.',
        matchType: 'NAME_ONLY',
      };
    }
  }

  return {
    severity: 'NONE',
    isExactCnic: false,
    isExactPassport: false,
    isPossibleDuplicate: false,
    matchedPatients: [],
    reason: '',
  };
}

export function resolveActorName(currentUser: User | null): string {
  if (currentUser?.name && currentUser.name.trim()) return currentUser.name;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('hms_auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.name && u.name.trim()) return u.name;
      }
    } catch {
      // ignore
    }
  }
  return 'Hospital Administrator';
}

// Create a new patient
export function createPatient(
  formData: PatientFormData,
  currentUser: User | null
): { success: boolean; patient?: Patient; error?: string; duplicateInfo?: DuplicateCheckResult } {
  // Validate Required Fields
  if (!formData.fullName.trim()) {
    return { success: false, error: 'Full Name is required.' };
  }
  if (!formData.gender) {
    return { success: false, error: 'Gender is required.' };
  }
  if (!formData.primaryPhone.trim()) {
    return { success: false, error: 'Primary Phone is required.' };
  }
  if (!isValidPhone(formData.primaryPhone)) {
    return {
      success: false,
      error: 'Please provide a valid phone number (at least 10 digits).',
    };
  }

  // CNIC validation
  const normalizedCnic = normalizeCnic(formData.cnic);
  if (normalizedCnic && !isValidCnic(normalizedCnic)) {
    return {
      success: false,
      error: 'CNIC must follow the Pakistani format: XXXXX-XXXXXXX-X (13 digits).',
    };
  }

  // Payer Type Validation
  if (!formData.payerType) {
    return { success: false, error: 'Payer Type is required.' };
  }
  if (formData.payerType === 'Corporate / Panel') {
    if (!formData.panelId) {
      return { success: false, error: 'Please select a Corporate Panel.' };
    }
    if (!formData.panelMemberId.trim()) {
      return {
        success: false,
        error: 'Panel Member ID / Card Number is required for Corporate / Panel payer.',
      };
    }
  }

  // Check Exact Duplicates (CNIC / Passport)
  const dupCheck = checkDuplicates({
    cnic: normalizedCnic,
    passportNumber: formData.passportNumber,
    primaryPhone: formData.primaryPhone,
    fullName: formData.fullName,
    fatherGuardianName: formData.fatherGuardianName,
    dateOfBirth: formData.dateOfBirth,
  });

  if (dupCheck.isExactCnic || dupCheck.isExactPassport) {
    return {
      success: false,
      error: dupCheck.reason,
      duplicateInfo: dupCheck,
    };
  }

  // Calculate age if DOB provided
  let finalAge = Number(formData.age) || 0;
  let finalAgeEstimated = formData.ageIsEstimated;
  if (formData.dateOfBirth) {
    finalAge = calculateAgeFromDob(formData.dateOfBirth);
    finalAgeEstimated = false;
  } else {
    finalAgeEstimated = true;
  }

  // Panel details resolution
  let panelName = '';
  if (formData.payerType === 'Corporate / Panel' && formData.panelId) {
    const p = getPanelById(formData.panelId);
    panelName = p ? p.name : formData.panelName;
  }

  // Generate MR Number
  const newMrNumber = generateNextMrNumber();
  const actorName = resolveActorName(currentUser);
  const todayStr = '2026-09-09';
  const nowIso = new Date().toISOString();

  const newPatient: Patient = {
    id: `PAT-${Date.now().toString().slice(-6)}`,
    mrNumber: newMrNumber,
    fullName: formData.fullName.trim(),
    fatherGuardianName: formData.fatherGuardianName.trim(),
    guardianRelation: formData.guardianRelation || 'Father',
    dateOfBirth: formData.dateOfBirth || undefined,
    age: finalAge,
    ageIsEstimated: finalAgeEstimated,
    gender: formData.gender,
    cnic: normalizedCnic || undefined,
    passportNumber: formData.passportNumber?.trim().toUpperCase() || undefined,
    primaryPhone: normalizePhone(formData.primaryPhone),
    alternatePhone: normalizePhone(formData.alternatePhone),
    email: formData.email.trim() || undefined,
    addressLine1: formData.addressLine1.trim() || undefined,
    addressLine2: formData.addressLine2.trim() || undefined,
    city: formData.city.trim() || 'Lahore',
    province: formData.province.trim() || 'Punjab',
    country: formData.country.trim() || 'Pakistan',
    bloodGroup: formData.bloodGroup || 'Unknown',
    payerType: formData.payerType,
    panelId: formData.payerType === 'Corporate / Panel' ? formData.panelId : undefined,
    panelName: formData.payerType === 'Corporate / Panel' ? panelName : undefined,
    panelMemberId:
      formData.payerType === 'Corporate / Panel'
        ? formData.panelMemberId.trim()
        : undefined,
    emergencyContactName: formData.emergencyContactName.trim() || undefined,
    emergencyContactRelation: formData.emergencyContactRelation.trim() || undefined,
    emergencyContactPhone: normalizePhone(formData.emergencyContactPhone) || undefined,
    status: formData.status || 'ACTIVE',
    registrationDate: todayStr,
    lastVisitDate: undefined,
    createdBy: actorName,
    createdAt: nowIso,
    updatedBy: actorName,
    updatedAt: nowIso,
  };

  const patients = getAllPatients();
  const updated = [newPatient, ...patients];
  savePatients(updated);

  return { success: true, patient: newPatient };
}

// Update existing patient (MR Number is strictly read-only and preserved)
export function updatePatient(
  id: string,
  formData: PatientFormData,
  currentUser: User | null
): { success: boolean; patient?: Patient; error?: string; duplicateInfo?: DuplicateCheckResult } {
  const patients = getAllPatients();
  const index = patients.findIndex((p) => p.id === id);
  if (index === -1) {
    return { success: false, error: 'Patient record not found.' };
  }

  const existing = patients[index];

  // Validate Required
  if (!formData.fullName.trim()) {
    return { success: false, error: 'Full Name is required.' };
  }
  if (!formData.gender) {
    return { success: false, error: 'Gender is required.' };
  }
  if (!formData.primaryPhone.trim()) {
    return { success: false, error: 'Primary Phone is required.' };
  }
  if (!isValidPhone(formData.primaryPhone)) {
    return {
      success: false,
      error: 'Please provide a valid phone number (at least 10 digits).',
    };
  }

  // CNIC validation
  const normalizedCnic = normalizeCnic(formData.cnic);
  if (normalizedCnic && !isValidCnic(normalizedCnic)) {
    return {
      success: false,
      error: 'CNIC must follow the Pakistani format: XXXXX-XXXXXXX-X (13 digits).',
    };
  }

  // Payer Type Validation
  if (!formData.payerType) {
    return { success: false, error: 'Payer Type is required.' };
  }
  if (formData.payerType === 'Corporate / Panel') {
    if (!formData.panelId) {
      return { success: false, error: 'Please select a Corporate Panel.' };
    }
    if (!formData.panelMemberId.trim()) {
      return {
        success: false,
        error: 'Panel Member ID / Card Number is required for Corporate / Panel payer.',
      };
    }
  }

  // Duplicate check excluding this patient
  const dupCheck = checkDuplicates(
    {
      cnic: normalizedCnic,
      passportNumber: formData.passportNumber,
      primaryPhone: formData.primaryPhone,
      fullName: formData.fullName,
      fatherGuardianName: formData.fatherGuardianName,
      dateOfBirth: formData.dateOfBirth,
    },
    id
  );

  if (dupCheck.isExactCnic || dupCheck.isExactPassport) {
    return {
      success: false,
      error: dupCheck.reason,
      duplicateInfo: dupCheck,
    };
  }

  // Age calculation
  let finalAge = Number(formData.age) || 0;
  let finalAgeEstimated = formData.ageIsEstimated;
  if (formData.dateOfBirth) {
    finalAge = calculateAgeFromDob(formData.dateOfBirth);
    finalAgeEstimated = false;
  } else {
    finalAgeEstimated = true;
  }

  let panelName = '';
  if (formData.payerType === 'Corporate / Panel' && formData.panelId) {
    const p = getPanelById(formData.panelId);
    panelName = p ? p.name : formData.panelName;
  }

  const actorName = resolveActorName(currentUser);
  const nowIso = new Date().toISOString();

  const updatedPatient: Patient = {
    ...existing,
    // Permanent MR number is NEVER overwritten:
    mrNumber: existing.mrNumber,
    fullName: formData.fullName.trim(),
    fatherGuardianName: formData.fatherGuardianName.trim(),
    guardianRelation: formData.guardianRelation || 'Father',
    dateOfBirth: formData.dateOfBirth || undefined,
    age: finalAge,
    ageIsEstimated: finalAgeEstimated,
    gender: formData.gender,
    cnic: normalizedCnic || undefined,
    passportNumber: formData.passportNumber?.trim().toUpperCase() || undefined,
    primaryPhone: normalizePhone(formData.primaryPhone),
    alternatePhone: normalizePhone(formData.alternatePhone),
    email: formData.email.trim() || undefined,
    addressLine1: formData.addressLine1.trim() || undefined,
    addressLine2: formData.addressLine2.trim() || undefined,
    city: formData.city.trim() || 'Lahore',
    province: formData.province.trim() || 'Punjab',
    country: formData.country.trim() || 'Pakistan',
    bloodGroup: formData.bloodGroup || 'Unknown',
    payerType: formData.payerType,
    panelId: formData.payerType === 'Corporate / Panel' ? formData.panelId : undefined,
    panelName: formData.payerType === 'Corporate / Panel' ? panelName : undefined,
    panelMemberId:
      formData.payerType === 'Corporate / Panel'
        ? formData.panelMemberId.trim()
        : undefined,
    emergencyContactName: formData.emergencyContactName.trim() || undefined,
    emergencyContactRelation: formData.emergencyContactRelation.trim() || undefined,
    emergencyContactPhone: normalizePhone(formData.emergencyContactPhone) || undefined,
    status: formData.status,
    updatedBy: actorName,
    updatedAt: nowIso,
  };

  patients[index] = updatedPatient;
  savePatients(patients);

  return { success: true, patient: updatedPatient };
}

// Update patient status (ACTIVE, INACTIVE, DECEASED)
export function updatePatientStatus(
  id: string,
  newStatus: PatientStatus,
  currentUser: User | null
): { success: boolean; patient?: Patient; error?: string } {
  const patients = getAllPatients();
  const index = patients.findIndex((p) => p.id === id);
  if (index === -1) {
    return { success: false, error: 'Patient not found.' };
  }

  const existing = patients[index];
  const actorName = resolveActorName(currentUser);

  existing.status = newStatus;
  existing.updatedBy = actorName;
  existing.updatedAt = new Date().toISOString();

  patients[index] = existing;
  savePatients(patients);

  return { success: true, patient: existing };
}

// Filter and search engine (Logical AND across all active parameters)
export function filterPatients(
  patients: Patient[],
  filters: PatientFilterState
): Patient[] {
  return patients.filter((patient) => {
    // 1. Search across MR Number, Patient Name, CNIC, Phone, Panel Member ID
    if (filters.searchTerm.trim()) {
      const q = filters.searchTerm.trim().toLowerCase();
      const matchMr = patient.mrNumber.toLowerCase().includes(q);
      const matchName = patient.fullName.toLowerCase().includes(q);
      const matchCnic = patient.cnic ? patient.cnic.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || patient.cnic.toLowerCase().includes(q) : false;
      const matchPhone = patient.primaryPhone ? patient.primaryPhone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || patient.primaryPhone.toLowerCase().includes(q) : false;
      const matchPanelMember = patient.panelMemberId ? patient.panelMemberId.toLowerCase().includes(q) : false;

      if (!matchMr && !matchName && !matchCnic && !matchPhone && !matchPanelMember) {
        return false;
      }
    }

    // 2. Gender Filter
    if (filters.gender !== 'ALL' && patient.gender !== filters.gender) {
      return false;
    }

    // 3. Payer Type Filter
    if (filters.payerType !== 'ALL' && patient.payerType !== filters.payerType) {
      return false;
    }

    // 4. Panel Filter
    if (filters.panelId !== 'ALL') {
      if (patient.payerType !== 'Corporate / Panel' || patient.panelId !== filters.panelId) {
        return false;
      }
    }

    // 5. Status Filter
    if (filters.status !== 'ALL' && patient.status !== filters.status) {
      return false;
    }

    return true;
  });
}

// Calculate KPI Cards summary from a single dataset
export function getPatientRegistryKpis(patients: Patient[]) {
  const total = patients.length;
  const active = patients.filter((p) => p.status === 'ACTIVE').length;
  const selfPay = patients.filter((p) => p.payerType === 'Self Pay').length;
  const panel = patients.filter((p) => p.payerType === 'Corporate / Panel').length;

  // New registrations this month (e.g., in 2026-09)
  const currentMonthPrefix = '2026-09';
  const newThisMonth = patients.filter(
    (p) => p.registrationDate && p.registrationDate.startsWith(currentMonthPrefix)
  ).length;

  return {
    total,
    active,
    selfPay,
    panel,
    newThisMonth,
  };
}

// Validate single row for Excel Import
export function validateImportRow(
  row: Record<string, any>,
  rowNumber: number,
  existingPatients: Patient[],
  stagedNewPatients: Patient[]
): ImportPatientRowResult {
  const errors: string[] = [];
  const allKnown = [...existingPatients, ...stagedNewPatients];

  const fullName = String(row['full_name'] || '').trim();
  const fatherGuardianName = String(row['father_guardian_name'] || '').trim();
  const rawGuardianRelation = String(row['guardian_relation'] || 'Father').trim();
  const dobStr = String(row['date_of_birth'] || '').trim();
  const rawAge = row['age'];
  const rawGender = String(row['gender'] || '').trim();
  const rawCnic = String(row['cnic'] || '').trim();
  const rawPassport = String(row['passport_number'] || '').trim();
  const rawPhone = String(row['primary_phone'] || '').trim();
  const altPhone = String(row['alternate_phone'] || '').trim();
  const email = String(row['email'] || '').trim();
  const addressLine1 = String(row['address_line_1'] || '').trim();
  const addressLine2 = String(row['address_line_2'] || '').trim();
  const city = String(row['city'] || 'Lahore').trim();
  const province = String(row['province'] || 'Punjab').trim();
  const country = String(row['country'] || 'Pakistan').trim();
  const rawBlood = String(row['blood_group'] || 'Unknown').trim();
  const rawPayer = String(row['payer_type'] || 'Self Pay').trim();
  const rawPanelCode = String(row['panel_code'] || '').trim();
  const rawPanelMemberId = String(row['panel_member_id'] || '').trim();
  const emergencyName = String(row['emergency_contact_name'] || '').trim();
  const emergencyRelation = String(row['emergency_contact_relation'] || '').trim();
  const emergencyPhone = String(row['emergency_contact_phone'] || '').trim();
  const rawStatus = String(row['status'] || 'ACTIVE').trim().toUpperCase();

  // 1. Name
  if (!fullName) {
    errors.push('Missing patient full_name');
  }

  // 2. Gender
  let gender: PatientGender = 'Other / Not Specified';
  const normGender = rawGender.toLowerCase();
  if (normGender === 'male' || normGender === 'm') {
    gender = 'Male';
  } else if (normGender === 'female' || normGender === 'f') {
    gender = 'Female';
  } else if (normGender.includes('other') || normGender.includes('not specified')) {
    gender = 'Other / Not Specified';
  } else if (!rawGender) {
    errors.push('Missing gender');
  } else {
    errors.push(`Invalid gender "${rawGender}". Allowed: Male, Female, Other / Not Specified`);
  }

  // 3. Phone
  if (!rawPhone) {
    errors.push('Missing primary_phone');
  } else if (!isValidPhone(rawPhone)) {
    errors.push(`Invalid primary_phone "${rawPhone}"`);
  }

  // 4. CNIC
  const normalizedCnic = normalizeCnic(rawCnic);
  if (normalizedCnic && !isValidCnic(normalizedCnic)) {
    errors.push(`Invalid CNIC "${rawCnic}". Format must be 5-7-1 digits (e.g. 35202-1234567-1)`);
  }

  // 5. DOB / Age
  let age = 0;
  let ageIsEstimated = true;
  if (dobStr) {
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) {
      errors.push(`Invalid date_of_birth "${dobStr}". Format: YYYY-MM-DD`);
    } else {
      age = calculateAgeFromDob(dobStr);
      ageIsEstimated = false;
    }
  } else {
    age = parseInt(String(rawAge), 10);
    if (isNaN(age) || age < 0 || age > 125) {
      errors.push(`Invalid age "${rawAge}". Must be an integer between 0 and 125`);
    } else {
      ageIsEstimated = true;
    }
  }

  // 6. Blood Group
  let bloodGroup: BloodGroup = 'Unknown';
  if (rawBlood) {
    const matchBlood = BLOOD_GROUPS.find(
      (b) => b.toUpperCase() === rawBlood.toUpperCase()
    );
    if (matchBlood) {
      bloodGroup = matchBlood;
    } else {
      errors.push(`Invalid blood_group "${rawBlood}". Allowed: Unknown, A+, A-, B+, B-, AB+, AB-, O+, O-`);
    }
  }

  // 7. Payer Type
  let payerType: PayerType = 'Self Pay';
  const normPayer = rawPayer.toLowerCase();
  if (normPayer.includes('panel') || normPayer.includes('corporate')) {
    payerType = 'Corporate / Panel';
  } else if (normPayer.includes('self')) {
    payerType = 'Self Pay';
  } else {
    errors.push(`Invalid payer_type "${rawPayer}". Allowed: Self Pay, Corporate / Panel`);
  }

  let resolvedPanelId: string | undefined;
  let resolvedPanelName: string | undefined;
  if (payerType === 'Corporate / Panel') {
    if (!rawPanelCode) {
      errors.push('panel_code is required when payer_type is Corporate / Panel');
    } else {
      const p = getPanelByCode(rawPanelCode);
      if (!p) {
        errors.push(`Unknown panel_code "${rawPanelCode}". Verify panel code in system.`);
      } else {
        resolvedPanelId = p.id;
        resolvedPanelName = p.name;
      }
    }
    if (!rawPanelMemberId) {
      errors.push('panel_member_id is required when payer_type is Corporate / Panel');
    }
  }

  // 8. Status
  let status: PatientStatus = 'ACTIVE';
  if (rawStatus === 'ACTIVE' || rawStatus === 'INACTIVE' || rawStatus === 'DECEASED') {
    status = rawStatus as PatientStatus;
  } else {
    errors.push(`Invalid status "${rawStatus}". Allowed: ACTIVE, INACTIVE, DECEASED`);
  }

  // 9. Email
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push(`Invalid email format "${email}"`);
  }

  // Duplicate Check against allKnown
  let existingMr: string | undefined;
  let isExactDup = false;
  let isPossibleDup = false;

  // Exact CNIC duplicate
  if (normalizedCnic && isValidCnic(normalizedCnic)) {
    const cnicMatch = allKnown.find(
      (p) => p.cnic && normalizeCnic(p.cnic) === normalizedCnic
    );
    if (cnicMatch) {
      isExactDup = true;
      existingMr = cnicMatch.mrNumber;
      errors.push(`Exact duplicate CNIC already registered under ${existingMr} (${cnicMatch.fullName})`);
    }
  }

  // Exact Passport duplicate
  if (!isExactDup && rawPassport) {
    const passMatch = allKnown.find(
      (p) =>
        p.passportNumber &&
        p.passportNumber.toUpperCase() === rawPassport.toUpperCase()
    );
    if (passMatch) {
      isExactDup = true;
      existingMr = passMatch.mrNumber;
      errors.push(`Exact duplicate Passport already registered under ${existingMr} (${passMatch.fullName})`);
    }
  }

  // Possible duplicate (phone or name + father)
  if (!isExactDup) {
    const normPhone = rawPhone.replace(/\D/g, '');
    const phoneMatch = allKnown.find(
      (p) => p.primaryPhone && p.primaryPhone.replace(/\D/g, '') === normPhone
    );
    if (phoneMatch) {
      isPossibleDup = true;
      existingMr = phoneMatch.mrNumber;
    }
  }

  let rowStatus: 'VALID' | 'INVALID' | 'POSSIBLE_DUPLICATE' | 'EXACT_DUPLICATE' = 'VALID';
  if (isExactDup) {
    rowStatus = 'EXACT_DUPLICATE';
  } else if (errors.length > 0) {
    rowStatus = 'INVALID';
  } else if (isPossibleDup) {
    rowStatus = 'POSSIBLE_DUPLICATE';
  }

  let guardianRelation: GuardianRelation = 'Father';
  if (rawGuardianRelation && GUARDIAN_RELATIONS.includes(rawGuardianRelation as GuardianRelation)) {
    guardianRelation = rawGuardianRelation as GuardianRelation;
  }

  let patientObj: Patient | undefined;
  if (errors.length === 0 && !isExactDup) {
    patientObj = {
      id: `PAT-IMP-${rowNumber}-${Date.now().toString().slice(-4)}`,
      mrNumber: '', // will be assigned on commit
      fullName,
      fatherGuardianName,
      guardianRelation,
      dateOfBirth: dobStr || undefined,
      age,
      ageIsEstimated,
      gender,
      cnic: normalizedCnic || undefined,
      passportNumber: rawPassport.toUpperCase() || undefined,
      primaryPhone: normalizePhone(rawPhone),
      alternatePhone: normalizePhone(altPhone) || undefined,
      email: email || undefined,
      addressLine1: addressLine1 || undefined,
      addressLine2: addressLine2 || undefined,
      city,
      province,
      country,
      bloodGroup,
      payerType,
      panelId: resolvedPanelId,
      panelName: resolvedPanelName,
      panelMemberId: rawPanelMemberId || undefined,
      emergencyContactName: emergencyName || undefined,
      emergencyContactRelation: emergencyRelation || undefined,
      emergencyContactPhone: normalizePhone(emergencyPhone) || undefined,
      status,
      registrationDate: '2026-09-09',
      lastVisitDate: undefined,
      createdBy: 'Prof. Dr. Tariq Saeed',
      createdAt: new Date().toISOString(),
      updatedBy: 'Prof. Dr. Tariq Saeed',
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    rowNumber,
    data: row,
    patient: patientObj,
    status: rowStatus,
    existingMrNumber: existingMr,
    errors,
  };
}

// Commit batch imported patients
export function commitBatchPatients(
  validResults: ImportPatientRowResult[],
  currentUser: User | null
): ImportSummary {
  const currentPatients = getAllPatients();
  const actorName = resolveActorName(currentUser);
  const nowIso = new Date().toISOString();

  let createdCount = 0;
  let duplicatesSkipped = 0;
  let rowsFailed = 0;
  const errorRows: ImportPatientRowResult[] = [];
  const newlyCreatedPatients: Patient[] = [];

  for (const r of validResults) {
    if (r.status === 'EXACT_DUPLICATE') {
      duplicatesSkipped++;
      errorRows.push(r);
      continue;
    }
    if (r.status === 'INVALID' || !r.patient) {
      rowsFailed++;
      errorRows.push(r);
      continue;
    }

    // Allocate safe permanent MR Number
    const nextMr = generateNextMrNumber();
    const patientWithMr: Patient = {
      ...r.patient,
      mrNumber: nextMr,
      createdBy: actorName,
      createdAt: nowIso,
      updatedBy: actorName,
      updatedAt: nowIso,
    };

    newlyCreatedPatients.push(patientWithMr);
    // Add to current set so subsequent records in this batch won't get colliding MR
    currentPatients.unshift(patientWithMr);
    createdCount++;
  }

  savePatients(currentPatients);

  return {
    rowsProcessed: validResults.length,
    patientsCreated: createdCount,
    duplicatesSkipped,
    rowsFailed,
    errorRows,
  };
}
