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


