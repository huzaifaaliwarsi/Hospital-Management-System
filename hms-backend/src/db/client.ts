import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';
import { logger } from '@/shared/logger';

function createPrismaClient() {
  return new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
    // Global field omission — `clinicalAuthPasswordHash` (v7.2 §2.4) must
    // never leave the service layer, but `Staff` is `include`d wholesale
    // (`doctor: true`, `performedBy: true`) all over admission/frontdesk/
    // commission. A per-callsite `select` would need to be hunted down and
    // kept correct forever; omitting it here at the client level makes the
    // leak structurally impossible instead — nothing in this codebase reads
    // this field back for comparison (unlike `PortalUser.passwordHash`,
    // which auth.service.ts genuinely needs on the raw row, so that one is
    // deliberately NOT included here — it stays hand-scrubbed per callsite).
    omit: {
      staff: { clinicalAuthPasswordHash: true },
    },
  });
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>;

/**
 * Prisma client singleton. In dev, reuse the client across `tsx watch`
 * reloads via `globalThis` to avoid exhausting the connection pool. The
 * global var's type is tied to `createPrismaClient`'s actual return type
 * (rather than the bare `PrismaClient`) so it stays in sync with the
 * `omit` config above instead of silently widening it away.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: AppPrismaClient | undefined;
}

export const prisma: AppPrismaClient = globalThis.__prisma ?? createPrismaClient();

if (env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

/**
 * Historical payer ownership (panel.md §14 backlog item 1): every
 * `HospitalInvoice` freezes the panel patient's company at posting time
 * into `corporatePanelId`, instead of every statement/ledger/remittance
 * query re-deriving "this invoice's company" from the patient's CURRENT
 * `corporatePanelId` (which breaks the moment a patient transfers company —
 * old receivables would silently move, or vanish from the original
 * company's books). Centralized here — like the `omit` config above — so
 * every existing and future `HospitalInvoice.create()` call site gets the
 * snapshot automatically; it is not something 7+ scattered call sites can
 * be trusted to remember individually. Only fires when the caller didn't
 * already set `corporatePanelId` explicitly (never overrides an explicit
 * value), and only reads the referenced patient's company — it never writes
 * outside the invoice being created.
 */
prisma.$use(async (params, next) => {
  if (params.model === 'HospitalInvoice' && params.action === 'create') {
    const data = params.args?.data as { panelPatientId?: string | null; corporatePanelId?: string | null } | undefined;
    if (data && data.panelPatientId && data.corporatePanelId === undefined) {
      const patient = await prisma.panelPatient.findUnique({
        where: { id: data.panelPatientId },
        select: { corporatePanelId: true },
      });
      if (patient) data.corporatePanelId = patient.corporatePanelId;
    }
  }
  return next(params);
});

if (env.NODE_ENV === 'development') {
  prisma.$on('query', (e: { query: string; duration: number }) => {
    logger.debug('prisma:query', { query: e.query, durationMs: e.duration });
  });
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database connectivity check failed', { error: (error as Error).message });
    return false;
  }
}
