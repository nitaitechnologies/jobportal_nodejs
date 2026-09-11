import { Router } from 'express';
import { adminManagementController } from '../controllers/adminManagement.controller';
import { authenticate } from '../middlewares/auth.middleware';
import {
  requireAdmin,
  requireAdminRole,
  requirePermission,
} from '../middlewares/adminAuth.middleware';
import {
  validateAdminAuditListQuery,
  validateAdminIdParam,
} from '../middlewares/adminManagementValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get(
  '/',
  requirePermission(PERMISSIONS.AUDIT_LOGS_READ),
  requireAdminRole('super_admin', 'admin'),
  validateAdminAuditListQuery,
  (req, res, next) => {
    void adminManagementController.listAuditLogs(req, res, next);
  },
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.AUDIT_LOGS_READ),
  requireAdminRole('super_admin', 'admin'),
  validateAdminIdParam,
  (req, res, next) => {
    void adminManagementController.getAuditLog(req, res, next);
  },
);

export default router;
