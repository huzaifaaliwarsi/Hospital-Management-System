import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/shared/logger';
import { prisma } from '@/db/client';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`hms-backend listening on port ${env.PORT}`, { env: env.NODE_ENV });
});

/** Graceful shutdown (§7.16): stop new connections, drain in-flight ones, close the DB pool. */
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
