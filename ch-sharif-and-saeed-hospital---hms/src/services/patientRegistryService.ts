import apiClient from './apiClient';
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
  BLOOD_GROUPS,
  GUARDIAN_RELATIONS,
} from '../types/patient';
import { User } from '../types';
import { getPanelByCode } from './panelService';

/**
 * Live Patient Registry service. This Super Admin screen is the
 * **Panel Patient Registry** (§4.6 D16 p.7): a permanent, reusable patient
 * identity always tied to a Corporate Panel — backed by
 * `/api/v1/patients/panel`. Self-pay visitors are, by design, a separate
 * *temporary, per-visit* identity (`/api/v1/patients/encounters`) that is
 * never reused across visits and has no permanent registry record — they
 * still show up here (read-only) if present, but are registered/edited at
 * Front Desk, not in this master registry. Same in-memory-cache pattern as
 * the other rewired services — never localStorage.
 */

// Normalize Pakistani CNIC to XXXXX-XXXXXXX-X format
export function normalizeCnic(rawCnic?: string): string {
  if (!rawCnic) return '';
  const clean = rawCnic.replace(/\D/g, '');
  if (clean.length === 13) {
    return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12)}`;
  }
  return rawCnic.trim();
}

export function isValidCnic(cnic: string): boolean {
  if (!cnic.trim()) return true; // optional
  return /^\d{5}-\d{7}-\d{1}$/.test(cnic.trim());
}

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

export function isValidPhone(phone: string): boolean {
  if (!phone.trim()) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/** Age as of today — never a fixed/hardcoded reference date. */
export function calculateAgeFromDob(dobString: string): number {
  if (!dobString) return 0;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return Math.max(0, age);
}

function formatIsoDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Maps a backend `PanelPatient` row onto the frontend `Patient` shape. */
function toPatientFromPanel(raw: Record<string, any>): Patient {
  const cnicOrPassport: string = raw.cnicOrPassport || '';
  const looksLikeCnic = isValidCnic(cnicOrPassport);
  const phoneCnicMatch = (raw.emergencyContactPhone || '').match(/CNIC:\s*([0-9-]{13,15})/i);
  const guardianCnic = phoneCnicMatch ? phoneCnicMatch[1] : undefined;
  return {
    id: raw.id,
    mrNumber: raw.mrNumber,
    fullName: raw.fullName,
    fatherGuardianName: raw.guardianName || '',
    guardianRelation: (raw.guardianRelation as GuardianRelation) || 'Father',
    guardianCnic,
    dateOfBirth: formatIsoDate(raw.dob) || undefined,
    age: raw.dob ? calculateAgeFromDob(raw.dob) : 0,
    ageIsEstimated: !raw.dob,
    gender: (raw.gender as PatientGender) || 'Other / Not Specified',
    cnic: cnicOrPassport && looksLikeCnic ? cnicOrPassport : undefined,
    passportNumber: cnicOrPassport && !looksLikeCnic ? cnicOrPassport : undefined,
    primaryPhone: raw.phone || '',
    alternatePhone: raw.alternatePhone || undefined,
    email: raw.email || undefined,
    addressLine1: raw.addressLine1 || undefined,
    addressLine2: raw.addressLine2 || undefined,
    city: raw.city || '',
    province: raw.province || '',
    country: raw.country || '',
    bloodGroup: (raw.bloodGroup as BloodGroup) || 'Unknown',
    payerType: 'Corporate / Panel',
    panelId: raw.corporatePanelId,
    panelName: raw.corporatePanel?.organizationName || '',
    panelMemberId: raw.panelMemberId || undefined,
    emergencyContactName: raw.emergencyContactName || undefined,
    emergencyContactRelation: raw.emergencyContactRelation || undefined,
    emergencyContactPhone: raw.emergencyContactPhone || undefined,
    status: (raw.status as PatientStatus) || 'ACTIVE',
    registrationDate: formatIsoDate(raw.createdAt),
    lastVisitDate: undefined,
    createdBy: raw.createdByLabel || 'System',
    createdAt: raw.createdAt,
    updatedBy: raw.updatedByLabel || 'System',
    updatedAt: raw.updatedAt,
  };
}

/** Maps a backend `SelfPayEncounter` row — with a proper, standard hospital MR number. */
function toPatientFromSelfPay(raw: Record<string, any>, seq?: number): Patient {
  const cnicOrPassport: string = raw.cnicOrPassport || '';
  const looksLikeCnic = isValidCnic(cnicOrPassport);
  const mrNumber =
    raw.mrNumber ||
    (seq != null
      ? `MR-${String(seq).padStart(6, '0')}`
      : `MR-${String(raw.id || '').replace(/-/g, '').slice(0, 6).toUpperCase()}`);

  const rawGuardian: string = raw.guardianName || '';
  const cnicMatch = rawGuardian.match(/\[CNIC:\s*([0-9-]{13,15})\]/i);
  const guardianCnic = cnicMatch ? cnicMatch[1] : undefined;
  const cleanGuardianName = rawGuardian.replace(/\s*\[CNIC:.*?\]/i, '').trim();

  return {
    id: raw.id,
    mrNumber,
    fullName: raw.fullName,
    fatherGuardianName: cleanGuardianName,
    guardianRelation: 'Father',
    guardianCnic,
    dateOfBirth: formatIsoDate(raw.dob) || undefined,
    age: raw.dob ? calculateAgeFromDob(raw.dob) : 0,
    ageIsEstimated: !raw.dob,
    gender: (raw.gender as PatientGender) || 'Other / Not Specified',
    cnic: cnicOrPassport && looksLikeCnic ? cnicOrPassport : undefined,
    passportNumber: cnicOrPassport && !looksLikeCnic ? cnicOrPassport : undefined,
    primaryPhone: raw.phone || '',
    city: '',
    province: '',
    country: '',
    bloodGroup: 'Unknown',
    payerType: 'Self Pay',
    status: raw.isActive === false ? 'INACTIVE' : 'ACTIVE',
    registrationDate: formatIsoDate(raw.createdAt),
    lastVisitDate: undefined,
    createdBy: 'System',
    createdAt: raw.createdAt,
    updatedBy: 'System',
    updatedAt: raw.createdAt,
  };
}

let cachedPatients: Patient[] = [];

export async function fetchPatients(): Promise<Patient[]> {
  const [panelRes, selfPayRes] = await Promise.all([
    apiClient.get<{ data: Record<string, any>[] }>('/patients/panel', { params: { pageSize: 200 } }),
    apiClient.get<{ data: Record<string, any>[] }>('/patients/encounters'),
  ]);

  const panelPatients = panelRes.data.data.map(toPatientFromPanel);

  // Extract all existing numeric sequences used by panel patients to prevent collisions
  const usedNumbers = new Set<number>();
  for (const p of panelPatients) {
    const match = p.mrNumber?.match(/MR-(?:\d{2,4}-)?(\d+)/);
    if (match) usedNumbers.add(parseInt(match[1], 10));
  }

  // Sort self-pay encounters chronologically
  const sortedSelfPay = [...selfPayRes.data.data].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );

  let nextSeq = 1;
  const selfPayPatients = sortedSelfPay.map((raw) => {
    while (usedNumbers.has(nextSeq)) {
      nextSeq++;
    }
    const assignedSeq = nextSeq++;
    usedNumbers.add(assignedSeq);
    return toPatientFromSelfPay(raw, assignedSeq);
  });

  cachedPatients = [...panelPatients, ...selfPayPatients];
  return cachedPatients;
}

export async function primePatientRegistryCache(): Promise<void> {
  try {
    await fetchPatients();
  } catch {
    // Leave cache empty; the Patient Registry page itself will surface the real error on its own fetch.
  }
}

export function getAllPatients(): Patient[] {
  return cachedPatients;
}

export function getPatientById(id: string): Patient | undefined {
  return cachedPatients.find((p) => p.id === id);
}

export function getPatientByMr(mrNumber: string): Patient | undefined {
  return cachedPatients.find((p) => p.mrNumber === mrNumber);
}

/** Preview only — the real, race-free MR number is assigned server-side on create. */
export function generateNextMrNumber(): string {
  const totalCount = cachedPatients.length;
  return `MR-${String(totalCount + 1).padStart(6, '0')}`;
}

export interface PanelPatientSearchResult {
  id: string;
  fullName: string;
  mrNumber: string;
  cnicOrPassport?: string;
  phone?: string;
  guardianName?: string;
  guardianRelation?: string;
  dob?: string;
  gender?: string;
  addressLine1?: string;
  city?: string;
  province?: string;
  country?: string;
  bloodGroup?: string;
  panelId: string;
  panelName: string;
  panelMemberId?: string;
  status: string;
}

/**
 * Live search of the permanent Panel Patient Registry (§2.1 point 2,
 * `admission.md`) by name/MR#/CNIC/phone — backed by `GET /patients/panel`.
 * Lets New Admission reuse an existing panel patient instead of always
 * inline-registering a brand-new record for the same real person.
 */
export async function searchPanelPatients(query: string): Promise<PanelPatientSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const res = await apiClient.get<{ data: Record<string, any>[] }>('/patients/panel', {
    params: { search: trimmed, pageSize: 10 },
  });
  return res.data.data.map((raw) => ({
    id: raw.id,
    fullName: raw.fullName,
    mrNumber: raw.mrNumber,
    cnicOrPassport: raw.cnicOrPassport || undefined,
    phone: raw.phone || undefined,
    guardianName: raw.guardianName || undefined,
    guardianRelation: raw.guardianRelation || undefined,
    dob: raw.dob ? formatIsoDate(raw.dob) : undefined,
    gender: raw.gender || undefined,
    addressLine1: raw.addressLine1 || raw.address || undefined,
    city: raw.city || undefined,
    province: raw.province || undefined,
    country: raw.country || undefined,
    bloodGroup: raw.bloodGroup || undefined,
    panelId: raw.corporatePanelId,
    panelName: raw.corporatePanel?.organizationName || '',
    panelMemberId: raw.panelMemberId || undefined,
    status: raw.status || 'ACTIVE',
  }));
}

export function checkDuplicates(
  candidate: { cnic?: string; passportNumber?: string; primaryPhone?: string; fullName?: string; fatherGuardianName?: string; dateOfBirth?: string },
  excludePatientId?: string
): DuplicateCheckResult {
  const patients = getAllPatients();
  const otherPatients = excludePatientId ? patients.filter((p) => p.id !== excludePatientId) : patients;

  const normalizedCnic = normalizeCnic(candidate.cnic);
  const normalizedPassport = candidate.passportNumber?.trim().toUpperCase();
  const normalizedPhone = candidate.primaryPhone?.replace(/\D/g, '');
  const normalizedName = candidate.fullName?.trim().toLowerCase();
  const normalizedGuardian = candidate.fatherGuardianName?.trim().toLowerCase();
  const normalizedDob = candidate.dateOfBirth?.trim();

  if (normalizedCnic && isValidCnic(normalizedCnic)) {
    const matched = otherPatients.filter((p) => p.cnic && normalizeCnic(p.cnic) === normalizedCnic);
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

  if (normalizedPassport && normalizedPassport.length >= 6) {
    const matched = otherPatients.filter((p) => p.passportNumber && p.passportNumber.trim().toUpperCase() === normalizedPassport);
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

  if (normalizedName && normalizedDob) {
    const matched = otherPatients.filter((p) => p.fullName.trim().toLowerCase() === normalizedName && p.dateOfBirth?.trim() === normalizedDob);
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

  if (normalizedPhone && normalizedPhone.length >= 10) {
    const matched = otherPatients.filter((p) => p.primaryPhone && p.primaryPhone.replace(/\D/g, '') === normalizedPhone);
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

  if (normalizedName && normalizedName.length >= 4) {
    const matched = otherPatients.filter((p) => p.fullName.trim().toLowerCase() === normalizedName);
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

  return { severity: 'NONE', isExactCnic: false, isExactPassport: false, isPossibleDuplicate: false, matchedPatients: [], reason: '' };
}

function toBackendPanelPayload(formData: PatientFormData): Record<string, unknown> {
  return {
    fullName: formData.fullName.trim(),
    guardianName: formData.fatherGuardianName?.trim() || undefined,
    guardianRelation: formData.guardianRelation || undefined,
    gender: formData.gender || undefined,
    dob: formData.dateOfBirth || undefined,
    cnicOrPassport: normalizeCnic(formData.cnic) || formData.passportNumber?.trim() || undefined,
    phone: formData.primaryPhone ? normalizePhone(formData.primaryPhone) : undefined,
    alternatePhone: formData.alternatePhone ? normalizePhone(formData.alternatePhone) : undefined,
    email: formData.email?.trim() || undefined,
    addressLine1: formData.addressLine1?.trim() || undefined,
    addressLine2: formData.addressLine2?.trim() || undefined,
    city: formData.city?.trim() || undefined,
    province: formData.province?.trim() || undefined,
    country: formData.country?.trim() || undefined,
    bloodGroup: formData.bloodGroup && formData.bloodGroup !== 'Unknown' ? formData.bloodGroup : undefined,
    emergencyContactName: formData.emergencyContactName?.trim() || formData.fatherGuardianName?.trim() || undefined,
    emergencyContactRelation: formData.emergencyContactRelation?.trim() || formData.guardianRelation || undefined,
    emergencyContactPhone: formData.guardianCnic
      ? `CNIC: ${normalizeCnic(formData.guardianCnic)}`
      : (formData.emergencyContactPhone ? normalizePhone(formData.emergencyContactPhone) : undefined),
    status: formData.status || 'ACTIVE',
    corporatePanelId: formData.panelId,
    panelMemberId: formData.panelMemberId?.trim() || undefined,
  };
}

function toBackendSelfPayPayload(formData: PatientFormData): Record<string, unknown> {
  const address = [formData.addressLine1, formData.addressLine2, formData.city, formData.province, formData.country].filter(Boolean).join(', ');
  let guardianName = formData.fatherGuardianName?.trim() || undefined;
  if (guardianName && formData.guardianCnic) {
    guardianName = `${guardianName} [CNIC: ${normalizeCnic(formData.guardianCnic)}]`;
  }
  return {
    fullName: formData.fullName.trim(),
    guardianName,
    gender: formData.gender || undefined,
    dob: formData.dateOfBirth || undefined,
    cnicOrPassport: normalizeCnic(formData.cnic) || formData.passportNumber?.trim() || undefined,
    phone: formData.primaryPhone ? normalizePhone(formData.primaryPhone) : undefined,
    address: address || undefined,
  };
}

function validateCommonFields(formData: PatientFormData): string | null {
  if (!formData.fullName.trim()) return 'Full Name is required.';
  if (!formData.gender) return 'Gender is required.';
  if (!formData.primaryPhone.trim()) return 'Primary Phone is required.';
  if (!isValidPhone(formData.primaryPhone)) return 'Please provide a valid phone number (at least 10 digits).';
  const normalizedCnic = normalizeCnic(formData.cnic);
  if (normalizedCnic && !isValidCnic(normalizedCnic)) return 'CNIC must follow the Pakistani format: XXXXX-XXXXXXX-X (13 digits).';
  if (!formData.payerType) return 'Payer Type is required.';
  if (formData.payerType === 'Corporate / Panel') {
    if (!formData.panelId) return 'Please select a Corporate Panel.';
    if (!formData.panelMemberId.trim()) return 'Panel Member ID / Card Number is required for Corporate / Panel payer.';
  }
  return null;
}

/** `POST /patients/panel` (Corporate / Panel) or `POST /patients/encounters` (Self Pay) */
export async function createPatient(
  formData: PatientFormData,
  _currentUser: User | null
): Promise<{ success: boolean; patient?: Patient; error?: string; duplicateInfo?: DuplicateCheckResult }> {
  const validationError = validateCommonFields(formData);
  if (validationError) return { success: false, error: validationError };

  const dupCheck = checkDuplicates({
    cnic: normalizeCnic(formData.cnic),
    passportNumber: formData.passportNumber,
    primaryPhone: formData.primaryPhone,
    fullName: formData.fullName,
    fatherGuardianName: formData.fatherGuardianName,
    dateOfBirth: formData.dateOfBirth,
  });
  if (dupCheck.isExactCnic || dupCheck.isExactPassport) {
    return { success: false, error: dupCheck.reason, duplicateInfo: dupCheck };
  }

  try {
    if (formData.payerType === 'Corporate / Panel') {
      const res = await apiClient.post<{ data: Record<string, any> }>('/patients/panel', toBackendPanelPayload(formData));
      await fetchPatients();
      return { success: true, patient: getPatientById(res.data.data.id) };
    }
    const res = await apiClient.post<{ data: Record<string, any> }>('/patients/encounters', toBackendSelfPayPayload(formData));
    await fetchPatients();
    return { success: true, patient: getPatientById(res.data.data.id) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to register patient.' };
  }
}

/** `PATCH /patients/panel/:id` — self-pay encounters have no update endpoint (per-visit, non-editable by design). */
export async function updatePatient(
  id: string,
  formData: PatientFormData,
  _currentUser: User | null
): Promise<{ success: boolean; patient?: Patient; error?: string; duplicateInfo?: DuplicateCheckResult }> {
  const existing = getPatientById(id);
  if (!existing) return { success: false, error: 'Patient record not found.' };
  if (existing.payerType === 'Self Pay') {
    return { success: false, error: 'Self-pay records are per-visit and managed at Front Desk — they cannot be edited from this registry.' };
  }

  const validationError = validateCommonFields(formData);
  if (validationError) return { success: false, error: validationError };

  const dupCheck = checkDuplicates(
    {
      cnic: normalizeCnic(formData.cnic),
      passportNumber: formData.passportNumber,
      primaryPhone: formData.primaryPhone,
      fullName: formData.fullName,
      fatherGuardianName: formData.fatherGuardianName,
      dateOfBirth: formData.dateOfBirth,
    },
    id
  );
  if (dupCheck.isExactCnic || dupCheck.isExactPassport) {
    return { success: false, error: dupCheck.reason, duplicateInfo: dupCheck };
  }

  try {
    await apiClient.patch(`/patients/panel/${id}`, toBackendPanelPayload(formData));
    await fetchPatients();
    return { success: true, patient: getPatientById(id) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update patient.' };
  }
}

/** `PATCH /patients/panel/:id` (status field) */
export async function updatePatientStatus(
  id: string,
  newStatus: PatientStatus,
  _currentUser: User | null
): Promise<{ success: boolean; patient?: Patient; error?: string }> {
  const existing = getPatientById(id);
  if (!existing) return { success: false, error: 'Patient not found.' };
  if (existing.payerType === 'Self Pay') {
    return { success: false, error: 'Self-pay records have no status to change — they are per-visit and managed at Front Desk.' };
  }

  try {
    await apiClient.patch(`/patients/panel/${id}`, { status: newStatus });
    await fetchPatients();
    return { success: true, patient: getPatientById(id) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update status.' };
  }
}

export function filterPatients(patients: Patient[], filters: PatientFilterState): Patient[] {
  return patients.filter((patient) => {
    if (filters.searchTerm.trim()) {
      const q = filters.searchTerm.trim().toLowerCase();
      const matchMr = patient.mrNumber.toLowerCase().includes(q);
      const matchName = patient.fullName.toLowerCase().includes(q);
      const matchCnic = patient.cnic ? patient.cnic.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || patient.cnic.toLowerCase().includes(q) : false;
      const matchPhone = patient.primaryPhone ? patient.primaryPhone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || patient.primaryPhone.toLowerCase().includes(q) : false;
      const matchPanelMember = patient.panelMemberId ? patient.panelMemberId.toLowerCase().includes(q) : false;
      if (!matchMr && !matchName && !matchCnic && !matchPhone && !matchPanelMember) return false;
    }
    if (filters.gender !== 'ALL' && patient.gender !== filters.gender) return false;
    if (filters.payerType !== 'ALL' && patient.payerType !== filters.payerType) return false;
    if (filters.panelId !== 'ALL') {
      if (patient.payerType !== 'Corporate / Panel' || patient.panelId !== filters.panelId) return false;
    }
    if (filters.status !== 'ALL' && patient.status !== filters.status) return false;
    return true;
  });
}

export function getPatientRegistryKpis(patients: Patient[]) {
  const total = patients.length;
  const active = patients.filter((p) => p.status === 'ACTIVE').length;
  const selfPay = patients.filter((p) => p.payerType === 'Self Pay').length;
  const panel = patients.filter((p) => p.payerType === 'Corporate / Panel').length;

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const newThisMonth = patients.filter((p) => p.registrationDate && p.registrationDate.startsWith(currentMonthPrefix)).length;

  return { total, active, selfPay, panel, newThisMonth };
}

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
  const city = String(row['city'] || '').trim();
  const province = String(row['province'] || '').trim();
  const country = String(row['country'] || 'Pakistan').trim();
  const rawBlood = String(row['blood_group'] || 'Unknown').trim();
  const rawPayer = String(row['payer_type'] || 'Self Pay').trim();
  const rawPanelCode = String(row['panel_code'] || '').trim();
  const rawPanelMemberId = String(row['panel_member_id'] || '').trim();
  const emergencyName = String(row['emergency_contact_name'] || '').trim();
  const emergencyRelation = String(row['emergency_contact_relation'] || '').trim();
  const emergencyPhone = String(row['emergency_contact_phone'] || '').trim();
  const rawStatus = String(row['status'] || 'ACTIVE').trim().toUpperCase();

  if (!fullName) errors.push('Missing patient full_name');

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

  if (!rawPhone) {
    errors.push('Missing primary_phone');
  } else if (!isValidPhone(rawPhone)) {
    errors.push(`Invalid primary_phone "${rawPhone}"`);
  }

  const normalizedCnic = normalizeCnic(rawCnic);
  if (normalizedCnic && !isValidCnic(normalizedCnic)) {
    errors.push(`Invalid CNIC "${rawCnic}". Format must be 5-7-1 digits (e.g. 35202-1234567-1)`);
  }

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

  let bloodGroup: BloodGroup = 'Unknown';
  if (rawBlood) {
    const matchBlood = BLOOD_GROUPS.find((b) => b.toUpperCase() === rawBlood.toUpperCase());
    if (matchBlood) {
      bloodGroup = matchBlood;
    } else {
      errors.push(`Invalid blood_group "${rawBlood}". Allowed: Unknown, A+, A-, B+, B-, AB+, AB-, O+, O-`);
    }
  }

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
    if (!rawPanelMemberId) errors.push('panel_member_id is required when payer_type is Corporate / Panel');
  }

  let status: PatientStatus = 'ACTIVE';
  if (rawStatus === 'ACTIVE' || rawStatus === 'INACTIVE' || rawStatus === 'DECEASED') {
    status = rawStatus as PatientStatus;
  } else {
    errors.push(`Invalid status "${rawStatus}". Allowed: ACTIVE, INACTIVE, DECEASED`);
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push(`Invalid email format "${email}"`);
  }

  let existingMr: string | undefined;
  let isExactDup = false;
  let isPossibleDup = false;

  if (normalizedCnic && isValidCnic(normalizedCnic)) {
    const cnicMatch = allKnown.find((p) => p.cnic && normalizeCnic(p.cnic) === normalizedCnic);
    if (cnicMatch) {
      isExactDup = true;
      existingMr = cnicMatch.mrNumber;
      errors.push(`Exact duplicate CNIC already registered under ${existingMr} (${cnicMatch.fullName})`);
    }
  }

  if (!isExactDup && rawPassport) {
    const passMatch = allKnown.find((p) => p.passportNumber && p.passportNumber.toUpperCase() === rawPassport.toUpperCase());
    if (passMatch) {
      isExactDup = true;
      existingMr = passMatch.mrNumber;
      errors.push(`Exact duplicate Passport already registered under ${existingMr} (${passMatch.fullName})`);
    }
  }

  if (!isExactDup) {
    const normPhone = rawPhone.replace(/\D/g, '');
    const phoneMatch = allKnown.find((p) => p.primaryPhone && p.primaryPhone.replace(/\D/g, '') === normPhone);
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
    const nowIso = new Date().toISOString();
    patientObj = {
      id: `PAT-IMP-${rowNumber}-${Date.now().toString().slice(-4)}`,
      mrNumber: '', // assigned by the backend on commit
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
      registrationDate: nowIso.slice(0, 10),
      lastVisitDate: undefined,
      createdBy: '',
      createdAt: nowIso,
      updatedBy: '',
      updatedAt: nowIso,
    };
  }

  return { rowNumber, data: row, patient: patientObj, status: rowStatus, existingMrNumber: existingMr, errors };
}

/** Persists each validated row via real `POST /patients/panel` or `/patients/encounters` calls, one row at a time. */
export async function commitBatchPatients(validResults: ImportPatientRowResult[], currentUser: User | null): Promise<ImportSummary> {
  let patientsCreated = 0;
  let duplicatesSkipped = 0;
  let rowsFailed = 0;
  const errorRows: ImportPatientRowResult[] = [];

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

    const formData: PatientFormData = {
      fullName: r.patient.fullName,
      fatherGuardianName: r.patient.fatherGuardianName,
      guardianRelation: r.patient.guardianRelation,
      dateOfBirth: r.patient.dateOfBirth || '',
      age: r.patient.age,
      ageIsEstimated: r.patient.ageIsEstimated,
      gender: r.patient.gender,
      cnic: r.patient.cnic || '',
      passportNumber: r.patient.passportNumber || '',
      primaryPhone: r.patient.primaryPhone,
      alternatePhone: r.patient.alternatePhone || '',
      email: r.patient.email || '',
      addressLine1: r.patient.addressLine1 || '',
      addressLine2: r.patient.addressLine2 || '',
      city: r.patient.city,
      province: r.patient.province,
      country: r.patient.country,
      bloodGroup: r.patient.bloodGroup,
      payerType: r.patient.payerType,
      panelId: r.patient.panelId || '',
      panelName: r.patient.panelName || '',
      panelMemberId: r.patient.panelMemberId || '',
      emergencyContactName: r.patient.emergencyContactName || '',
      emergencyContactRelation: r.patient.emergencyContactRelation || '',
      emergencyContactPhone: r.patient.emergencyContactPhone || '',
      status: r.patient.status,
    };

    const result = await createPatient(formData, currentUser);
    if (result.success) {
      patientsCreated++;
    } else {
      rowsFailed++;
      errorRows.push({ ...r, errors: [result.error || 'Failed to import'], status: 'INVALID' });
    }
  }

  return { rowsProcessed: validResults.length, patientsCreated, duplicatesSkipped, rowsFailed, errorRows };
}
