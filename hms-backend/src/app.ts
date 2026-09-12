import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from '@/config/env';
import { requestContext } from '@/middleware/requestId';
import { globalRateLimiter } from '@/middleware/rateLimiter';
import { authenticate } from '@/middleware/authenticate';
import { auditLog } from '@/middleware/auditLog';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';

import healthRoutes from '@/modules/health/health.routes';
import authRoutes from '@/modules/identity/auth.routes';
import identityRoutes from '@/modules/identity/identity.routes';
import setupRoutes from '@/modules/setup/setup.routes';
import patientsRoutes from '@/modules/frontdesk/patients.routes';
import attendanceRoutes from '@/modules/attendance/attendance.routes';
import payrollRoutes from '@/modules/payroll/payroll.routes';
import commissionRoutes from '@/modules/commission/commission.routes';
import admissionRoutes from '@/modules/admission/admission.routes';
import inventoryRoutes from '@/modules/inventory/inventory.routes';
import pharmacyRoutes from '@/modules/pharmacy/pharmacy.routes';
import pharmacyBridgeRoutes from '@/modules/pharmacy-bridge/pharmacy-bridge.routes';
import cashRoutes from '@/modules/cash/cash.routes';
import reportsRoutes from '@/modules/reports/reports.routes';

/**
 * Express app assembly — no `listen()` here (§7.16), so it can be imported
 * directly by tests. Middleware order follows §7.6.
 */
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS.length > 0 ? env.CORS_ALLOWED_ORIGINS : false,
      credentials: true,
    }),
  );
  app.use(requestContext);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(globalRateLimiter);

  // Public routes — must be mounted before the blanket `authenticate` below.
  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);

  // Everything from here on requires a valid access token; mutating verbs
  // are captured to `audit_logs` (§7.14).
  app.use('/api/v1', authenticate, auditLog);

  app.use('/api/v1/staff', identityRoutes);
  app.use('/api/v1/setup', setupRoutes);
  app.use('/api/v1/patients', patientsRoutes);
  app.use('/api/v1/attendance', attendanceRoutes);
  app.use('/api/v1/payroll', payrollRoutes);
  app.use('/api/v1/commission', commissionRoutes);
  app.use('/api/v1/admissions', admissionRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/pharmacy', pharmacyRoutes);
  app.use('/api/v1/pharmacy-bridge', pharmacyBridgeRoutes);
  app.use('/api/v1/cash', cashRoutes);
  app.use('/api/v1/reports', reportsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
