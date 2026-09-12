import { HospitalProfile, DEFAULT_HOSPITAL_PROFILE } from '../types/hospital';

export const HOSPITAL_PROFILE_STORAGE_KEY = 'css_hms_hospital_profile_state_v2';

/**
 * Returns the centralized hospital profile from localStorage or default values.
 * Strictly guarantees no fabricated registration, tax, or contact numbers.
 */
export function getHospitalProfile(): HospitalProfile {
  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(HOSPITAL_PROFILE_STORAGE_KEY) : null;
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_HOSPITAL_PROFILE,
        ...parsed,
        workingHours: parsed.workingHours || DEFAULT_HOSPITAL_PROFILE.workingHours,
      };
    }
  } catch (e) {
    console.warn('Failed to parse hospital profile from localStorage', e);
  }
  return DEFAULT_HOSPITAL_PROFILE;
}

/**
 * Helper to format hospital physical address from profile.
 * Returns 'Not configured' if empty.
 */
export function formatHospitalAddress(profile: HospitalProfile): string {
  const parts = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.province,
    profile.postalCode,
    profile.country,
  ].filter((p) => p && typeof p === 'string' && p.trim().length > 0);

  return parts.length > 0 ? parts.join(', ') : 'Not configured';
}

/**
 * Helper to display field value or 'Not configured'
 */
export function getProfileFieldValue(val?: string | null): string {
  if (val && typeof val === 'string' && val.trim().length > 0) {
    return val.trim();
  }
  return 'Not configured';
}
