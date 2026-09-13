import apiClient from './apiClient';
import { HospitalProfile, DEFAULT_HOSPITAL_PROFILE, INITIAL_WORKING_HOURS } from '../types/hospital';
import { formatDisplayDate } from '../utils/dateConstants';

/**
 * Live Hospital Profile service — every field is fetched from and
 * persisted to `GET/PUT /api/v1/setup/hospital-profile` (backed by the
 * `hospital_profile` table). No localStorage, no fabricated values:
 * `DEFAULT_HOSPITAL_PROFILE` here is used only to fill genuinely
 * unconfigured fields the backend has not returned yet.
 */

function formatServerTimestamp(iso?: string | Date | null): string {
  if (!iso) return DEFAULT_HOSPITAL_PROFILE.updatedAt;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DEFAULT_HOSPITAL_PROFILE.updatedAt;
  const dateStr = formatDisplayDate(d);
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

/** Maps the backend's flat + JSON-blob response onto the full frontend `HospitalProfile` shape. */
function toHospitalProfile(raw: Record<string, unknown>): HospitalProfile {
  return {
    ...DEFAULT_HOSPITAL_PROFILE,
    ...raw,
    id: String(raw.id ?? DEFAULT_HOSPITAL_PROFILE.id),
    logo: (raw.logo as string | null) ?? null,
    workingHours:
      Array.isArray(raw.workingHours) && raw.workingHours.length > 0
        ? (raw.workingHours as HospitalProfile['workingHours'])
        : INITIAL_WORKING_HOURS,
    createdAt: formatServerTimestamp(raw.createdAt as string | undefined),
    updatedAt: formatServerTimestamp(raw.updatedAt as string | undefined),
    createdBy: (raw.createdBy as string) || 'Not configured',
    updatedBy: (raw.updatedBy as string) || 'Not configured',
  } as HospitalProfile;
}

// In-memory cache (never localStorage) for the many print/export helpers
// that need a synchronous "current hospital letterhead" read. Always
// populated from a real backend response — `primeHospitalProfileCache()`
// should be called once at app startup (see `AuthContext`); until that
// resolves, synchronous readers legitimately see the "Not configured"
// defaults as a loading state, not fabricated data.
let cachedProfile: HospitalProfile = DEFAULT_HOSPITAL_PROFILE;

export async function fetchHospitalProfile(): Promise<HospitalProfile> {
  const res = await apiClient.get<{ data: Record<string, unknown> }>('/setup/hospital-profile');
  cachedProfile = toHospitalProfile(res.data.data);
  return cachedProfile;
}

export async function saveHospitalProfile(profile: HospitalProfile): Promise<HospitalProfile> {
  // Strip client-only/derived fields (id, audit trail) — the backend owns those.
  const { id: _id, createdAt: _createdAt, createdBy: _createdBy, updatedAt: _updatedAt, updatedBy: _updatedBy, ...payload } = profile;
  const res = await apiClient.put<{ data: Record<string, unknown> }>('/setup/hospital-profile', payload);
  cachedProfile = toHospitalProfile(res.data.data);
  return cachedProfile;
}

/** Async warm-up — call once at app startup (post-login) so sync readers below have real data. */
export async function primeHospitalProfileCache(): Promise<void> {
  try {
    await fetchHospitalProfile();
  } catch {
    // Leave defaults in place; the Hospital Overview page will surface the real error on its own fetch.
  }
}

/**
 * Synchronous read of the last-fetched hospital profile, for print/export
 * utilities that cannot await. Always sourced from the real backend via
 * the cache above — never a mock/localStorage value.
 */
export function getHospitalProfile(): HospitalProfile {
  return cachedProfile;
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
