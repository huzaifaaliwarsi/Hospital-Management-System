import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';
import { logger } from '@/shared/logger';

/**
 * Prisma client singleton. In dev, reuse the client across `tsx watch`
 * reloads via `globalThis` to avoid exhausting the connection pool.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
  });

if (env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

if (env.NODE_ENV === 'development') {
  // @ts-expect-error — event log level typing requires the 'query' event subscription
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
