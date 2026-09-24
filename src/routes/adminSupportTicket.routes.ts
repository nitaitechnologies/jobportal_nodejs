import { Router } from 'express';
import { supportTicketController } from '../controllers/supportTicket.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateSupportTicketIdParam,
  validateSupportTicketQuery,
  validateSupportTicketUpdate,
} from '../middlewares/supportTicketValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get(
  '/categories',
  requirePermission(PERMISSIONS.SUPPORT_TICKETS_READ),
  (req, res, next) => {
    void supportTicketController.listCategories(req, res, next);
  },
);

router.get(
  '/',
  requirePermission(PERMISSIONS.SUPPORT_TICKETS_READ),
  validateSupportTicketQuery,
  (req, res, next) => {
    void supportTicketController.adminList(req, res, next);
  },
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.SUPPORT_TICKETS_READ),
  validateSupportTicketIdParam,
  (req, res, next) => {
    void supportTicketController.adminGet(req, res, next);
  },
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.SUPPORT_TICKETS_UPDATE),
  validateSupportTicketIdParam,
  validateSupportTicketUpdate,
  (req, res, next) => {
    void supportTicketController.adminUpdate(req, res, next);
  },
);

export default router;
