import { Router } from 'express';
import { adminContentController } from '../controllers/adminContent.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateAdminNotificationQuery,
  validateAdminNotificationSend,
  validateNotificationTemplateCreate,
  validateNotificationTemplateIdParam,
  validateNotificationTemplateQuery,
  validateNotificationTemplateUpdate,
} from '../middlewares/adminContentValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get(
  '/',
  requirePermission(PERMISSIONS.NOTIFICATIONS_READ),
  validateAdminNotificationQuery,
  (req, res, next) => {
    void adminContentController.listNotifications(req, res, next);
  },
);

router.post(
  '/send',
  requirePermission(PERMISSIONS.NOTIFICATIONS_SEND),
  validateAdminNotificationSend,
  (req, res, next) => {
    void adminContentController.sendNotification(req, res, next);
  },
);

router.get(
  '/templates',
  requirePermission(PERMISSIONS.NOTIFICATIONS_READ),
  validateNotificationTemplateQuery,
  (req, res, next) => {
    void adminContentController.listTemplates(req, res, next);
  },
);

router.post(
  '/templates',
  requirePermission(PERMISSIONS.NOTIFICATIONS_MANAGE),
  validateNotificationTemplateCreate,
  (req, res, next) => {
    void adminContentController.createTemplate(req, res, next);
  },
);

router.patch(
  '/templates/:id',
  requirePermission(PERMISSIONS.NOTIFICATIONS_MANAGE),
  validateNotificationTemplateIdParam,
  validateNotificationTemplateUpdate,
  (req, res, next) => {
    void adminContentController.updateTemplate(req, res, next);
  },
);

router.delete(
  '/templates/:id',
  requirePermission(PERMISSIONS.NOTIFICATIONS_MANAGE),
  validateNotificationTemplateIdParam,
  (req, res, next) => {
    void adminContentController.deleteTemplate(req, res, next);
  },
);

export default router;
