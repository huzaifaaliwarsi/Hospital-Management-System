import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/shared/logger';
import { prisma } from '@/db/client';

import { hmsRequestsService } from '@/modules/hms-requests/hms-requests.service';
import { startHmsSyncScheduler } from '@/shared/hmsSyncScheduler';
import { closeSseClients } from '@/shared/hmsEvents';

const app = createApp();
let stopSync: (() => Promise<void>) | undefined;
let shuttingDown = false;

const server = app.listen(env.PORT, () => {
  logger.info(`pharmacy-backend listening on port ${env.PORT}`, { env: env.NODE_ENV });

  if (!shuttingDown) {
    stopSync = startHmsSyncScheduler(
      () => hmsRequestsService.syncFromHmsOutbox(),
      env.HMS_SYNC_INTERVAL_MS,
      () => logger.error('Unexpected HMS sync scheduler failure; next tick will retry'),
    );
  }
});

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully`);
  const syncStopped = stopSync?.();
  closeSseClients();
  server.close(async () => {
    try {
      await syncStopped;
      await prisma.$disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch {
      logger.error('Graceful shutdown failed');
      process.exit(1);
    }
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, env.HMS_SYNC_TIMEOUT_MS + 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
