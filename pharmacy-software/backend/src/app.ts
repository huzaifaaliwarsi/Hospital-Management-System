import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import '@/config/env';
import { requestContext } from '@/middleware/requestId';
import { globalRateLimiter } from '@/middleware/rateLimiter';
import { authenticate, blockIfMustResetPassword } from '@/middleware/authenticate';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';

import healthRoutes from '@/modules/health/health.routes';
import authRoutes from '@/modules/identity/auth.routes';
import usersRoutes from '@/modules/identity/users.routes';
import pharmacyRoutes from '@/modules/pharmacy/pharmacy.routes';
import hmsRequestsRoutes from '@/modules/hms-requests/hms-requests.routes';
import vendorsRoutes from '@/modules/vendors/vendors.routes';
import cashRoutes from '@/modules/cash/cash.routes';
import expensesRoutes from '@/modules/expenses/expenses.routes';
import dashboardRoutes from '@/modules/dashboard/dashboard.routes';
import reportsRoutes from '@/modules/reports/reports.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (_origin, callback) => callback(null, true),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    }),
  );
  app.use(requestContext);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(globalRateLimiter);

  app.get(['/', '/api'], (_req, res) => {
    res.json({ status: 'ok', message: 'Standalone Pharmacy Software API is running', version: 'v1', health: '/api/v1/health' });
  });
  app.get('/favicon.ico', (_req, res) => res.status(204).end());

  // Public routes — must be mounted before the blanket `authenticate` below.
  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);

  // Everything from here on requires a valid access token, and — except the
  // auth router already mounted above (which carries its own /me so the
  // frontend can read mustResetPassword) — blocks until a forced password
  // reset is complete (pharmacy.md §13's "must change password on first login").
  app.use('/api/v1', authenticate, blockIfMustResetPassword);

  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/pharmacy', pharmacyRoutes);
  app.use('/api/v1/hms-requests', hmsRequestsRoutes);
  app.use('/api/v1/vendors', vendorsRoutes);
  app.use('/api/v1/cash', cashRoutes);
  app.use('/api/v1/expenses', expensesRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/reports', reportsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
