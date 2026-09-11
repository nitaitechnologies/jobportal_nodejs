import { Router } from 'express';
import { adminManagementController } from '../controllers/adminManagement.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin, requirePermission } from '../middlewares/adminAuth.middleware';
import {
  validateAdminApplicationListQuery,
  validateAdminIdParam,
} from '../middlewares/adminManagementValidate.middleware';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();
router.use(authenticate, requireAdmin);

router.get(
  '/',
  requirePermission(PERMISSIONS.APPLICATIONS_READ),
  validateAdminApplicationListQuery,
  (req, res, next) => {
    void adminManagementController.listApplications(req, res, next);
  },
);

router.get('/:id', requirePermission(PERMISSIONS.APPLICATIONS_READ), validateAdminIdParam, (req, res, next) => {
  void adminManagementController.getApplication(req, res, next);
});

export default router;
