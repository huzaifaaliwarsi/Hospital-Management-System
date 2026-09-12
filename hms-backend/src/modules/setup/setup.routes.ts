import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { setupController as c } from './setup.controller';
import * as s from './setup.schemas';

/** §4.2, §8.4 — mounted at `/api/v1/setup`. */
const router = Router();
const view = authorize('setup', 'view');
const write = authorize('setup', 'edit');
const create = authorize('setup', 'create');

// Hospital Profile
router.get('/hospital-profile', view, asyncHandler(c.getHospitalProfile));
router.put('/hospital-profile', write, validate({ body: s.updateHospitalProfileSchema }), asyncHandler(c.updateHospitalProfile));

// Departments
router.get('/departments', view, asyncHandler(c.listDepartments));
router.post('/departments', create, validate({ body: s.createDepartmentSchema }), asyncHandler(c.createDepartment));
router.patch('/departments/:id', write, validate({ params: s.idParamsSchema, body: s.updateDepartmentSchema }), asyncHandler(c.updateDepartment));
router.post('/departments/:id/deactivate', write, validate({ params: s.idParamsSchema }), asyncHandler(c.deactivateDepartment));

// Services & Rates
router.get('/services-rates', view, asyncHandler(c.listServiceRates));
router.post('/services-rates', create, validate({ body: s.createServiceRateSchema }), asyncHandler(c.createServiceRate));
router.patch('/services-rates/:id', write, validate({ params: s.idParamsSchema, body: s.updateServiceRateSchema }), asyncHandler(c.updateServiceRate));
router.post('/services-rates/:id/deactivate', write, validate({ params: s.idParamsSchema }), asyncHandler(c.deactivateServiceRate));

// Wards / Rooms / Beds
router.get('/wards-rooms-beds', view, asyncHandler(c.listWardHierarchy));
router.post('/wards-rooms-beds/wards', create, validate({ body: s.createWardSchema }), asyncHandler(c.createWard));
router.patch('/wards-rooms-beds/wards/:id', write, validate({ params: s.idParamsSchema, body: s.updateWardSchema }), asyncHandler(c.updateWard));
router.post('/wards-rooms-beds/rooms', create, validate({ body: s.createRoomSchema }), asyncHandler(c.createRoom));
router.patch('/wards-rooms-beds/rooms/:id', write, validate({ params: s.idParamsSchema, body: s.updateRoomSchema }), asyncHandler(c.updateRoom));
router.post('/wards-rooms-beds/beds', create, validate({ body: s.createBedSchema }), asyncHandler(c.createBed));
router.patch('/wards-rooms-beds/beds/:id', write, validate({ params: s.idParamsSchema, body: s.updateBedSchema }), asyncHandler(c.updateBed));

// Corporate Panels
router.get('/corporate-panels', view, asyncHandler(c.listCorporatePanels));
router.post('/corporate-panels', create, validate({ body: s.createCorporatePanelSchema }), asyncHandler(c.createCorporatePanel));
router.patch('/corporate-panels/:id', write, validate({ params: s.idParamsSchema, body: s.updateCorporatePanelSchema }), asyncHandler(c.updateCorporatePanel));
router.put('/corporate-panels/:id/discount-rules', write, validate({ params: s.idParamsSchema, body: s.replaceDiscountRulesSchema }), asyncHandler(c.replaceDiscountRules));

export default router;
