import type { Prisma } from '@prisma/client';

/** Every Main Fund debit uses this same transaction-scoped lock before reading balance. */
export async function lockMainFund(tx: Pick<Prisma.TransactionClient, '$executeRaw'>) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hms-main-cash-fund'))`;
}
