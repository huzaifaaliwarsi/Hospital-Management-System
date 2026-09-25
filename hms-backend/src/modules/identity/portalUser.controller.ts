import type { Request, Response } from 'express';
import { portalUserService } from './portalUser.service';
import { AuthenticationError } from '@/shared/errors/AppError';
import type { PortalRole } from '@/config/constants';
import type {
  CreatePortalUserBody,
  UpdatePortalUserBody,
  ListPortalUsersQuery,
  ResetPortalUserPasswordBody,
  UpdatePortalUserStatusBody,
} from './portalUser.schemas';

function actorId(req: Request): string {
  if (!req.user) throw new AuthenticationError();
  return req.user.sub;
}

function actorRole(req: Request): PortalRole {
  if (!req.user) throw new AuthenticationError();
  return req.user.role;
}

export const portalUserController = {
  async list(req: Request, res: Response) {
    const { rows, meta } = await portalUserService.list(req.query as unknown as ListPortalUsersQuery);
    res.json({ data: rows, meta: { pagination: meta } });
  },

  async getById(req: Request, res: Response) {
    const user = await portalUserService.getById(req.params.id as string);
    res.json({ data: user });
  },

  async create(req: Request, res: Response) {
    const user = await portalUserService.create(req.body as CreatePortalUserBody, actorId(req), actorRole(req));
    res.status(201).json({ data: user });
  },

  async update(req: Request, res: Response) {
    const user = await portalUserService.update(
      req.params.id as string,
      req.body as UpdatePortalUserBody,
      actorId(req),
      actorRole(req),
    );
    res.json({ data: user });
  },

  async updateStatus(req: Request, res: Response) {
    const user = await portalUserService.updateStatus(
      req.params.id as string,
      req.body as UpdatePortalUserStatusBody,
      actorId(req),
      actorRole(req),
    );
    res.json({ data: user });
  },

  async resetPassword(req: Request, res: Response) {
    const { newPassword } = req.body as ResetPortalUserPasswordBody;
    const user = await portalUserService.resetPassword(req.params.id as string, newPassword, actorId(req), actorRole(req));
    res.json({ data: user });
  },

  async remove(req: Request, res: Response) {
    await portalUserService.remove(req.params.id as string, actorRole(req));
    res.status(204).send();
  },
};
