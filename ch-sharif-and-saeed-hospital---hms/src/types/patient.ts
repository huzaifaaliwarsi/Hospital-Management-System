export type PatientGender = 'Male' | 'Female' | 'Other / Not Specified';
export type PayerType = 'Self Pay' | 'Corporate / Panel';
export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'DECEASED';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown';
export type GuardianRelation =
  | 'Father'
  | 'Mother'
  | 'Spouse'
  | 'Sibling'
  | 'Son'
  | 'Daughter'
  | 'Relative'
  | 'Guardian'
  | 'Other';

export const PATIENT_GENDERS: PatientGender[] = ['Male', 'Female', 'Other / Not Specified'];
export const PAYER_TYPES: PayerType[] = ['Self Pay', 'Corporate / Panel'];
export const PATIENT_STATUSES: PatientStatus[] = ['ACTIVE', 'INACTIVE', 'DECEASED'];
export const BLOOD_GROUPS: BloodGroup[] = ['Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const GUARDIAN_RELATIONS: GuardianRelation[] = [
  'Father',
  'Mother',
  'Spouse',
  'Sibling',
  'Son',
  'Daughter',
  'Relative',
  'Guardian',
  'Other',
];

export interface Patient {
  id: string;
  mrNumber: string; // Permanent, unique (e.g. MR-000001)

  fullName: string;
  fatherGuardianName: string;
  guardianRelation: GuardianRelation;

  dateOfBirth?: string; // YYYY-MM-DD
  age: number;
  ageIsEstimated: boolean;

  gender: PatientGender;

  cnic?: string; // Normalized: XXXXX-XXXXXXX-X
  passportNumber?: string;

  primaryPhone: string;
  alternatePhone?: string;
  email?: string;

  addressLine1?: string;
  addressLine2?: string;
  city: string;
  province: string;
  country: string;

  bloodGroup: BloodGroup;

  payerType: PayerType;

  panelId?: string;
  panelName?: string;
  panelMemberId?: string;

  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;

  status: PatientStatus;

  registrationDate: string; // YYYY-MM-DD

  lastVisitDate?: string; // Read-only summary or undefined

  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface PatientFormData {
  fullName: string;
  fatherGuardianName: string;
  guardianRelation: GuardianRelation;

  dateOfBirth: string;
  age: number | string;
  ageIsEstimated: boolean;

  gender: PatientGender;

  cnic: string;
  passportNumber: string;

  primaryPhone: string;
  alternatePhone: string;
  email: string;

  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  country: string;

  bloodGroup: BloodGroup;

  payerType: PayerType;

  panelId: string;
  panelName: string;
  panelMemberId: string;

  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;

  status: PatientStatus;
}

export interface PatientFilterState {
  searchTerm: string;
  gender: 'ALL' | PatientGender;
  payerType: 'ALL' | PayerType;
  panelId: 'ALL' | string;
  status: 'ALL' | PatientStatus;
}

export type DuplicateSeverity = 'STRONG_EXACT' | 'HIGH_WARNING' | 'WEAK_WARNING' | 'NONE';

export interface DuplicateCheckResult {
  severity: DuplicateSeverity;
  isExactCnic: boolean;
  isExactPassport: boolean;
  isPossibleDuplicate: boolean;
  matchedPatients: Patient[];
  reason: string;
  matchType?: 'EXACT_CNIC' | 'EXACT_PASSPORT' | 'NAME_DOB' | 'NAME_GUARDIAN_PHONE' | 'NAME_ONLY' | 'PHONE_ONLY';
}

export interface ImportPatientRowResult {
  rowNumber: number;
  data: Record<string, any>;
  patient?: Patient;
  status: 'VALID' | 'INVALID' | 'POSSIBLE_DUPLICATE' | 'EXACT_DUPLICATE';
  existingMrNumber?: string;
  errors: string[];
}

export interface ImportSummary {
  rowsProcessed: number;
  patientsCreated: number;
  duplicatesSkipped: number;
  rowsFailed: number;
  errorRows: ImportPatientRowResult[];
}
