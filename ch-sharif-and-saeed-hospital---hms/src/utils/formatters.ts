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

