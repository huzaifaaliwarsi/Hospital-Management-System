import crypto from 'crypto';
import { prisma } from '@/db/client';

type PrismaClientOrTx = any;

/**
 * Returns current 2-digit year (e.g. '26' for 2026).
 */
export function currentYear2(): string {
  return String(new Date().getFullYear()).slice(-2);
}

/**
 * Generates a compact random uppercase alphanumeric string
 * (excluding visually ambiguous characters 0, O, 1, I).
 */
export function compactRandom(length = 4): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let res = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    res += chars[bytes[i] % chars.length];
  }
  return res;
}

/**
 * Generic helper for collision-safe sequential ID generation:
 * Format: `${prefix}${String(seq).padStart(padLength, '0')}` -> e.g. `INV-26-0001`
 * Falls back gracefully to `${prefix}${compactRandom()}` if DB is unavailable or mocked.
 */
async function generateSequentialId(
  tx: PrismaClientOrTx,
  modelName: string,
  field: string,
  prefix: string,
  padLength = 4,
): Promise<string> {
  const db = tx || prisma;
  const model = db?.[modelName];

  if (typeof model?.count === 'function') {
    try {
      const count = await model.count({
        where: { [field]: { startsWith: prefix } },
      });

      for (let offset = 1; offset <= 15; offset++) {
        const candidate = `${prefix}${String(count + offset).padStart(padLength, '0')}`;
        if (typeof model.findUnique === 'function') {
          const exists = await model.findUnique({
            where: { [field]: candidate },
            select: { id: true },
          });
          if (!exists) return candidate;
        } else if (typeof model.findFirst === 'function') {
          const exists = await model.findFirst({
            where: { [field]: candidate },
            select: { id: true },
          });
          if (!exists) return candidate;
        } else {
          return candidate;
        }
      }
    } catch {
      // Fall through to compact random fallback
    }
  }

  return `${prefix}${compactRandom(padLength)}`;
}

/**
 * Short Invoice Number: e.g. `INV-26-0001`
 */
export async function generateInvoiceNumber(tx?: PrismaClientOrTx): Promise<string> {
  const prefix = `INV-${currentYear2()}-`;
  return generateSequentialId(tx, 'hospitalInvoice', 'invoiceNumber', prefix, 4);
}

/**
 * Short Receipt Number: e.g. `REC-26-0001`
 */
export async function generateReceiptNumber(tx?: PrismaClientOrTx): Promise<string> {
  const prefix = `REC-${currentYear2()}-`;
  return generateSequentialId(tx, 'paymentReceipt', 'receiptNumber', prefix, 4);
}

/**
 * Short MR Number: e.g. `MR-26-0001`
 */
export async function generateMrNumber(tx?: PrismaClientOrTx): Promise<string> {
  const prefix = `MR-${currentYear2()}-`;
  return generateSequentialId(tx, 'panelPatient', 'mrNumber', prefix, 4);
}

/**
 * Short Admission Number: e.g. `ADM-26-0001`
 */
export async function generateAdmissionNumber(tx?: PrismaClientOrTx): Promise<string> {
  const prefix = `ADM-${currentYear2()}-`;
  return generateSequentialId(tx, 'admissionRecord', 'admissionNumber', prefix, 4);
}

/**
 * Short Panel Remittance Number: e.g. `PRM-26-0001`
 */
export async function generateRemittanceNumber(tx?: PrismaClientOrTx): Promise<string> {
  const prefix = `PRM-${currentYear2()}-`;
  return generateSequentialId(tx, 'panelRemittance', 'remittanceNumber', prefix, 4);
}

/**
 * Short Medicine Request Number: e.g. `REQ-26-0001`
 */
export async function generateMedicineRequestNumber(tx?: PrismaClientOrTx): Promise<string> {
  const prefix = `REQ-${currentYear2()}-`;
  return generateSequentialId(tx, 'medicineRequest', 'requestNumber', prefix, 4);
}
