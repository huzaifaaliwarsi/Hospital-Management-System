import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { admissionController as c } from './admission.controller';
import * as s from './admission.schemas';

const router = Router();
const view = authorize('admission', 'view');
const create = authorize('admission', 'create');
const write = authorize('admission', 'edit');

// Planned Admissions
router.post(
  '/',
  create,
  validate({ body: s.createPlannedAdmissionSchema }),
  asyncHandler(c.createPlannedAdmission),
);

router.post(
  '/planned',
  create,
  validate({ body: s.createPlannedAdmissionSchema }),
  asyncHandler(c.createPlannedAdmission),
);

router.get(
  '/',
  view,
  validate({ query: s.listAdmissionsQuerySchema }),
  asyncHandler(c.listAdmissions),
);

router.get(
  '/:id',
  view,
  validate({ params: s.admissionIdParamsSchema }),
  asyncHandler(c.getAdmission),
);

router.patch(
  '/:id',
  write,
  validate({ params: s.admissionIdParamsSchema, body: s.updatePlannedAdmissionSchema }),
  asyncHandler(c.updatePlannedAdmission),
);

// Payment Requests (Sent to Front Desk / Billing queue)
router.post(
  '/:id/request-advance',
  create,
  validate({ params: s.admissionIdParamsSchema, body: s.requestPaymentSchema }),
  asyncHandler(c.requestPayment),
);

router.post(
  '/:id/payment-requests',
  create,
  validate({ params: s.admissionIdParamsSchema, body: s.requestPaymentSchema }),
  asyncHandler(c.requestPayment),
);

// Bed Lifecycle & Check-In
router.post(
  '/:id/check-in',
  write,
  validate({ params: s.admissionIdParamsSchema, body: s.checkInAdmissionSchema }),
  asyncHandler(c.checkInAdmission),
);

router.post(
  '/:id/assign-bed',
  write,
  validate({ params: s.admissionIdParamsSchema, body: s.checkInAdmissionSchema }),
  asyncHandler(c.checkInAdmission),
);

router.post(
  '/:id/bed-transfer',
  write,
  validate({ params: s.admissionIdParamsSchema, body: s.transferBedSchema }),
  asyncHandler(c.transferBed),
);

router.post(
  '/:id/transfers',
  write,
  validate({ params: s.admissionIdParamsSchema, body: s.transferBedSchema }),
  asyncHandler(c.transferBed),
);

// Hospital Services & Running Charges
router.post(
  '/:id/add-service',
  write,
  validate({ params: s.admissionIdParamsSchema, body: s.addAdmissionServiceSchema }),
  asyncHandler(c.addAdmissionService),
);

router.post(
  '/:id/services',
  write,
  validate({ params: s.admissionIdParamsSchema, body: s.addAdmissionServiceSchema }),
  asyncHandler(c.addAdmissionService),
);

// Medication Mode & Pharmacy Requests
router.post(
  '/:id/medication-mode',
  write,
  validate({ params: s.admissionIdParamsSchema, body: s.changeMedicationModeSchema }),
  asyncHandler(c.changeMedicationMode),
);

router.post(
  '/:id/pharmacy-requests',
  create,
  validate({ params: s.admissionIdParamsSchema, body: s.createPharmacyRequestSchema }),
  asyncHandler(c.createPharmacyRequest),
);

// Dual / 3-Key Clearance Discharge Gate
router.get(
  '/:id/clearances',
  view,
  validate({ params: s.admissionIdParamsSchema }),
  asyncHandler(c.getClearances),
);

router.post(
  '/:id/clearances',
  write,
  validate({ params: s.admissionIdParamsSchema, body: s.grantClearanceSchema }),
  asyncHandler(c.grantClearance),
);

router.post(
  '/:id/discharge',
  write,
  validate({ params: s.admissionIdParamsSchema }),
  asyncHandler(c.dischargePatient),
);

router.get(
  '/:id/discharge-summary',
  view,
  validate({ params: s.admissionIdParamsSchema }),
  asyncHandler(c.getDischargeSummary),
);

export default router;
