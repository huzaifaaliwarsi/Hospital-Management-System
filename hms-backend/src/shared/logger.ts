import { env } from '@/config/env';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVEL_WEIGHT[env.LOG_LEVEL];

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  if (LEVEL_WEIGHT[level] < threshold) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

/**
 * Minimal structured JSON logger. Swap for pino/winston later without
 * touching call sites — every call site imports this module, not `console`.
 */
export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
};
