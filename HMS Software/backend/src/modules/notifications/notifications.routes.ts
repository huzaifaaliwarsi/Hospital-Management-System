import { Router } from 'express';
import { asyncHandler } from '@/shared/asyncHandler';
import { notificationsController as c } from './notifications.controller';

const router = Router();

router.get('/', asyncHandler(c.listNotifications));
router.patch('/:id/read', asyncHandler(c.markAsRead));
router.post('/mark-all-read', asyncHandler(c.markAllAsRead));

export default router;
