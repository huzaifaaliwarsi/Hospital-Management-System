import { Router } from 'express';
import { asyncHandler } from '@/shared/asyncHandler';
import { devicesController } from './devices.controller';

const router = Router();

// Device Registration & Overview
router.get('/biometric', asyncHandler(devicesController.getOverview));
router.put('/biometric', asyncHandler(devicesController.upsertDevice));
router.post('/biometric', asyncHandler(devicesController.upsertDevice));

// Staff Biometric Identity Mappings
router.get('/biometric/mappings', asyncHandler(devicesController.listMappings));
router.post('/biometric/mappings', asyncHandler(devicesController.createMapping));
router.delete('/biometric/mappings/:id', asyncHandler(devicesController.deleteMapping));

// Unmapped Raw Punches
router.get('/biometric/unmapped-punches', asyncHandler(devicesController.getUnmappedPunches));

export default router;
