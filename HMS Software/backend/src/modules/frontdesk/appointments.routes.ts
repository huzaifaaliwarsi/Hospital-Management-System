import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/shared/asyncHandler';
import { appointmentsController as c } from './appointments.controller';
import * as s from './appointments.schemas';

const router = Router();
const view = authorize('frontdesk', 'view');
const create = authorize('frontdesk', 'create');
const write = authorize('frontdesk', 'edit');

router.post(
  '/',
  create,
  validate({ body: s.bookAppointmentSchema }),
  asyncHandler(c.bookAppointment),
);

router.get(
  '/',
  view,
  validate({ query: s.listAppointmentsQuerySchema }),
  asyncHandler(c.listAppointments),
);

router.get(
  '/:id',
  view,
  validate({ params: s.appointmentIdParamsSchema }),
  asyncHandler(c.getAppointment),
);

router.patch(
  '/:id',
  write,
  validate({ params: s.appointmentIdParamsSchema, body: s.updateAppointmentSchema }),
  asyncHandler(c.updateAppointment),
);

router.post(
  '/:id/cancel',
  write,
  validate({ params: s.appointmentIdParamsSchema, body: s.cancelAppointmentSchema }),
  asyncHandler(c.cancelAppointment),
);

router.post(
  '/:id/advance',
  create,
  validate({ params: s.appointmentIdParamsSchema, body: s.collectAdvanceSchema }),
  asyncHandler(c.collectAdvance),
);

router.post(
  '/:id/check-in',
  write,
  validate({ params: s.appointmentIdParamsSchema, body: s.checkInAppointmentSchema }),
  asyncHandler(c.checkInAppointment),
);

export default router;
