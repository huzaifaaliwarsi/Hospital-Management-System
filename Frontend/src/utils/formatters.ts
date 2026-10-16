import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number into PKR (Pakistani Rupee) currency format
 * e.g., 1420500 -> "PKR 1,420,500"
 */
export function formatPKR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return 'PKR 0';
  }
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `PKR ${new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(numeric)}`;
}

/**
 * Formats a standard integer or decimal with commas
 */
/** Whole-rupee amount without the "PKR" prefix — for tables whose header already says PKR. */
export function formatAmount(amount: number | string | null | undefined): string {
  return formatPKR(amount).replace(/^PKR /, '');
}

export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined || isNaN(Number(num))) {
    return '0';
  }
  const numeric = typeof num === 'string' ? parseFloat(num) : num;
  return new Intl.NumberFormat('en-PK').format(numeric);
}

/**
 * Formats a phone number for display (+92 300 1234567)
 */
export function formatPhone(phone: string): string {
  const cleaned = ('' + phone).replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `+92 ${cleaned.slice(1, 4)} ${cleaned.slice(4)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('92')) {
    return `+92 ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}

/**
 * Automatically formats a CNIC string into the standard Pakistani format:
 * XXXXX-XXXXXXX-X (13 digits with dashes auto-inserted as user types)
 */
export function formatCnicInput(raw?: string | null): string {
  if (!raw) return '';
  const cleanDigits = raw.replace(/\D/g, '').slice(0, 13);
  if (cleanDigits.length > 12) {
    return `${cleanDigits.slice(0, 5)}-${cleanDigits.slice(5, 12)}-${cleanDigits.slice(12)}`;
  }
  if (cleanDigits.length > 5) {
    return `${cleanDigits.slice(0, 5)}-${cleanDigits.slice(5)}`;
  }
  return cleanDigits;
}

/**
 * Automatically capitalizes the first letter of text and after sentence endings (. ! ?),
 * while keeping the rest in natural case as the user types (preventing forced ALL CAPS).
 */
export function formatSentenceCase(val?: string | null): string {
  if (!val) return '';
  return val.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase());
}

/**
 * Normalizes full sentence on blur: if the entire string was entered in ALL CAPS,
 * converts to sentence case (First letter capital, rest lowercase).
 */
export function normalizeSentenceCase(val?: string | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.length > 1 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return formatSentenceCase(trimmed.toLowerCase());
  }
  return formatSentenceCase(val);
}

/**
 * Formats name inputs (Patient Full Name, Guardian Name):
 * Capitalizes the first letter of each word (Title Case) as user types.
 */
export function formatTitleCase(val?: string | null): string {
  if (!val) return '';
  return val.replace(/(^|\s|-)([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase());
}

/**
 * Normalizes name on blur: if entered in ALL CAPS, converts to Title Case.
 */
export function normalizeTitleCase(val?: string | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.length > 1 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .replace(/(^|\s|-)([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase());
  }
  return formatTitleCase(val);
}

/**
 * Formats a Date object or ISO date string into standard Pakistani / UK DD/MM/YYYY format
 * e.g. "2026-09-23" -> "23/09/2026"
 */
export function formatDateDDMMYYYY(date?: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats a Date object or ISO timestamp into DD/MM/YYYY, hh:mm A
 * e.g. "2026-09-23T10:15:00Z" -> "23/09/2026, 10:15 AM"
 */
export function formatDateTimeDDMMYYYY(date?: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  const dateStr = formatDateDDMMYYYY(d);
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

/**
 * Formats inventory references, voucher numbers, and IDs into short numbers
 * strictly max 5 to 6 characters (e.g. GRN-01, ITM-01, PAY-01, BN-01, ISS-01, RET-01, EXP-01).
 * Also compresses any legacy long date strings like "GRN-20260928-003" into "GRN-03".
 */
export function formatShortRef(ref?: string | null, fallbackId?: string, prefix = 'REF'): string {
  if (ref && ref.trim()) {
    const clean = ref.trim();
    // Match date-stamped codes like GRN-20260928-003, PAY-20260928-0012, BN-20260928-01, EXP-20260928-0004
    const match = clean.match(/^([A-Za-z]+)-?(?:\d{8}|\d{4,8})-?0*(\d{1,4})$/);
    if (match) {
      const pfx = match[1].slice(0, 3).toUpperCase();
      const num = parseInt(match[2], 10);
      const shortNum = String(num % 100 || 1).padStart(2, '0');
      return `${pfx}-${shortNum}`;
    }
    // Match ITM-0001 -> ITM-01
    const itmMatch = clean.match(/^([A-Za-z]+)-0*(\d{1,4})$/);
    if (itmMatch) {
      const pfx = itmMatch[1].slice(0, 3).toUpperCase();
      const num = parseInt(itmMatch[2], 10);
      const shortNum = String(num % 100 || 1).padStart(2, '0');
      return `${pfx}-${shortNum}`;
    }
    // If it's already short (<= 6 chars)
    if (clean.length <= 6) {
      return clean;
    }
    // If it has multiple hyphens
    const parts = clean.split('-');
    if (parts.length >= 2) {
      const pfx = parts[0].slice(0, 3).toUpperCase();
      const last = parts[parts.length - 1];
      const digits = last.replace(/\D/g, '');
      if (digits) {
        return `${pfx}-${digits.slice(-2).padStart(2, '0')}`;
      }
      return `${pfx}-${last.slice(-2).toUpperCase()}`;
    }
    return clean.slice(0, 6).toUpperCase();
  }
  if (fallbackId) {
    const cleanId = fallbackId.replace(/[^a-zA-Z0-9]/g, '');
    const pfx = prefix.slice(0, 3).toUpperCase();
    return `${pfx}-${cleanId.slice(0, 2).toUpperCase()}`;
  }
  return '—';
}


