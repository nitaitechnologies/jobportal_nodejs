import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { requireActiveAccount } from '../middlewares/accountStatus.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateNotificationIdParam,
  validateNotificationQuery,
} from '../middlewares/notificationValidate.middleware';

/**
 * Shared in-app notification routes for candidate + employer users.
 * Ownership always derived from JWT userId → Notification.recipientId.
 * There is no public create endpoint.
 */
const notificationRouter = Router();

notificationRouter.use(authenticate, requireRole('candidate', 'employer'), requireActiveAccount);

notificationRouter.get('/', validateNotificationQuery, (req, res, next) => {
  void notificationController.list(req, res, next);
});

notificationRouter.get('/unread-count', (req, res, next) => {
  void notificationController.unreadCount(req, res, next);
});

notificationRouter.patch('/read-all', (req, res, next) => {
  void notificationController.markAllRead(req, res, next);
});

notificationRouter.get('/:id', validateNotificationIdParam, (req, res, next) => {
  void notificationController.getById(req, res, next);
});

notificationRouter.patch('/:id/read', validateNotificationIdParam, (req, res, next) => {
  void notificationController.markRead(req, res, next);
});

notificationRouter.patch('/:id/unread', validateNotificationIdParam, (req, res, next) => {
  void notificationController.markUnread(req, res, next);
});

notificationRouter.delete('/:id', validateNotificationIdParam, (req, res, next) => {
  void notificationController.delete(req, res, next);
});

export default notificationRouter;
