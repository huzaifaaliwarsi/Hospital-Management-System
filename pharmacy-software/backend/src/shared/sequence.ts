import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/client';

/**
 * System-generated-identifiers — every human-readable business code in the
 * app (Vendor, Medicine, Purchase/PO, Invoice, HMS Request, Stock Adjustment,
 * Expense, Settlement, Return, Petty Cash, Vendor Payment) comes from one of
 * these keys. Centralized here so prefixes/padding stay consistent and a new
 * document type can't accidentally invent its own ad-hoc numbering scheme.
 */
export const SEQUENCE = {
  VENDOR: { key: 'vendor', prefix: 'VND' },
  MEDICINE: { key: 'medicine', prefix: 'MED' },
  PURCHASE: { key: 'purchase', prefix: 'PO' },
  /// Purchase Order (procurement reminder, distinct from the PO-prefixed Purchase/Stock-In record above) — deliberately a different prefix so the two are never confused.
  PURCHASE_ORDER: { key: 'purchase_order', prefix: 'PREQ' },
  INVOICE_RETAIL: { key: 'invoice_retail', prefix: 'INV' },
  INVOICE_HMS: { key: 'invoice_hms', prefix: 'PHI' },
  MEDICINE_REQUEST: { key: 'medicine_request', prefix: 'REQ' },
  STOCK_ADJUSTMENT: { key: 'stock_adjustment', prefix: 'ADJ' },
  EXPENSE: { key: 'expense', prefix: 'EXP' },
  SETTLEMENT: { key: 'settlement', prefix: 'SET' },
  RETURN: { key: 'return', prefix: 'RET' },
  PETTY_CASH: { key: 'petty_cash', prefix: 'PCA' },
  VENDOR_PAYMENT: { key: 'vendor_payment', prefix: 'VPAY' },
} as const;

const PAD = 4;

function format(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(PAD, '0')}`;
}

/**
 * Atomically reserves and returns the next code for `seq`. MUST be called
 * inside the same `prisma.$transaction` that creates the record it numbers —
 * the `INSERT … ON CONFLICT DO UPDATE … RETURNING` below takes a row lock on
 * the counter, so concurrent callers serialize on it (no duplicate numbers
 * under concurrent saves) and a transaction that later rolls back releases
 * its reservation (no permanent gaps from failed attempts). Because the
 * counter only ever increments, a number is never reused — including after
 * the record it was assigned to is later deleted or cancelled.
 */
export async function nextCode(tx: Prisma.TransactionClient, seq: { key: string; prefix: string }): Promise<string> {
  const rows = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO document_sequences (key, last_value, updated_at)
    VALUES (${seq.key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET last_value = document_sequences.last_value + 1, updated_at = now()
    RETURNING last_value
  `;
  let val = rows[0]!.last_value;
  if (seq.key === SEQUENCE.MEDICINE.key) {
    const medicines = await tx.medicineMaster.findMany({
      where: { code: { startsWith: `${seq.prefix}-` } },
      select: { code: true },
    });
    for (const m of medicines) {
      const match = m.code.match(new RegExp(`^${seq.prefix}-(\\d+)$`));
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (n >= val) val = n + 1;
      }
    }
    await tx.$executeRaw`
      UPDATE document_sequences SET last_value = ${val}, updated_at = now() WHERE key = ${seq.key}
    `;
  }
  if (seq.key === SEQUENCE.INVOICE_HMS.key || seq.key === SEQUENCE.INVOICE_RETAIL.key) {
    const invoices = await tx.pharmacyInvoice.findMany({
      where: { invoiceNumber: { startsWith: `${seq.prefix}-` } },
      select: { invoiceNumber: true },
    });
    for (const inv of invoices) {
      const match = inv.invoiceNumber.match(new RegExp(`^${seq.prefix}-(\\d+)$`));
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (n >= val) val = n + 1;
      }
    }
    await tx.$executeRaw`
      UPDATE document_sequences SET last_value = ${val}, updated_at = now() WHERE key = ${seq.key}
    `;
  }
  return format(seq.prefix, val);
}

/**
 * Best-effort PREVIEW of the next code, for display only (e.g. "next Vendor
 * Code will be VND-0005" when an Add form opens) — does NOT reserve the
 * number. Two users opening the same form at the same time may see the same
 * preview; only one of them will actually receive it when they save (the
 * other gets the next number up via `nextCode` above, which is the only
 * place a number is ever authoritatively assigned).
 */
export async function peekNextCode(seq: { key: string; prefix: string }): Promise<string> {
  const row = await prisma.documentSequence.findUnique({ where: { key: seq.key } });
  let nextVal = (row?.lastValue ?? 0) + 1;
  if (seq.key === SEQUENCE.MEDICINE.key) {
    const medicines = await prisma.medicineMaster.findMany({
      where: { code: { startsWith: `${seq.prefix}-` } },
      select: { code: true },
    });
    for (const m of medicines) {
      const match = m.code.match(new RegExp(`^${seq.prefix}-(\\d+)$`));
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (n >= nextVal) nextVal = n + 1;
      }
    }
  }
  return format(seq.prefix, nextVal);
}
