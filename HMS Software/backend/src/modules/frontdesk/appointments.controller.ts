import type { Request, Response } from 'express';
import { appointmentsService } from './appointments.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type {
  BookAppointmentBody,
  ListAppointmentsQuery,
  UpdateAppointmentBody,
  CancelAppointmentBody,
  CollectAdvanceBody,
  CheckInAppointmentBody,
} from './appointments.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

export const appointmentsController = {
  bookAppointment: async (req: Request, res: Response) => {
    const result = await appointmentsService.bookAppointment(
      req.body as BookAppointmentBody,
      actorId(req),
    );
    res.status(201).json({ data: result });
  },

  listAppointments: async (req: Request, res: Response) => {
    const appointments = await appointmentsService.listAppointments(
      req.query as unknown as ListAppointmentsQuery,
    );
    res.json({ data: appointments });
  },

  getAppointment: async (req: Request, res: Response) => {
    const appointment = await appointmentsService.getAppointment(req.params.id as string);
    res.json({ data: appointment });
  },

  updateAppointment: async (req: Request, res: Response) => {
    const updated = await appointmentsService.updateAppointment(
      req.params.id as string,
      req.body as UpdateAppointmentBody,
    );
    res.json({ data: updated });
  },

  cancelAppointment: async (req: Request, res: Response) => {
    const cancelled = await appointmentsService.cancelAppointment(
      req.params.id as string,
      req.body as CancelAppointmentBody,
    );
    res.json({ data: cancelled });
  },

  collectAdvance: async (req: Request, res: Response) => {
    const receipt = await appointmentsService.collectAdvance(
      req.params.id as string,
      req.body as CollectAdvanceBody,
      actorId(req),
    );
    res.status(201).json({ data: receipt });
  },

  checkInAppointment: async (req: Request, res: Response) => {
    const result = await appointmentsService.checkInAppointment(
      req.params.id as string,
      req.body as CheckInAppointmentBody,
      actorId(req),
    );
    res.json({ data: result });
  },
};
