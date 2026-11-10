import { Request, Response } from 'express';
import { notificationsService } from './notifications.service';

export const notificationsController = {
  async listNotifications(req: Request, res: Response) {
    const portal = req.query.portal as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
    const items = await notificationsService.listNotifications(portal, limit);
    res.json({
      data: items.map((item) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        type: item.type,
        module: item.module,
        targetPortal: item.targetPortal,
        actionUrl: item.actionUrl,
        referenceId: item.referenceId,
        read: item.isRead,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  },

  async markAsRead(req: Request, res: Response) {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ error: 'Notification id required' });
      return;
    }
    await notificationsService.markAsRead(id);
    res.json({ success: true });
  },

  async markAllAsRead(req: Request, res: Response) {
    const portal = req.body?.portal as string | undefined;
    await notificationsService.markAllAsRead(portal);
    res.json({ success: true });
  },
};
