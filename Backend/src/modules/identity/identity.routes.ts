import { Router } from 'express';
import staffRoutes from './staff.routes';

/** Combines the identity domain's sub-routers (auth is mounted separately, publicly, in app.ts). */
const router = Router();
router.use('/', staffRoutes);

export default router;
