/**
 * Pakistan-specific format helpers used across Patient Registry (§4.6) and
 * Staff Master (§4.1) — CNIC and mobile phone normalization/validation.
 */

/** Canonical CNIC shape: 5 digits - 7 digits - 1 digit, e.g. 42101-1234567-1. */
export const CNIC_PATTERN = /^\d{5}-\d{7}-\d{1}$/;

/** Canonical Pakistani mobile shape: 03XX-XXXXXXX, e.g. 0300-1234567. */
export const PHONE_PATTERN = /^03\d{2}-\d{7}$/;

/**
 * Normalizes a loosely-formatted CNIC (with/without dashes, spaces) into
 * `XXXXX-XXXXXXX-X`. Returns `null` if the input does not contain exactly
 * 13 digits.
 */
export function normalizeCnic(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 13) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/**
 * Normalizes a loosely-formatted Pakistani mobile number (with/without
 * country code, dashes, spaces) into `03XX-XXXXXXX`. Accepts:
 *   - `03001234567`, `0300-1234567`, `0300 1234567`
 *   - `923001234567`, `+923001234567` (country code form)
 *   - `3001234567` (leading 0 omitted)
 * Returns `null` if the input cannot be resolved to an 11-digit `03...`
 * mobile number.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');

  if (digits.startsWith('92') && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.length === 10 && digits.startsWith('3')) {
    digits = `0${digits}`;
  }

  if (digits.length !== 11 || !digits.startsWith('03')) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export function isValidCnic(input: string): boolean {
  return CNIC_PATTERN.test(input);
}

export function isValidPhone(input: string): boolean {
  return PHONE_PATTERN.test(input);
}
