import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/shared/logger';
import { prisma } from '@/db/client';

import { hmsRequestsService } from '@/modules/hms-requests/hms-requests.service';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`pharmacy-backend listening on port ${env.PORT}`, { env: env.NODE_ENV });

  // Initial pull from HMS queue if HMS created requests while Pharmacy was offline
  setTimeout(() => {
    hmsRequestsService.syncFromHmsOutbox().catch((err) => {
      logger.warn('Initial HMS sync attempt:', err?.message || err);
    });
  }, 2000);
});

// Periodic background sync from HMS outbox every 20 seconds
const syncInterval = setInterval(() => {
  hmsRequestsService.syncFromHmsOutbox().catch(() => null);
}, 20_000);
syncInterval.unref();

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
