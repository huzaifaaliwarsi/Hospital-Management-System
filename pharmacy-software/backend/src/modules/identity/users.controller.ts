import type { Request, Response } from 'express';
import { AuthenticationError } from '@/shared/errors/AppError';
import { usersService } from './users.service';
import type { CreateUserBody, UpdateUserStatusBody, ResetPasswordBody } from './users.schemas';

export const usersController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await usersService.listManaged(req.user.role);
    res.json({ data });
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await usersService.create(req.body as CreateUserBody, req.user.sub, req.user.role);
    res.status(201).json({ data });
  },

  async updateStatus(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await usersService.updateStatus(req.params.id as string, req.body as UpdateUserStatusBody, req.user.role);
    res.json({ data });
  },

  async resetPassword(req: Request, res: Response) {
    if (!req.user) throw new AuthenticationError();
    const data = await usersService.resetPassword(req.params.id as string, req.body as ResetPasswordBody, req.user.role);
    res.json({ data });
  },
};
