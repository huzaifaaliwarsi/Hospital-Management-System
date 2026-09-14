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
